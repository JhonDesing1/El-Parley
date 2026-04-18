import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { calculateMatchProbabilities } from "@/lib/betting/poisson";
import { detectValueBet } from "@/lib/betting/value-bet";
import { HIGH_PRIORITY_LEAGUE_IDS } from "@/lib/api/api-football";
import { notifyProUsers } from "@/lib/telegram/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron — corre cada 10 minutos.
 *
 * Lógica:
 *  1. Lee partidos próximos 48h con xG cargado
 *  2. Calcula probabilidades Poisson + Dixon-Coles con la lib de betting
 *  3. Compara contra cada cuota disponible
 *  4. Si edge >= 3% escribe en value_bets (borra pendientes del mismo partido antes)
 *
 * Exclusión: matches de HIGH_PRIORITY_LEAGUE_IDS con kickoff en <2h son
 * manejados por sync-live-odds (cada 5 min) para evitar race conditions en
 * el delete+insert de value_bets.
 */

type MarketKey =
  | "1x2:home"
  | "1x2:draw"
  | "1x2:away"
  | "over_under_2_5:over"
  | "over_under_2_5:under"
  | "btts:yes"
  | "btts:no";

type MatchProbs = ReturnType<typeof calculateMatchProbabilities>;

const MARKET_PROB: Record<MarketKey, (p: MatchProbs) => number> = {
  "1x2:home": (p) => p.home,
  "1x2:draw": (p) => p.draw,
  "1x2:away": (p) => p.away,
  "over_under_2_5:over": (p) => p.over25,
  "over_under_2_5:under": (p) => p.under25,
  "btts:yes": (p) => p.btts,
  "btts:no": (p) => p.noBtts,
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 3600 * 1000);
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

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
    .select("id, model_expected_goals_home, model_expected_goals_away")
    .gte("kickoff", now.toISOString())
    .lte("kickoff", in48h.toISOString())
    .eq("status", "scheduled")
    .not("model_expected_goals_home", "is", null);

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data: matches, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!matches?.length) {
    return NextResponse.json({ ok: true, matchesScanned: 0, valueBetsDetected: 0, timestamp: now.toISOString() });
  }

  let detected = 0;

  for (const match of matches) {
    const probs = calculateMatchProbabilities(
      match.model_expected_goals_home!,
      match.model_expected_goals_away!,
    );

    const { data: odds } = await supabase
      .from("odds")
      .select("id, bookmaker_id, market, selection, price")
      .eq("match_id", match.id);

    if (!odds?.length) continue;

    const bets = [];
    for (const o of odds) {
      const key = `${o.market}:${o.selection}` as MarketKey;
      const probGetter = MARKET_PROB[key];
      if (!probGetter) continue;

      const modelProb = probGetter(probs);

      let result;
      try {
        result = detectValueBet({ modelProb, decimalOdds: o.price });
      } catch {
        continue;
      }
      if (!result.isValue) continue;

      bets.push({
        match_id: match.id,
        bookmaker_id: o.bookmaker_id,
        market: o.market,
        selection: o.selection,
        price: o.price,
        implied_prob: result.impliedProb,
        model_prob: modelProb,
        edge: result.edge,
        kelly_fraction: result.kelly,
        confidence: result.confidence,
        // Las de edge muy alto (>6%) son visibles gratis; las moderadas son premium
        is_premium: result.edge < 0.06,
        reasoning: `Modelo estima ${(modelProb * 100).toFixed(0)}% vs ${(result.impliedProb * 100).toFixed(0)}% implícita. Edge +${(result.edge * 100).toFixed(1)}%.`,
      });
    }

    if (bets.length) {
      await supabase
        .from("value_bets")
        .delete()
        .eq("match_id", match.id)
        .eq("result", "pending");

      const { error: insErr } = await supabase.from("value_bets").insert(bets);
      if (!insErr) detected += bets.length;
    }
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
