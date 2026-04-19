import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchOddsForFixtures } from "@/lib/api/api-football";
import { HIGH_PRIORITY_LEAGUE_IDS } from "@/lib/api/api-football";
import { calculateMatchProbabilities } from "@/lib/betting/poisson";
import { detectValueBet, buildReasoning } from "@/lib/betting/value-bet";
import { notifyAdminError } from "@/lib/telegram/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fast cron — runs every 5 minutes.
 *
 * Purpose: serve high-traffic events (clásicos, Champions knock-outs, World Cup)
 * where odds move every 30-60 seconds and 10,000+ users may hit the same match page.
 *
 * Scope: only processes "hot" matches to preserve the 100 req/day API-Football budget:
 *  - Currently live matches (any league)
 *  - Matches kicking off within the next 2 hours from HIGH_PRIORITY_LEAGUE_IDS
 *
 * After updating odds it:
 *  1. Runs value-bet detection inline (no waiting for the 10-min detect cron)
 *  2. Calls revalidatePath(`/partido/{id}`) to bust the Next.js cache for those pages
 *
 * The regular sync-odds cron (@10min) continues to handle the rest of the schedule.
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

  // Hot matches: live (any league) OR imminent kick-off in a priority league
  const { data: hotMatches, error } = await supabase
    .from("matches")
    .select("id, league_id, model_expected_goals_home, model_expected_goals_away, status")
    .or(
      [
        "status.eq.live",
        `and(status.eq.scheduled,kickoff.gte.${now.toISOString()},kickoff.lte.${in2h.toISOString()})`,
      ].join(","),
    )
    .in("league_id", HIGH_PRIORITY_LEAGUE_IDS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!hotMatches?.length) {
    return NextResponse.json({ ok: true, hotMatches: 0, timestamp: now.toISOString() });
  }

  let oddsUpserted = 0;
  let valueBetsDetected = 0;
  const revalidated: number[] = [];

  // Process all hot matches concurrently — urgency > rate-limit politeness here.
  // API-Football allows short bursts; hot matches are at most ~8-12 at once.
  const results = await Promise.allSettled(
    hotMatches.map(async (m) => {
      // ── 1. Fetch + upsert latest odds ───────────────────────────
      const odds = await fetchOddsForFixtures(m.id);
      if (odds.length) {
        const { error: upErr } = await supabase.from("odds").upsert(odds, {
          onConflict: "match_id,bookmaker_id,market,selection,line",
        });
        if (upErr) throw upErr;
      }

      // ── 2. Inline value-bet detection ──────────────────────────
      // Only possible if xG data is loaded (sync-fixtures populates this)
      let newBets = 0;
      if (m.model_expected_goals_home != null && m.model_expected_goals_away != null) {
        const probs = calculateMatchProbabilities(
          m.model_expected_goals_home,
          m.model_expected_goals_away,
        );

        const { data: currentOdds } = await supabase
          .from("odds")
          .select("id, bookmaker_id, market, selection, price")
          .eq("match_id", m.id);

        if (currentOdds?.length) {
          const bets = [];
          for (const o of currentOdds) {
            const key = `${o.market}:${o.selection}` as MarketKey;
            const probGetter = MARKET_PROB[key];
            if (!probGetter) continue;

            let result;
            try {
              result = detectValueBet({ modelProb: probGetter(probs), decimalOdds: o.price });
            } catch {
              continue;
            }
            if (!result.isValue) continue;

            const modelProb = probGetter(probs);
            bets.push({
              match_id: m.id,
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
              is_premium: result.edge < 0.06,
              reasoning: buildReasoning(o.market, o.selection, modelProb, result.impliedProb, result.edge, m.model_expected_goals_home!, m.model_expected_goals_away!),
            });
          }

          if (bets.length) {
            await supabase
              .from("value_bets")
              .delete()
              .eq("match_id", m.id)
              .eq("result", "pending");

            const { error: insErr } = await supabase.from("value_bets").insert(bets);
            if (!insErr) newBets = bets.length;
          }
        }
      }

      // ── 3. Bust Next.js route cache for this match's pages ────
      revalidatePath(`/partido/${m.id}`);

      return { matchId: m.id, odds: odds.length, newBets };
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled") {
      oddsUpserted += r.value.odds;
      valueBetsDetected += r.value.newBets;
      revalidated.push(r.value.matchId);
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error("[sync-live-odds] match failed:", r.reason);
      await notifyAdminError("sync-live-odds", msg);
    }
  }

  return NextResponse.json({
    ok: true,
    hotMatches: hotMatches.length,
    oddsUpserted,
    valueBetsDetected,
    revalidated,
    timestamp: now.toISOString(),
  });
}
