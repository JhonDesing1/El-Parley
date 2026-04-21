import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/db-status?secret=CRON_SECRET
 * Muestra el estado real de los datos en la BD — útil para diagnosticar
 * por qué no se muestran picks en la home page.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const now = new Date().toISOString();
  const in48h = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const in7d  = new Date(Date.now() + 7  * 24 * 3600 * 1000).toISOString();

  const [
    { count: leaguesFeatured },
    { count: matchesTotal },
    { count: matchesScheduled },
    { count: matchesWithXg },
    { count: matchesNoXg },
    { count: oddsTotal },
    { count: oddsRecent },
    { count: valueBetsTotal },
    { count: valueBetsPending },
    { count: valueBetsFree },
    { count: valueBetsSuggested },
    { count: valueBetsPremium },
    { count: valueBetsFutureKickoff },
    { data: sampleBets },
    { data: sampleMatches },
  ] = await Promise.all([
    db.from("leagues").select("*", { count: "exact", head: true }).eq("is_featured", true),
    db.from("matches").select("*", { count: "exact", head: true }),
    db.from("matches").select("*", { count: "exact", head: true }).eq("status", "scheduled").gte("kickoff", now),
    db.from("matches").select("*", { count: "exact", head: true }).eq("status", "scheduled").gte("kickoff", now).not("model_expected_goals_home", "is", null),
    db.from("matches").select("*", { count: "exact", head: true }).eq("status", "scheduled").gte("kickoff", now).is("model_expected_goals_home", null),
    db.from("odds").select("*", { count: "exact", head: true }),
    db.from("odds").select("*", { count: "exact", head: true }).gte("updated_at", new Date(Date.now() - 2 * 3600 * 1000).toISOString()),
    db.from("value_bets").select("*", { count: "exact", head: true }),
    db.from("value_bets").select("*", { count: "exact", head: true }).eq("result", "pending"),
    db.from("value_bets").select("*", { count: "exact", head: true }).eq("result", "pending").eq("is_premium", false),
    db.from("value_bets").select("*", { count: "exact", head: true }).eq("result", "pending").eq("is_suggested", true),
    db.from("value_bets").select("*", { count: "exact", head: true }).eq("result", "pending").eq("is_premium", true),
    db.from("value_bets").select("*", { count: "exact", head: true }).eq("result", "pending").gte("match.kickoff" as any, now),
    db.from("value_bets").select("id, market, selection, price, model_prob, edge, is_premium, is_suggested, result, detected_at").eq("result", "pending").order("detected_at", { ascending: false }).limit(5),
    db.from("matches").select("id, kickoff, status, model_expected_goals_home, model_expected_goals_away").eq("status", "scheduled").gte("kickoff", now).lte("kickoff", in48h).order("kickoff", { ascending: true }).limit(5),
  ]);

  return NextResponse.json({
    timestamp: now,
    leagues: { featured: leaguesFeatured },
    matches: {
      total: matchesTotal,
      scheduled_future: matchesScheduled,
      with_xg: matchesWithXg,
      missing_xg: matchesNoXg,
      sample_next_48h: sampleMatches,
    },
    odds: {
      total: oddsTotal,
      updated_last_2h: oddsRecent,
    },
    value_bets: {
      total: valueBetsTotal,
      pending: valueBetsPending,
      pending_free: valueBetsFree,
      pending_suggested: valueBetsSuggested,
      pending_premium: valueBetsPremium,
      pending_future_kickoff: valueBetsFutureKickoff,
      sample_pending: sampleBets,
    },
    diagnosis: {
      has_featured_leagues: (leaguesFeatured ?? 0) > 0,
      has_scheduled_matches: (matchesScheduled ?? 0) > 0,
      has_xg_data: (matchesWithXg ?? 0) > 0,
      has_odds: (oddsTotal ?? 0) > 0,
      has_value_bets: (valueBetsPending ?? 0) > 0,
      public_can_see: (valueBetsFree ?? 0) + (valueBetsSuggested ?? 0),
      problem: (valueBetsPending ?? 0) === 0
        ? "NO HAY VALUE BETS — crons no han corrido o no hay odds/xG"
        : (valueBetsFree ?? 0) + (valueBetsSuggested ?? 0) === 0
          ? "TODAS LAS VALUE BETS SON PREMIUM Y NO SUGERIDAS — RLS las bloquea para usuarios anónimos (fix: aplicar migración 00013)"
          : "OK — hay picks visibles para usuarios anónimos",
    },
  }, { status: 200 });
}
