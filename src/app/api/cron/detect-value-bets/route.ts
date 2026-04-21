import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  calculateMatchProbabilities,
  calculateCornerProbabilities,
  calculateCardProbabilities,
  calculateHandicapProbability,
  type CornerProbabilities,
  type CardProbabilities,
} from "@/lib/betting/poisson";
import { detectValueBet, buildReasoning } from "@/lib/betting/value-bet";
import {
  LEAGUE_AVG_CORNERS,
  LEAGUE_AVG_CARDS,
  DEFAULT_CORNERS,
  DEFAULT_CARDS,
} from "@/lib/betting/stats";
import { HIGH_PRIORITY_LEAGUE_IDS } from "@/lib/api/api-football";
import { notifyProUsers } from "@/lib/telegram/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron — corre cada 10 minutos (schedule: cada 10 min en vercel.json).
 *
 * Mercados soportados:
 *  - Goles: 1x2, over/under 1.5/2.5/3.5, BTTS, doble oportunidad
 *  - Córners: over/under 8.5/9.5/10.5 (modelo Poisson con medias por liga)
 *  - Tarjetas: over/under 3.5/4.5 (modelo Poisson con medias por liga)
 *  - Hándicap asiático: líneas X.5 derivadas de la matriz de marcadores
 *
 * Exclusión: matches de HIGH_PRIORITY_LEAGUE_IDS con kickoff en <2h son
 * manejados por sync-live-odds (cada 5 min) para evitar race conditions en
 * el delete+insert de value_bets.
 */

// ── Mercados de goles ─────────────────────────────────────────────────────────

type GoalMarketKey =
  | "1x2:home" | "1x2:draw" | "1x2:away"
  | "over_under_1_5:over" | "over_under_1_5:under"
  | "over_under_2_5:over" | "over_under_2_5:under"
  | "over_under_3_5:over" | "over_under_3_5:under"
  | "btts:yes" | "btts:no"
  | "double_chance:1x" | "double_chance:12" | "double_chance:x2";

type GoalProbs = ReturnType<typeof calculateMatchProbabilities>;

const GOAL_MARKET_PROB: Record<GoalMarketKey, (p: GoalProbs) => number> = {
  "1x2:home":             (p) => p.home,
  "1x2:draw":             (p) => p.draw,
  "1x2:away":             (p) => p.away,
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
    .select("id, league_id, model_expected_goals_home, model_expected_goals_away")
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

  let detected = 0;

  for (const match of matches) {
    const xgHome = match.model_expected_goals_home!;
    const xgAway = match.model_expected_goals_away!;
    const leagueId = match.league_id ?? 0;

    // Probabilidades de goles (Poisson + Dixon-Coles)
    const goalProbs = calculateMatchProbabilities(xgHome, xgAway);

    // Probabilidades de córners (Poisson con medias históricas por liga)
    const cornerAvg = LEAGUE_AVG_CORNERS[leagueId] ?? DEFAULT_CORNERS;
    const cornerProbs = calculateCornerProbabilities(cornerAvg.home, cornerAvg.away);

    // Probabilidades de tarjetas (Poisson con medias históricas por liga)
    const cardAvg = LEAGUE_AVG_CARDS[leagueId] ?? DEFAULT_CARDS;
    const cardProbs = calculateCardProbabilities(cardAvg.home, cardAvg.away);

    const { data: odds } = await supabase
      .from("odds")
      .select("id, bookmaker_id, market, selection, price, line")
      .eq("match_id", match.id);

    if (!odds?.length) continue;

    const bets = [];

    for (const o of odds) {
      let modelProb: number | undefined;
      let reasoningCtxHome = xgHome;
      let reasoningCtxAway = xgAway;

      // ── Mercados de goles ─────────────────────────────────────────────────
      const goalKey = `${o.market}:${o.selection}` as GoalMarketKey;
      if (goalKey in GOAL_MARKET_PROB) {
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

      // ── Hándicap asiático (solo líneas .5) ────────────────────────────────
      else if (o.market === "asian_handicap" && o.line != null) {
        const side = o.selection as "home" | "away";
        modelProb = calculateHandicapProbability(xgHome, xgAway, side, o.line);
      }

      if (modelProb === undefined) continue;

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
