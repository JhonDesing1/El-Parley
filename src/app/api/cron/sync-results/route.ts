import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchFixtureById } from "@/lib/api/api-football";
import { sendTelegramMessage, notifyAdminError } from "@/lib/telegram/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron — runs every 30 minutes.
 *
 * Resolves match scores and settles open value_bets + user_picks once
 * matches finish. Without this cron, picks and value bets stay "pending"
 * forever and the leaderboard/ROI stats are meaningless.
 *
 * Scope per run:
 *  - Live matches (any league)
 *  - Scheduled matches whose kickoff was >105 min ago (should be over)
 */

function resolveOutcome(
  market: string,
  selection: string,
  homeScore: number,
  awayScore: number,
): "won" | "lost" {
  const key = `${market}:${selection}`;
  switch (key) {
    case "1x2:home":               return homeScore > awayScore ? "won" : "lost";
    case "1x2:draw":               return homeScore === awayScore ? "won" : "lost";
    case "1x2:away":               return awayScore > homeScore ? "won" : "lost";
    case "over_under_2_5:over":    return homeScore + awayScore >= 3 ? "won" : "lost";
    case "over_under_2_5:under":   return homeScore + awayScore <= 2 ? "won" : "lost";
    case "btts:yes":               return homeScore > 0 && awayScore > 0 ? "won" : "lost";
    case "btts:no":                return homeScore === 0 || awayScore === 0 ? "won" : "lost";
    default:                       return "lost";
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // Matches that are live OR should already be over (kicked off >105 min ago)
  const staleThreshold = new Date(now.getTime() - 105 * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from("matches")
    .select("id, status, home_score, away_score")
    .or(
      [
        "status.eq.live",
        `and(status.eq.scheduled,kickoff.lte.${staleThreshold})`,
      ].join(","),
    )
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!candidates?.length) {
    return NextResponse.json({ ok: true, matchesChecked: 0, settled: 0, timestamp: now.toISOString() });
  }

  let settled = 0;
  let matchesUpdated = 0;

  // Acumula notificaciones de picks resueltos para enviar al final
  const pickNotifications: Array<{ userId: string; text: string }> = [];

  const results = await Promise.allSettled(
    candidates.map(async (match) => {
      const fixture = await fetchFixtureById(match.id);
      if (!fixture) return { matchId: match.id, settled: 0 };

      // Always upsert latest status + score
      await supabase
        .from("matches")
        .update({
          status: fixture.status,
          minute: fixture.minute,
          home_score: fixture.home_score,
          away_score: fixture.away_score,
          home_score_ht: fixture.home_score_ht,
          away_score_ht: fixture.away_score_ht,
        })
        .eq("id", match.id);

      // Only resolve bets when match is definitively over
      const isVoid = fixture.status === "postponed" || fixture.status === "canceled";
      const isFinished = fixture.status === "finished";

      if (!isFinished && !isVoid) return { matchId: match.id, settled: 0 };

      const homeScore = fixture.home_score ?? 0;
      const awayScore = fixture.away_score ?? 0;
      let betsSettled = 0;

      // ── Resolve value_bets ─────────────────────────────────────
      const { data: pendingBets } = await supabase
        .from("value_bets")
        .select("id, market, selection")
        .eq("match_id", match.id)
        .eq("result", "pending");

      if (pendingBets?.length) {
        for (const bet of pendingBets) {
          const result = isVoid
            ? "void"
            : resolveOutcome(bet.market, bet.selection, homeScore, awayScore);

          await supabase
            .from("value_bets")
            .update({ result })
            .eq("id", bet.id);

          betsSettled++;
        }
      }

      // ── Resolve user_picks ─────────────────────────────────────
      const { data: pendingPicks } = await supabase
        .from("user_picks")
        .select("id, user_id, market, selection, stake, odds")
        .eq("match_id", match.id)
        .eq("result", "pending");

      if (pendingPicks?.length) {
        for (const pick of pendingPicks) {
          const result = isVoid
            ? ("void" as const)
            : resolveOutcome(pick.market, pick.selection, homeScore, awayScore);

          const profitLoss =
            result === "void" || pick.stake == null
              ? null
              : result === "won"
                ? Number(pick.stake) * (Number(pick.odds) - 1)
                : -Number(pick.stake);

          await supabase
            .from("user_picks")
            .update({ result, resolved_at: now.toISOString(), profit_loss: profitLoss })
            .eq("id", pick.id);

          betsSettled++;

          if (result !== "void" && pick.user_id) {
            const emoji = result === "won" ? "✅" : "❌";
            const plText =
              profitLoss != null
                ? ` (${profitLoss >= 0 ? "+" : ""}${profitLoss.toFixed(2)} u.)`
                : "";
            pickNotifications.push({
              userId: pick.user_id,
              text: `${emoji} <b>Pick resuelto: ${result === "won" ? "GANADO" : "PERDIDO"}</b>${plText}\n\nVe tu historial en elparley.com/picks`,
            });
          }
        }
      }

      // ── Resolve parlay_legs ────────────────────────────────────
      const { data: pendingParlayLegs } = await supabase
        .from("parlay_legs")
        .select("id, parlay_id, market, selection")
        .eq("match_id", match.id)
        .eq("result", "pending");

      if (pendingParlayLegs?.length) {
        for (const leg of pendingParlayLegs) {
          const result = isVoid
            ? "void"
            : resolveOutcome(leg.market, leg.selection, homeScore, awayScore);

          await supabase
            .from("parlay_legs")
            .update({ result })
            .eq("id", leg.id);

          betsSettled++;
        }

        // Check each affected parlay to see if all legs are now resolved
        const affectedParlayIds = [
          ...new Set(pendingParlayLegs.map((l) => l.parlay_id)),
        ];

        for (const parlayId of affectedParlayIds) {
          const { data: allLegs } = await supabase
            .from("parlay_legs")
            .select("result")
            .eq("parlay_id", parlayId);

          if (!allLegs?.length) continue;

          const hasPending = allLegs.some((l) => l.result === "pending");
          if (hasPending) continue; // Not fully settled yet

          const hasLost = allLegs.some((l) => l.result === "lost");
          const hasVoid = allLegs.some((l) => l.result === "void");
          const allWon = allLegs.every((l) => l.result === "won");

          // Standard parlay settlement:
          // - any lost leg → parlay lost
          // - all won → parlay won
          // - void legs + won legs → partial (odds recalculated without void legs)
          // - all void → void
          let parlayStatus: "won" | "lost" | "void" | "partial";
          if (allWon) {
            parlayStatus = "won";
          } else if (hasLost) {
            parlayStatus = "lost";
          } else if (hasVoid && !hasLost) {
            const nonVoid = allLegs.filter((l) => l.result !== "void");
            parlayStatus = nonVoid.length === 0 ? "void" : "partial";
          } else {
            parlayStatus = "void";
          }

          await supabase
            .from("parlays")
            .update({
              status: parlayStatus,
              result_updated_at: now.toISOString(),
            })
            .eq("id", parlayId);
        }
      }

      return { matchId: match.id, settled: betsSettled };
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled") {
      matchesUpdated++;
      settled += r.value.settled;
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error("[sync-results] fixture failed:", r.reason);
      await notifyAdminError("sync-results", msg);
    }
  }

  // Enviar notificaciones de picks resueltos a usuarios Pro con tg_results=true
  if (pickNotifications.length > 0) {
    const userIds = [...new Set(pickNotifications.map((n) => n.userId))];

    const { data: proProfiles } = await supabase
      .from("profiles")
      .select("id, telegram_chat_id")
      .in("id", userIds)
      .not("telegram_chat_id", "is", null)
      .eq("tg_results", true);

    if (proProfiles?.length) {
      const { data: activeSubs } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("tier", "pro")
        .in("status", ["active", "trialing"])
        .in("user_id", proProfiles.map((p) => p.id));

      const proIds = new Set((activeSubs ?? []).map((s) => s.user_id));
      const chatMap = new Map(
        proProfiles
          .filter((p) => proIds.has(p.id))
          .map((p) => [p.id, p.telegram_chat_id!]),
      );

      await Promise.allSettled(
        pickNotifications
          .filter((n) => chatMap.has(n.userId))
          .map((n) => sendTelegramMessage(chatMap.get(n.userId)!, n.text)),
      );
    }
  }

  return NextResponse.json({
    ok: true,
    matchesChecked: candidates.length,
    matchesUpdated,
    settled,
    timestamp: now.toISOString(),
  });
}
