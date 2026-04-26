import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  fetchFixtureById,
  fetchFixtureStatistics,
  type FixtureStatistics,
} from "@/lib/api/api-football";
import { sendTelegramMessage, notifyAdminError } from "@/lib/telegram/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron — runs every 30 minutes.
 *
 * Resolves match scores and settles open value_bets + tipster_picks +
 * user_picks once matches finish. Without this cron, picks and value bets
 * stay "pending" forever and the leaderboard/ROI stats are meaningless.
 *
 * Scope per run:
 *  - Live matches (any league)
 *  - Scheduled matches whose kickoff was >105 min ago (should be over)
 *
 * Auto-resolution of tipster_picks only applies to recognized market/selection
 * combos (1x2, over_under_2_5, btts). Others stay pending for manual resolution.
 */

type MatchStats = Pick<FixtureStatistics, "totalCorners" | "totalYellowCards">;

/**
 * Devuelve el resultado de la apuesta dado el marcador final + stats
 * opcionales del partido. Devuelve `null` si el mercado no se puede
 * resolver con los datos disponibles (p. ej. córners sin stats).
 *
 * Devolver `null` evita marcar como "perdido" un bet que podría haber
 * ganado: el bet queda pendiente para reintentar en la próxima ejecución.
 *
 * Para over/under con líneas .5 (sin push), una línea X.5 requiere
 * `total ≥ ceil(X.5)` para que gane "over".
 */
function resolveOutcome(
  market: string,
  selection: string,
  homeScore: number,
  awayScore: number,
  line: number | null | undefined,
  stats: MatchStats | null,
): "won" | "lost" | null {
  const total = homeScore + awayScore;
  const key = `${market}:${selection}`;
  switch (key) {
    // 1x2 — legacy, ya no generamos pero puede haber bets viejos pendientes
    case "1x2:home":               return homeScore > awayScore ? "won" : "lost";
    case "1x2:draw":               return homeScore === awayScore ? "won" : "lost";
    case "1x2:away":               return awayScore > homeScore ? "won" : "lost";

    // Cantidad de goles
    case "over_under_1_5:over":    return total >= 2 ? "won" : "lost";
    case "over_under_1_5:under":   return total <= 1 ? "won" : "lost";
    case "over_under_2_5:over":    return total >= 3 ? "won" : "lost";
    case "over_under_2_5:under":   return total <= 2 ? "won" : "lost";
    case "over_under_3_5:over":    return total >= 4 ? "won" : "lost";
    case "over_under_3_5:under":   return total <= 3 ? "won" : "lost";

    // Eventos del partido
    case "btts:yes":               return homeScore > 0 && awayScore > 0 ? "won" : "lost";
    case "btts:no":                return homeScore === 0 || awayScore === 0 ? "won" : "lost";
    case "double_chance:1x":       return homeScore >= awayScore ? "won" : "lost";
    case "double_chance:12":       return homeScore !== awayScore ? "won" : "lost";
    case "double_chance:x2":       return awayScore >= homeScore ? "won" : "lost";
  }

  // ── Córners (requiere stats del partido) ────────────────────────
  if (market === "corners_over_under" && line != null) {
    if (stats?.totalCorners == null) return null;
    const totalCorners = stats.totalCorners;
    if (selection === "over")  return totalCorners > line ? "won" : "lost";
    if (selection === "under") return totalCorners < line ? "won" : "lost";
    return null;
  }

  // ── Tarjetas amarillas (requiere stats del partido) ─────────────
  if (market === "cards_over_under" && line != null) {
    if (stats?.totalYellowCards == null) return null;
    const totalCards = stats.totalYellowCards;
    if (selection === "over")  return totalCards > line ? "won" : "lost";
    if (selection === "under") return totalCards < line ? "won" : "lost";
    return null;
  }

  return null;
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
    .select("id, status, home_score, away_score, home_team_id, away_team_id")
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

      // Stats del partido (córners + amarillas) — se cargan perezosamente
      // solo si encontramos bets pendientes en mercados que las requieren,
      // para no quemar requests del API en partidos sin bets de córners/cards.
      // Cuando se cargan, se persiste también en match_stats para que el cron
      // diario sync-team-stats pueda calcular medias rodantes por equipo.
      let matchStats: MatchStats | null = null;
      let statsAttempted = false;
      const ensureStats = async (): Promise<MatchStats | null> => {
        if (statsAttempted) return matchStats;
        statsAttempted = true;
        if (isVoid) return null; // partido cancelado: no hay stats que pedir
        try {
          const full = await fetchFixtureStatistics(match.id);
          matchStats = full;

          if (full && match.home_team_id && match.away_team_id) {
            const home = full.perTeam.find((t) => t.teamId === match.home_team_id);
            const away = full.perTeam.find((t) => t.teamId === match.away_team_id);
            if (home || away) {
              await supabase.from("match_stats").upsert(
                {
                  match_id: match.id,
                  home_corners: home?.corners ?? null,
                  away_corners: away?.corners ?? null,
                  home_yellow_cards: home?.yellowCards ?? null,
                  away_yellow_cards: away?.yellowCards ?? null,
                  home_red_cards: home?.redCards ?? null,
                  away_red_cards: away?.redCards ?? null,
                  fetched_at: new Date().toISOString(),
                },
                { onConflict: "match_id" },
              );
            }
          }
        } catch (e) {
          console.error("[sync-results] stats failed for", match.id, e);
          matchStats = null;
        }
        return matchStats;
      };

      // ── Resolve value_bets ─────────────────────────────────────
      const { data: pendingBets } = await supabase
        .from("value_bets")
        .select("id, market, selection, line")
        .eq("match_id", match.id)
        .eq("result", "pending");

      if (pendingBets?.length) {
        const needsStats = pendingBets.some(
          (b) => b.market === "corners_over_under" || b.market === "cards_over_under",
        );
        if (needsStats) await ensureStats();

        for (const bet of pendingBets) {
          let result: "won" | "lost" | "void" | null;
          if (isVoid) result = "void";
          else result = resolveOutcome(bet.market, bet.selection, homeScore, awayScore, bet.line, matchStats);

          if (result === null) continue; // mercado no resoluble — reintentar después

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
        .select("id, user_id, market, selection, line, stake, odds")
        .eq("match_id", match.id)
        .eq("result", "pending");

      if (pendingPicks?.length) {
        const needsStats = pendingPicks.some(
          (p) => p.market === "corners_over_under" || p.market === "cards_over_under",
        );
        if (needsStats) await ensureStats();

        for (const pick of pendingPicks) {
          let result: "won" | "lost" | "void" | null;
          if (isVoid) result = "void";
          else result = resolveOutcome(pick.market, pick.selection, homeScore, awayScore, pick.line, matchStats);

          if (result === null) continue;

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

      // ── Resolve tipster_picks ──────────────────────────────────
      // Only auto-resolves picks linked to a match (match_id set) with
      // recognized market/selection combos. Unrecognized combos stay
      // pending so the admin can resolve them manually.
      const KNOWN_COMBOS = new Set([
        "1x2:home", "1x2:draw", "1x2:away",
        "over_under_2_5:over", "over_under_2_5:under",
        "btts:yes", "btts:no",
      ]);

      const { data: pendingTipsterPicks } = await supabase
        .from("tipster_picks")
        .select("id, market, selection")
        .eq("match_id", match.id)
        .eq("result", "pending");

      if (pendingTipsterPicks?.length) {
        for (const pick of pendingTipsterPicks) {
          const combo = `${pick.market}:${pick.selection}`;
          if (!KNOWN_COMBOS.has(combo)) continue; // leave for manual resolution

          let result: "won" | "lost" | "void" | null;
          if (isVoid) result = "void";
          // tipster_picks no tiene columna `line` — solo se auto-resuelven combos
          // de la lista KNOWN_COMBOS (goles/btts), que no la necesitan.
          else result = resolveOutcome(pick.market, pick.selection, homeScore, awayScore, null, null);

          if (result === null) continue;

          await supabase
            .from("tipster_picks")
            .update({ result })
            .eq("id", pick.id);

          betsSettled++;
        }
      }

      // ── Resolve parlay_legs ────────────────────────────────────
      const { data: pendingParlayLegs } = await supabase
        .from("parlay_legs")
        .select("id, parlay_id, market, selection, line")
        .eq("match_id", match.id)
        .eq("result", "pending");

      if (pendingParlayLegs?.length) {
        const needsStats = pendingParlayLegs.some(
          (l) => l.market === "corners_over_under" || l.market === "cards_over_under",
        );
        if (needsStats) await ensureStats();

        for (const leg of pendingParlayLegs) {
          let result: "won" | "lost" | "void" | null;
          if (isVoid) result = "void";
          else result = resolveOutcome(leg.market, leg.selection, homeScore, awayScore, leg.line, matchStats);

          if (result === null) continue;

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
