import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { calculateParlay, generateDailyParlay, generateValueParlay, generateFunBet, generatePremium90Parlays } from "@/lib/betting/parlay-calculator";
import { marketRank, marketWeight } from "@/lib/betting/market-priority";
import { leagueTier, leagueWeight, CHAMPIONS_LEAGUE_ID } from "@/lib/betting/league-priority";
import type { Database } from "@/types/database";
import { notifyProUsers } from "@/lib/telegram/send";

type MarketType = Database["public"]["Enums"]["market_type"];

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron — corre a las 6, 10 y 14 UTC.
 *
 * Genera automáticamente los "parlays del día" a partir de las value bets
 * pendientes detectadas por detect-value-bets.
 *
 * Produce:
 *  - 1 parlay "free"    — 2-3 piernas, bets de alto edge (is_premium=false)
 *  - 1 parlay "premium" — 3-5 piernas, todas las bets válidas, mayor edge acumulado
 *
 * Criterios de selección:
 *  - Confianza medium o high
 *  - Un único bet por partido (el de mayor score = modelProb × (1+edge))
 *  - Partidos que arrancan en las próximas 36h
 *  - Probabilidad combinada del modelo ≥ 40% (free) / 25% (premium)
 *
 * Idempotente: si ya existen parlays creados hoy (UTC), no hace nada.
 * Reintento automático: si la primera ejecución no produce parlays (sin value bets),
 * las ejecuciones posteriores del día intentan de nuevo.
 */

type ValueBetRow = {
  id: number;
  match_id: number;
  bookmaker_id: number;
  market: MarketType;
  selection: string;
  price: number;
  model_prob: number | null;
  edge: number | null;
  confidence: string | null;
  is_premium: boolean | null;
};

type MatchRow = {
  id: number;
  kickoff: string;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
  league: { id: number; name: string } | null;
};

type Candidate = {
  matchId: number;
  market: MarketType;
  selection: string;
  decimalOdds: number;
  modelProb: number;
  confidence: "low" | "medium" | "high";
  bookmaker_id: number;
  is_premium: boolean;
  edge: number;
  leagueId: number | null;
  // Peso por tier de competición — sólo afecta ordenación, no la matemática
  // combinada de los parlays.
  priorityWeight: number;
  // Tier numérico (1 = Champions, mejor). Los helpers ordenan por este campo
  // primero, garantizando que Champions y otras competiciones top encabecen
  // SIEMPRE el pool antes de aplicar el score por modelProb × peso.
  priorityTier: number;
};

function buildParlayTitle(legs: Candidate[], matchMap: Map<number, MatchRow>): string {
  const leagues = [
    ...new Set(
      legs
        .map((l) => matchMap.get(l.matchId)?.league?.name)
        .filter(Boolean) as string[],
    ),
  ];
  return leagues.length
    ? `Combinada del día — ${leagues.slice(0, 2).join(" + ")}`
    : "Combinada del día";
}

function buildPremiumTitle(legs: Candidate[], matchMap: Map<number, MatchRow>): string {
  const leagues = [
    ...new Set(
      legs
        .map((l) => matchMap.get(l.matchId)?.league?.name)
        .filter(Boolean) as string[],
    ),
  ];
  return leagues.length
    ? `Parlay Premium — ${leagues.slice(0, 2).join(" + ")}`
    : "Parlay Premium";
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // Idempotency guard: skip sólo si HAY parlays activos del día (no expirados).
  // Si los parlays generados antes hoy ya expiraron (sus matches terminaron),
  // dejamos que el cron regenere para los partidos que vienen — antes este guard
  // miraba sólo `created_at >= todayUTC`, lo que dejaba la página vacía toda la
  // tarde cuando los parlays de la mañana caducaban.
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const { count: existingCount } = await supabase
    .from("parlays")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayUTC.toISOString())
    .gte("valid_until", now.toISOString());

  if ((existingCount ?? 0) > 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "active parlays already generated today",
      activeCount: existingCount,
      timestamp: now.toISOString(),
    });
  }

  // Matches starting in the next 36h
  const in36h = new Date(now.getTime() + 36 * 3600 * 1000);

  const { data: matches, error: matchErr } = await supabase
    .from("matches")
    .select(
      `id, kickoff,
       home_team:teams!home_team_id(name),
       away_team:teams!away_team_id(name),
       league:leagues(id, name)`,
    )
    .gte("kickoff", now.toISOString())
    .lte("kickoff", in36h.toISOString())
    .eq("status", "scheduled");

  if (matchErr) {
    console.error("[generate-parlays] matches query error:", matchErr.message);
    return NextResponse.json({ error: matchErr.message }, { status: 500 });
  }
  if (!matches?.length) {
    return NextResponse.json({
      ok: true,
      generated: 0,
      reason: "no upcoming matches in window",
      timestamp: now.toISOString(),
    });
  }

  const matchIds = matches.map((m) => m.id);
  const matchMap = new Map(matches.map((m) => [m.id, m as unknown as MatchRow]));

  // Mercados permitidos en combinadas: enfocadas en cantidad de goles,
  // esquinas, amarillas y eventos del partido. Excluye explícitamente 1x2
  // y hándicap asiático aun si quedaran bets viejos en la BD.
  const ALLOWED_PARLAY_MARKETS: MarketType[] = [
    "over_under_1_5",
    "over_under_2_5",
    "over_under_3_5",
    "btts",
    "double_chance",
    "corners_over_under",
    "cards_over_under",
  ];

  // Pending value bets for those matches (medium or high confidence only)
  const { data: valueBets, error: vbErr } = await supabase
    .from("value_bets")
    .select(
      "id, match_id, bookmaker_id, market, selection, price, model_prob, edge, confidence, is_premium",
    )
    .eq("result", "pending")
    .in("confidence", ["medium", "high"])
    .in("market", ALLOWED_PARLAY_MARKETS)
    .in("match_id", matchIds);

  if (vbErr) {
    console.error("[generate-parlays] value_bets query error:", vbErr.message);
    return NextResponse.json({ error: vbErr.message }, { status: 500 });
  }
  if (!valueBets?.length) {
    return NextResponse.json({
      ok: true,
      generated: 0,
      reason: "no qualifying value bets",
      timestamp: now.toISOString(),
    });
  }

  // Deduplicate: keep best bet per match. El "mejor" combina prob. del modelo
  // con prioridad de mercado y de competición — Champions/Libertadores y
  // mercados de eventos contables ganan empates frente a btts/DC en ligas
  // menores.
  const leagueIdFor = (matchId: number) => matchMap.get(matchId)?.league?.id ?? null;
  const candidateScore = (vb: ValueBetRow) =>
    (vb.model_prob ?? 0) * marketWeight(vb.market) * leagueWeight(leagueIdFor(vb.match_id));

  const bestPerMatch = new Map<number, ValueBetRow>();
  for (const vb of valueBets as ValueBetRow[]) {
    const existing = bestPerMatch.get(vb.match_id);
    if (!existing) {
      bestPerMatch.set(vb.match_id, vb);
      continue;
    }
    const scoreNew = candidateScore(vb);
    const scoreOld = candidateScore(existing);
    if (scoreNew > scoreOld) {
      bestPerMatch.set(vb.match_id, vb);
    } else if (scoreNew === scoreOld && marketRank(vb.market) < marketRank(existing.market)) {
      bestPerMatch.set(vb.match_id, vb);
    }
  }

  const allCandidates: Candidate[] = [...bestPerMatch.values()].map((vb) => {
    const lid = leagueIdFor(vb.match_id);
    return {
      matchId: vb.match_id,
      market: vb.market,
      selection: vb.selection,
      decimalOdds: vb.price,
      modelProb: vb.model_prob ?? 0,
      confidence: (vb.confidence ?? "low") as "low" | "medium" | "high",
      bookmaker_id: vb.bookmaker_id,
      is_premium: vb.is_premium ?? false,
      edge: vb.edge ?? 0,
      leagueId: lid,
      priorityWeight: leagueWeight(lid),
      priorityTier: leagueTier(lid),
    };
  });

  const championsCount = allCandidates.filter(
    (c) => c.leagueId === CHAMPIONS_LEAGUE_ID,
  ).length;

  const generatedIds: string[] = [];

  // Helper: insert a parlay + its legs into the DB
  async function insertParlay(
    legs: Candidate[],
    title: string,
    description: string,
    tier: "free" | "premium",
  ): Promise<string | null> {
    const parlayLegs = legs.map((leg) => ({
      matchId: leg.matchId,
      market: leg.market,
      selection: leg.selection,
      decimalOdds: leg.decimalOdds,
      modelProb: leg.modelProb,
    }));

    const calc = calculateParlay(parlayLegs);
    const lastKickoffMs = Math.max(
      ...legs.map((l) => new Date(matchMap.get(l.matchId)?.kickoff ?? 0).getTime()),
    );

    const { data: parlay, error: pErr } = await supabase
      .from("parlays")
      .insert({
        title,
        description,
        total_odds: Math.round(calc.totalOdds * 100) / 100,
        total_probability:
          Math.round(
            ((calc.combinedModelProb ?? calc.combinedImpliedProb) * 10000),
          ) / 10000,
        expected_value:
          calc.expectedValue != null
            ? Math.round(calc.expectedValue * 1000) / 1000
            : null,
        confidence: legs.length <= 2 ? "high" : "medium",
        tier,
        status: "pending",
        is_featured: tier === "free",
        valid_until: new Date(lastKickoffMs + 105 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (pErr || !parlay?.id) {
      console.error("[generate-parlays] parlay insert error:", pErr?.message);
      return null;
    }

    const legRows = legs.map((leg, i) => ({
      parlay_id: parlay.id,
      match_id: leg.matchId,
      bookmaker_id: leg.bookmaker_id ?? null,
      market: leg.market,
      selection: leg.selection,
      price: leg.decimalOdds,
      model_prob: leg.modelProb ?? null,
      result: "pending",
      leg_order: i + 1,
    }));

    const { error: legErr } = await supabase.from("parlay_legs").insert(legRows);
    if (legErr) {
      console.error("[generate-parlays] parlay_legs insert error:", legErr.message);
      // Roll back orphan parlay
      await supabase.from("parlays").delete().eq("id", parlay.id);
      return null;
    }

    return parlay.id;
  }

  // ── Free parlay: non-premium bets (high edge, visible para todos) ─
  // Pre-orden por tier de competición — Champions encabeza el pool incluso si
  // hay un partido de liga menor con mayor probabilidad bruta. Los helpers
  // respetan el `priorityTier` como clave primaria de orden.
  const freeCandidates = allCandidates
    .filter((c) => !c.is_premium)
    .sort((a, b) => {
      if (a.priorityTier !== b.priorityTier) return a.priorityTier - b.priorityTier;
      const sa = (a.modelProb ?? 0) * (1 + a.edge) * marketWeight(a.market);
      const sb = (b.modelProb ?? 0) * (1 + b.edge) * marketWeight(b.market);
      return sb - sa;
    });

  const freeLegs = generateDailyParlay(freeCandidates, {
    minLegs: 2,
    maxLegs: 3,
    minCombinedProb: 0.40,
    minIndividualProb: 0.70,
    // Free parlay = "todas las piernas son seguras". Cap duro a 1.70
    // (≈ 59% prob fair) para evitar mezclar un banker con un moonshot.
    maxIndividualOdds: 1.70,
  });

  const usedMatchIds = new Set<number>();

  if (freeLegs && freeLegs.length >= 2) {
    // Map back to Candidate to get bookmaker_id / edge
    const freeWithMeta = freeLegs.map(
      (l) =>
        allCandidates.find(
          (c) =>
            c.matchId === l.matchId &&
            c.market === l.market &&
            c.selection === l.selection,
        )!,
    );

    const avgProb =
      (freeLegs.reduce((s, l) => s + (l.modelProb ?? 0), 0) / freeLegs.length) * 100;

    const id = await insertParlay(
      freeWithMeta,
      buildParlayTitle(freeWithMeta, matchMap),
      `${freeLegs.length} selecciones de alta confianza. Probabilidad combinada estimada: ${avgProb.toFixed(0)}%.`,
      "free",
    );

    if (id) {
      generatedIds.push(id);
      freeLegs.forEach((l) => usedMatchIds.add(l.matchId));
    }
  }

  // ── Premium parlay: all bets, ordenados por tier de competición primero,
  //    luego por edge × peso de mercado × peso de liga.
  const premiumCandidates = allCandidates
    .filter((c) => !usedMatchIds.has(c.matchId))
    .sort((a, b) => {
      const tierA = leagueTier(a.leagueId);
      const tierB = leagueTier(b.leagueId);
      if (tierA !== tierB) return tierA - tierB;
      const sa = a.edge * marketWeight(a.market) * leagueWeight(a.leagueId);
      const sb = b.edge * marketWeight(b.market) * leagueWeight(b.leagueId);
      return sb - sa;
    });

  const premiumLegs = generateDailyParlay(premiumCandidates, {
    minLegs: 3,
    maxLegs: 5,
    minCombinedProb: 0.25,
    minIndividualProb: 0.65,
    // Premium permite un poco más de cuota por pierna que el free, pero
    // sin moonshots: el techo a 1.90 mantiene cada pierna en zona "favorito"
    // (≥ ~53% fair) y el producto se hace por número de piernas, no por una
    // pata especulativa.
    maxIndividualOdds: 1.90,
  });

  if (premiumLegs && premiumLegs.length >= 2) {
    const premiumWithMeta = premiumLegs.map(
      (l) =>
        allCandidates.find(
          (c) =>
            c.matchId === l.matchId &&
            c.market === l.market &&
            c.selection === l.selection,
        )!,
    );

    const avgEdge =
      (premiumWithMeta.reduce((s, c) => s + c.edge, 0) / premiumWithMeta.length) * 100;

    const id = await insertParlay(
      premiumWithMeta,
      buildPremiumTitle(premiumWithMeta, matchMap),
      `${premiumLegs.length} selecciones de value. Edge promedio del modelo: +${avgEdge.toFixed(1)}%.`,
      "premium",
    );

    if (id) {
      generatedIds.push(id);
      // Reservar estos partidos para que la Combinada 80% / 90% / FunBet
      // posteriores no reutilicen las mismas piernas.
      premiumLegs.forEach((l) => usedMatchIds.add(l.matchId));
    }
  }

  // ── Combinada 80%: prob combinada > 80% + cuota objetivo ≈ 3.5 ─────────
  // Tier de competición primero, luego prob × pesos de mercado y liga.
  const combinada80Candidates = allCandidates
    .filter((c) => !usedMatchIds.has(c.matchId))
    .sort((a, b) => {
      const tierA = leagueTier(a.leagueId);
      const tierB = leagueTier(b.leagueId);
      if (tierA !== tierB) return tierA - tierB;
      const sa = (a.modelProb ?? 0) * marketWeight(a.market) * leagueWeight(a.leagueId);
      const sb = (b.modelProb ?? 0) * marketWeight(b.market) * leagueWeight(b.leagueId);
      return sb - sa;
    });

  // Combinada 80%: con prob individual ≥0.82 sobre 2 piernas la combinada
  // máxima posible es ~0.67 — exigir 0.80 hacía que esta combinada nunca se
  // generara. Bajamos minCombinedProb a 0.65 (≈ x1.54 fair odds) para que
  // sea matemáticamente alcanzable, y subimos minIndividualProb a 0.85 para
  // mantener la calidad por pierna.
  const combinada80Legs = generateValueParlay(combinada80Candidates, {
    targetOdds: 3.5,
    minCombinedProb: 0.65,
    minIndividualProb: 0.85,
    // Cuota fair para prob 0.85 = 1.176; con edge típico real (5-15%) la
    // cuota ofrecida sube a ~1.20-1.35. Cap a 1.45 evita aceptar piernas de
    // alta prob pero cuota inflada (que serían más síntoma de modelo
    // descalibrado que de valor real).
    maxIndividualOdds: 1.45,
  });

  if (combinada80Legs && combinada80Legs.length >= 2) {
    const c80WithMeta = combinada80Legs.map(
      (l) => allCandidates.find(
        (c) => c.matchId === l.matchId && c.market === l.market && c.selection === l.selection,
      )!,
    );

    const combinedProb = combinada80Legs.reduce((p, l) => p * (l.modelProb ?? 0), 1);
    const totalOdds = combinada80Legs.reduce((p, l) => p * l.decimalOdds, 1);

    const id = await insertParlay(
      c80WithMeta,
      `Combinada Segura · x${totalOdds.toFixed(2)}`,
      `${combinada80Legs.length} selecciones de alta probabilidad. Probabilidad combinada estimada: ${(combinedProb * 100).toFixed(0)}%.`,
      "free",
    );

    if (id) {
      generatedIds.push(id);
      combinada80Legs.forEach((l) => usedMatchIds.add(l.matchId));
    }
  }

  // ── Combinadas 90% Premium: 4 combinadas con prob ≥ 90% y cuota ≥ 1.60 ─────
  const premium90Combos = generatePremium90Parlays(allCandidates, 4);

  for (let idx = 0; idx < premium90Combos.length; idx++) {
    const legs90 = premium90Combos[idx];
    const with90Meta = legs90.map(
      (l) => allCandidates.find(
        (c) => c.matchId === l.matchId && c.market === l.market && c.selection === l.selection,
      )!,
    );

    const combinedProb90 = legs90.reduce((p, l) => p * (l.modelProb ?? 0), 1);
    const totalOdds90 = legs90.reduce((p, l) => p * l.decimalOdds, 1);

    const id = await insertParlay(
      with90Meta,
      `Combinada 90% #${idx + 1} · x${totalOdds90.toFixed(2)}`,
      `${legs90.length} selecciones con ${(combinedProb90 * 100).toFixed(0)}% de probabilidad combinada y cuota x${totalOdds90.toFixed(2)}.`,
      "premium",
    );

    if (id) generatedIds.push(id);
  }

  // ── FunBet del día: combinada multi-pierna con bankers ───────────────────
  // Filosofía: muchas piernas con cuota baja (cada una alta prob) se
  // multiplican hasta dar una cuota total atractiva. Reemplaza el FunBet
  // anterior que mezclaba un moonshot con bankers — patrón que reducía
  // muchísimo la probabilidad combinada.
  const funBetLegs = generateFunBet(allCandidates, {
    targetOdds: 12,
    minLegs: 4,
    maxLegs: 10,
    minIndividualProb: 0.60,
    minIndividualOdds: 1.25,
    maxIndividualOdds: 1.75,
    minCombinedProb: 0.10,
  });

  if (funBetLegs && funBetLegs.length >= 4) {
    const funWithMeta = funBetLegs.map(
      (l) => allCandidates.find(
        (c) => c.matchId === l.matchId && c.market === l.market && c.selection === l.selection,
      )!,
    );

    const funTotalOdds = funBetLegs.reduce((p, l) => p * l.decimalOdds, 1);
    const funCombinedProb = funBetLegs.reduce((p, l) => p * (l.modelProb ?? 0), 1);

    const id = await insertParlay(
      funWithMeta,
      `FunBet del día · x${funTotalOdds.toFixed(1)}`,
      `${funBetLegs.length} bankers combinados. Cada pierna con alta probabilidad — la cuota total x${funTotalOdds.toFixed(1)} sale del producto, no de mezclar moonshots. Probabilidad combinada estimada: ${(funCombinedProb * 100).toFixed(0)}%.`,
      "free",
    );

    if (id) generatedIds.push(id);
  }

  // Notificar por Telegram si se generaron parlays
  if (generatedIds.length > 0) {
    const msg =
      `🃏 <b>Parlay${generatedIds.length > 1 ? "s" : ""} del día generado${generatedIds.length > 1 ? "s" : ""}</b>\n\n` +
      `${generatedIds.length} combinada${generatedIds.length > 1 ? "s" : ""} lista${generatedIds.length > 1 ? "s" : ""} para hoy.\n` +
      `Entra a elparley.com/parlays para verla${generatedIds.length > 1 ? "s" : ""}.`;
    await notifyProUsers(msg, "parlays");
  }

  return NextResponse.json({
    ok: true,
    generated: generatedIds.length,
    parlayIds: generatedIds,
    candidatesEvaluated: allCandidates.length,
    championsCandidates: championsCount,
    timestamp: now.toISOString(),
  });
}
