import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  calculateMatchProbabilities,
  calculateCornerProbabilities,
  calculateCardProbabilities,
  type CornerProbabilities,
  type CardProbabilities,
} from "@/lib/betting/poisson";
import { detectValueBet, buildReasoning } from "@/lib/betting/value-bet";
import { removeVigMultiplicative } from "@/lib/betting/implied-probability";
import {
  pinnacleFairProbs,
  pinnacleFairKey,
  pinnacleEdge,
  type PinnacleOdd,
} from "@/lib/betting/pinnacle-fair-odds";
import {
  LEAGUE_AVG_CORNERS,
  LEAGUE_AVG_CARDS,
  DEFAULT_CORNERS,
  DEFAULT_CARDS,
} from "@/lib/betting/stats";
import { HIGH_PRIORITY_LEAGUE_IDS } from "@/lib/api/api-football";
import { notifyProUsers } from "@/lib/telegram/send";
import type { Database } from "@/types/database";

type ValueBetInsert = Database["public"]["Tables"]["value_bets"]["Insert"];

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron — corre cada 10 minutos (schedule: cada 10 min en vercel.json).
 *
 * Mercados soportados (enfocados en cantidad de goles, esquinas, amarillas y
 * eventos del partido — excluimos 1x2 y hándicap asiático):
 *  - Goles: over/under 1.5/2.5/3.5
 *  - Eventos: BTTS (ambos anotan), doble oportunidad
 *  - Córners: over/under 8.5/9.5/10.5 (modelo Poisson con medias por liga)
 *  - Tarjetas: over/under 3.5/4.5 (modelo Poisson con medias por liga)
 *
 * Exclusión: matches de HIGH_PRIORITY_LEAGUE_IDS con kickoff en <2h son
 * manejados por sync-live-odds (cada 5 min) para evitar race conditions en
 * el delete+insert de value_bets.
 */

// ── Mercados de goles + eventos ──────────────────────────────────────────────

type GoalMarketKey =
  | "over_under_1_5:over" | "over_under_1_5:under"
  | "over_under_2_5:over" | "over_under_2_5:under"
  | "over_under_3_5:over" | "over_under_3_5:under"
  | "btts:yes" | "btts:no"
  | "double_chance:1x" | "double_chance:12" | "double_chance:x2";

type GoalProbs = ReturnType<typeof calculateMatchProbabilities>;

const GOAL_MARKET_PROB: Record<GoalMarketKey, (p: GoalProbs) => number> = {
  "over_under_1_5:over":  (p) => p.over15,
  "over_under_1_5:under": (p) => p.under15,
  "over_under_2_5:over":  (p) => p.over25,
  "over_under_2_5:under": (p) => p.under25,
  "over_under_3_5:over":  (p) => p.over35,
  "over_under_3_5:under": (p) => p.under35,
  "btts:yes":             (p) => p.btts,
  "btts:no":              (p) => p.noBtts,
  "double_chance:1x":     (p) => p.dc1x,
  "double_chance:12":     (p) => p.dc12,
  "double_chance:x2":     (p) => p.dcx2,
};

// ── Mercados de córners ───────────────────────────────────────────────────────

const CORNER_MARKET_PROB: Record<string, (p: CornerProbabilities) => number> = {
  "over:8.5":   (p) => p.over85,
  "under:8.5":  (p) => p.under85,
  "over:9.5":   (p) => p.over95,
  "under:9.5":  (p) => p.under95,
  "over:10.5":  (p) => p.over105,
  "under:10.5": (p) => p.under105,
};

// ── Mercados de tarjetas ──────────────────────────────────────────────────────

const CARD_MARKET_PROB: Record<string, (p: CardProbabilities) => number> = {
  "over:3.5":  (p) => p.over35,
  "under:3.5": (p) => p.under35,
  "over:4.5":  (p) => p.over45,
  "under:4.5": (p) => p.under45,
};

// ─────────────────────────────────────────────────────────────────────────────
// Sanity check vs consenso del mercado
// ─────────────────────────────────────────────────────────────────────────────

/** Edge máximo aceptable. Por encima asumimos error de modelo, no valor. */
const MAX_EDGE_REASONABLE = 0.25;

/**
 * Desviación máxima (en pp) entre la probabilidad del modelo y la
 * probabilidad implícita "fair" del mercado (de-vigada). Si CUALQUIER
 * brazo del 1x2 supera esto, el modelo está mal calibrado para este
 * partido y rechazamos los mercados derivados de xG.
 *
 * 0.20 (20pp) tolera la ventaja real del modelo Poisson sin permitir
 * disparates como el bug del Pereira (modelo decía 71% DC1X, mercado decía 35%).
 */
const MAX_MODEL_VS_MARKET_DEVIATION = 0.20;

interface OddsRowLike {
  bookmaker_id: number;
  market: string;
  selection: string;
  price: number;
}

/**
 * Calcula el consenso del mercado para 1x2 promediando las probabilidades
 * de-vigadas de cada bookmaker. Devuelve null si no hay ningún bookmaker
 * con los tres brazos (home/draw/away) cotizados.
 */
function marketConsensus1x2(
  odds: OddsRowLike[],
): { home: number; draw: number; away: number } | null {
  type Triplet = { home?: number; draw?: number; away?: number };
  const byBookmaker = new Map<number, Triplet>();

  for (const o of odds) {
    if (o.market !== "1x2") continue;
    if (o.selection !== "home" && o.selection !== "draw" && o.selection !== "away") continue;
    if (!byBookmaker.has(o.bookmaker_id)) byBookmaker.set(o.bookmaker_id, {});
    byBookmaker.get(o.bookmaker_id)![o.selection as "home" | "draw" | "away"] = o.price;
  }

  let sumH = 0, sumD = 0, sumA = 0, n = 0;
  for (const t of byBookmaker.values()) {
    if (t.home && t.draw && t.away) {
      const [pH, pD, pA] = removeVigMultiplicative([t.home, t.draw, t.away]);
      sumH += pH; sumD += pD; sumA += pA; n += 1;
    }
  }
  if (n === 0) return null;
  return { home: sumH / n, draw: sumD / n, away: sumA / n };
}

/**
 * Verdadero si el modelo se aleja del consenso del mercado en cualquiera
 * de los tres brazos por más de MAX_MODEL_VS_MARKET_DEVIATION.
 *
 * Caso típico: con xG fallback (1.40, 1.10) el Poisson estima local≈45%
 * sin importar el equipo. El mercado, que sí distingue, paga al
 * último de la tabla a 6.50 (15% implícito). Diferencia: 30pp → flag.
 */
function modelFar1x2(
  model: { home: number; draw: number; away: number },
  market: { home: number; draw: number; away: number },
): boolean {
  return (
    Math.abs(model.home - market.home) > MAX_MODEL_VS_MARKET_DEVIATION ||
    Math.abs(model.draw - market.draw) > MAX_MODEL_VS_MARKET_DEVIATION ||
    Math.abs(model.away - market.away) > MAX_MODEL_VS_MARKET_DEVIATION
  );
}

/** Mercados cuyo modelo depende directamente de xG (afectados por el sanity check). */
function isXgDerivedMarket(market: string): boolean {
  return (
    market === "double_chance" ||
    market === "btts" ||
    market.startsWith("over_under_") ||
    market === "1x2"
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 3600 * 1000);
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

  // Pinnacle como benchmark de "precio justo". Se carga una vez al inicio
  // del cron; si la fila no existe (DB local sin seed) o falla la query,
  // simplemente no se calcula edge_pinnacle (no rompe el flujo).
  const { data: pinBookmaker } = await supabase
    .from("bookmakers")
    .select("id")
    .eq("slug", "pinnacle")
    .maybeSingle();
  const pinnacleBookmakerId = pinBookmaker?.id ?? null;

  // Limpia value_bets pendientes de mercados que ya no soportamos (1x2 y
  // hándicap asiático). Sin esto, los bets antiguos seguirían apareciendo
  // en /value-bets hasta que el partido finalice.
  await supabase
    .from("value_bets")
    .delete()
    .eq("result", "pending")
    .in("market", ["1x2", "asian_handicap"]);

  // Exclude HIGH_PRIORITY matches kicking off within 2h — sync-live-odds
  // handles those every 5 min. Processing them here too would cause a
  // delete+insert race condition on value_bets.
  const { data: hotMatchIds } = await supabase
    .from("matches")
    .select("id")
    .in("league_id", HIGH_PRIORITY_LEAGUE_IDS)
    .eq("status", "scheduled")
    .gte("kickoff", now.toISOString())
    .lte("kickoff", in2h.toISOString());

  const excludeIds = (hotMatchIds ?? []).map((m) => m.id);

  let query = supabase
    .from("matches")
    .select("id, league_id, home_team_id, away_team_id, model_expected_goals_home, model_expected_goals_away")
    .gte("kickoff", now.toISOString())
    .lte("kickoff", in48h.toISOString())
    .eq("status", "scheduled")
    .not("model_expected_goals_home", "is", null);

  if (excludeIds.length > 0) {
    // Validate all IDs are positive integers before interpolating into the filter string.
    // Although these come from the DB (not user input), this guards against unexpected
    // type coercion that could produce a malformed PostgREST filter.
    const safeIds = excludeIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (safeIds.length > 0) {
      query = query.not("id", "in", `(${safeIds.join(",")})`);
    }
  }

  const { data: matches, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!matches?.length) {
    return NextResponse.json({ ok: true, matchesScanned: 0, valueBetsDetected: 0, timestamp: now.toISOString() });
  }

  // Bulk-load team_stats para todos los equipos involucrados — evita N consultas
  // por partido. Las medias rodantes se mantienen al día por sync-team-stats.
  const teamIds = new Set<number>();
  for (const m of matches) {
    if (m.home_team_id) teamIds.add(m.home_team_id);
    if (m.away_team_id) teamIds.add(m.away_team_id);
  }

  const teamStatsById = new Map<number, {
    matches_sample: number;
    avg_corners_for: number | null;
    avg_corners_against: number | null;
    avg_yellow_cards: number | null;
  }>();

  if (teamIds.size > 0) {
    const { data: teamStatsRows } = await supabase
      .from("team_stats")
      .select("team_id, matches_sample, avg_corners_for, avg_corners_against, avg_yellow_cards")
      .in("team_id", [...teamIds]);
    for (const t of teamStatsRows ?? []) {
      teamStatsById.set(t.team_id, {
        matches_sample: t.matches_sample ?? 0,
        avg_corners_for: t.avg_corners_for as number | null,
        avg_corners_against: t.avg_corners_against as number | null,
        avg_yellow_cards: t.avg_yellow_cards as number | null,
      });
    }
  }

  // Mínimo de partidos para confiar en la media rodante por equipo. Por debajo
  // de este umbral usamos LEAGUE_AVG_* como antes (más estable que una muestra
  // de 1-2 partidos).
  const MIN_TEAM_SAMPLE = 5;

  // Bulk-load de TODAS las odds de los partidos en una sola query. Antes se
  // hacía una query por partido dentro del bucle (N+1) — con 200 matches eso
  // son 200 round-trips serializados. Una query única recorta cron en ~5-10x.
  type OddsRow = {
    id: number;
    match_id: number;
    bookmaker_id: number;
    market: string;
    selection: string;
    price: number;
    line: number | null;
  };
  const matchIds = matches.map((m) => m.id);
  const oddsByMatch = new Map<number, OddsRow[]>();
  if (matchIds.length > 0) {
    const { data: allOdds } = await supabase
      .from("odds")
      .select("id, match_id, bookmaker_id, market, selection, price, line")
      .in("match_id", matchIds);
    for (const o of (allOdds ?? []) as OddsRow[]) {
      const arr = oddsByMatch.get(o.match_id);
      if (arr) arr.push(o);
      else oddsByMatch.set(o.match_id, [o]);
    }
  }

  let detected = 0;
  // Acumulamos todos los bets nuevos para insertarlos en una única
  // operación al final, en vez de hacer delete+insert por partido (2N
  // round-trips). Sólo se tocan los matches con bets nuevos para
  // preservar la semántica anterior.
  const allNewBets: ValueBetInsert[] = [];
  const touchedMatchIds = new Set<number>();

  for (const match of matches) {
    const xgHome = match.model_expected_goals_home!;
    const xgAway = match.model_expected_goals_away!;
    const leagueId = match.league_id ?? 0;

    // Probabilidades de goles (Poisson + Dixon-Coles)
    const goalProbs = calculateMatchProbabilities(xgHome, xgAway);

    // ── Expectativas por equipo (córners + tarjetas) ─────────────────
    // Si tenemos team_stats con muestra suficiente, las usamos; si no,
    // caemos al promedio por liga.
    const homeStats = match.home_team_id ? teamStatsById.get(match.home_team_id) : undefined;
    const awayStats = match.away_team_id ? teamStatsById.get(match.away_team_id) : undefined;
    const haveTeamCorners =
      homeStats && awayStats &&
      homeStats.matches_sample >= MIN_TEAM_SAMPLE &&
      awayStats.matches_sample >= MIN_TEAM_SAMPLE &&
      homeStats.avg_corners_for != null && homeStats.avg_corners_against != null &&
      awayStats.avg_corners_for != null && awayStats.avg_corners_against != null;
    const haveTeamCards =
      homeStats && awayStats &&
      homeStats.matches_sample >= MIN_TEAM_SAMPLE &&
      awayStats.matches_sample >= MIN_TEAM_SAMPLE &&
      homeStats.avg_yellow_cards != null && awayStats.avg_yellow_cards != null;

    // Córners — combinamos lo que SUELE forzar el local con lo que SUELE
    // conceder el visitante (y viceversa) para una expectativa específica
    // del enfrentamiento. Promedio simple = 0.5*(for_local + against_visit).
    const cornerLeagueAvg = LEAGUE_AVG_CORNERS[leagueId] ?? DEFAULT_CORNERS;
    const cornerHomeExpected = haveTeamCorners
      ? (homeStats!.avg_corners_for! + awayStats!.avg_corners_against!) / 2
      : cornerLeagueAvg.home;
    const cornerAwayExpected = haveTeamCorners
      ? (awayStats!.avg_corners_for! + homeStats!.avg_corners_against!) / 2
      : cornerLeagueAvg.away;
    const cornerProbs = calculateCornerProbabilities(cornerHomeExpected, cornerAwayExpected);

    // Tarjetas — el promedio de amarillas que SUELE recibir cada equipo
    // depende mucho más del estilo del propio equipo que del rival, así
    // que basta con su media.
    const cardLeagueAvg = LEAGUE_AVG_CARDS[leagueId] ?? DEFAULT_CARDS;
    const cardHomeExpected = haveTeamCards ? homeStats!.avg_yellow_cards! : cardLeagueAvg.home;
    const cardAwayExpected = haveTeamCards ? awayStats!.avg_yellow_cards! : cardLeagueAvg.away;
    const cardProbs = calculateCardProbabilities(cardHomeExpected, cardAwayExpected);

    // Para reasoning de córners y tarjetas usamos las expectativas reales
    // (no los averages) — así el mensaje muestra los números que sustentan
    // el cálculo, sean por equipo o por liga.
    const cornerAvg = { home: cornerHomeExpected, away: cornerAwayExpected };
    const cardAvg   = { home: cardHomeExpected,   away: cardAwayExpected   };

    const odds = oddsByMatch.get(match.id);
    if (!odds?.length) continue;

    // ── Pinnacle como referencia de probabilidad fair ────────────────
    // Si Pinnacle cotiza este partido, de-vigamos sus líneas. Luego, para
    // cada bet de una soft book, calculamos edge_pinnacle = price * fair - 1.
    // Es el "edge real" — mucho más fiable que el edge vs Poisson.
    const pinFairMap = pinnacleBookmakerId
      ? pinnacleFairProbs(
          odds
            .filter((o) => o.bookmaker_id === pinnacleBookmakerId)
            .map<PinnacleOdd>((o) => ({
              market: o.market,
              selection: o.selection,
              line: o.line,
              price: o.price,
            })),
        )
      : new Map();

    // ── Sanity check: ¿el modelo concuerda con el consenso del mercado? ──
    // Si nuestro xG produce probabilidades 1x2 muy alejadas de lo que cobran
    // los bookmakers (de-vigado), el xG es ruido — típicamente el fallback
    // de liga aplicado a equipos débiles. Marcamos los mercados derivados
    // de xG como no confiables y solo procesamos córners/tarjetas, que se
    // calculan con team_stats independientes.
    const consensus = marketConsensus1x2(odds);
    const xgUntrustworthy =
      consensus !== null &&
      modelFar1x2(
        { home: goalProbs.home, draw: goalProbs.draw, away: goalProbs.away },
        consensus,
      );

    const bets: ValueBetInsert[] = [];

    for (const o of odds) {
      let modelProb: number | undefined;
      let reasoningCtxHome = xgHome;
      let reasoningCtxAway = xgAway;

      // ── Mercados de goles ─────────────────────────────────────────────────
      const goalKey = `${o.market}:${o.selection}` as GoalMarketKey;
      if (goalKey in GOAL_MARKET_PROB) {
        // Si el xG no concuerda con el mercado, omitimos cualquier mercado
        // derivado de él — la causa del bug "gana o empata Pereira".
        if (xgUntrustworthy && isXgDerivedMarket(o.market)) continue;
        modelProb = GOAL_MARKET_PROB[goalKey](goalProbs);
      }

      // ── Córners ───────────────────────────────────────────────────────────
      else if (o.market === "corners_over_under" && o.line != null) {
        const getter = CORNER_MARKET_PROB[`${o.selection}:${o.line}`];
        if (getter) {
          modelProb = getter(cornerProbs);
          // Pasa los promedios de córners como contexto para el reasoning
          reasoningCtxHome = cornerAvg.home;
          reasoningCtxAway = cornerAvg.away;
        }
      }

      // ── Tarjetas ──────────────────────────────────────────────────────────
      else if (o.market === "cards_over_under" && o.line != null) {
        const getter = CARD_MARKET_PROB[`${o.selection}:${o.line}`];
        if (getter) {
          modelProb = getter(cardProbs);
          reasoningCtxHome = cardAvg.home;
          reasoningCtxAway = cardAvg.away;
        }
      }

      if (modelProb === undefined) continue;

      let result;
      try {
        result = detectValueBet({
          modelProb,
          decimalOdds: o.price,
          maxEdge: MAX_EDGE_REASONABLE,
        });
      } catch {
        continue;
      }
      if (!result.isValue) continue;

      // Enriquecer con benchmark de Pinnacle si está disponible. No filtra
      // el bet: lo persiste para que la UI y los análisis posteriores
      // puedan ponderar bets por edge_pinnacle (CLV anticipado).
      let pinnacleFairProb: number | null = null;
      let edgePinnacle: number | null = null;
      if (pinnacleBookmakerId && o.bookmaker_id !== pinnacleBookmakerId) {
        const fair = pinFairMap.get(pinnacleFairKey(o.market, o.selection, o.line));
        if (fair != null) {
          pinnacleFairProb = fair;
          edgePinnacle = pinnacleEdge(o.price, fair);
        }
      }

      bets.push({
        match_id: match.id,
        bookmaker_id: o.bookmaker_id,
        market: o.market as ValueBetInsert["market"],
        selection: o.selection,
        // line es crítico para córners/tarjetas — sin él no se puede resolver
        // el bet al final del partido (no sabemos qué línea era).
        line: o.line ?? null,
        price: o.price,
        implied_prob: result.impliedProb,
        model_prob: modelProb,
        edge: result.edge,
        kelly_fraction: result.kelly,
        confidence: result.confidence,
        pinnacle_fair_prob: pinnacleFairProb,
        edge_pinnacle: edgePinnacle,
        result: "pending" as const,
        // Bets con edge muy alto (>6%) son visibles gratis; las moderadas son premium
        is_premium: result.edge < 0.06,
        // Apuesta sugerida: prob. del modelo ≥ 65% y cuota ≥ 1.40
        is_suggested: modelProb >= 0.65 && o.price >= 1.40,
        reasoning: buildReasoning(
          o.market,
          o.selection,
          modelProb,
          result.impliedProb,
          result.edge,
          reasoningCtxHome,
          reasoningCtxAway,
          o.line,
        ),
      });
    }

    if (bets.length) {
      touchedMatchIds.add(match.id);
      allNewBets.push(...bets);
    }
  }

  // Reemplazo atómico-por-batch: un único delete (todos los matches tocados)
  // + un único insert. PostgREST procesa ambos como bulk → ms en vez de
  // segundos para crons con muchos partidos.
  if (touchedMatchIds.size > 0) {
    const safeIds = [...touchedMatchIds]
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    if (safeIds.length > 0) {
      await supabase
        .from("value_bets")
        .delete()
        .in("match_id", safeIds)
        .eq("result", "pending");
    }
    const { error: insErr } = await supabase.from("value_bets").insert(allNewBets);
    if (!insErr) detected = allNewBets.length;
  }

  // Notificar por Telegram si se detectaron value bets nuevas
  if (detected > 0) {
    const msg =
      `🎯 <b>${detected} value bet${detected > 1 ? "s" : ""} nueva${detected > 1 ? "s" : ""}</b> detectada${detected > 1 ? "s" : ""}.\n\n` +
      `Entra a elparley.com/value-bets para verla${detected > 1 ? "s" : ""}.`;
    await notifyProUsers(msg, "value_bets");
  }

  return NextResponse.json({
    ok: true,
    matchesScanned: matches.length,
    valueBetsDetected: detected,
    timestamp: now.toISOString(),
  });
}
