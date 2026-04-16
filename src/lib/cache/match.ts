/**
 * Cached Supabase data fetchers for match detail pages.
 *
 * Strategy: use Next.js unstable_cache with per-match tags so that after a
 * cron run updates odds/value_bets for a specific match, only that match's
 * cache entries are revalidated via revalidatePath(`/partido/${id}`) from cron routes.
 *
 * TTL hierarchy:
 *  - odds / value_bets  → 60s  (change every cron tick)
 *  - match metadata      → 120s (status changes less frequently)
 *  - injuries / news     → 300s (rarely changes mid-day)
 *
 * All fetchers use the admin client (bypasses RLS) because:
 *  - matches, odds, injuries, news → public by RLS anyway
 *  - value_bets → split into free/premium so RLS is replicated manually
 *
 * The match page is responsible for checking isPremiumUser() and deciding
 * which value bets to show.
 */

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchInjuriesForFixture } from "@/lib/api/api-football";

// ─── Match metadata ───────────────────────────────────────────────────────────

export function getCachedMatchData(matchId: number) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("matches")
        .select(
          "*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), league:leagues(*)",
        )
        .eq("id", matchId)
        .single();
      return data;
    },
    [`match-data-${matchId}`],
    { revalidate: 120, tags: [`match-${matchId}`, "matches"] },
  )();
}

export function getCachedMatchMeta(matchId: number) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("matches")
        .select(
          "kickoff, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name), league:leagues(name)",
        )
        .eq("id", matchId)
        .single();
      return data;
    },
    [`match-meta-${matchId}`],
    { revalidate: 300, tags: [`match-${matchId}`, "matches"] },
  )();
}

// ─── Odds ─────────────────────────────────────────────────────────────────────

export function getCachedMatchOdds(matchId: number) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("odds")
        .select("*, bookmaker:bookmakers(*)")
        .eq("match_id", matchId)
        .order("price", { ascending: false });
      return data ?? [];
    },
    [`match-odds-${matchId}`],
    { revalidate: 60, tags: [`match-${matchId}`, "odds"] },
  )();
}

// ─── Value bets (split to respect RLS without using auth context) ─────────────

/** Always cached — non-premium value bets visible to everyone. */
export function getCachedFreeValueBets(matchId: number) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("value_bets")
        .select("*, bookmaker:bookmakers(*)")
        .eq("match_id", matchId)
        .eq("result", "pending")
        .eq("is_premium", false)
        .order("edge", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    [`match-vb-free-${matchId}`],
    { revalidate: 60, tags: [`match-${matchId}`, "value-bets"] },
  )();
}

/** Only fetched for premium users — edge ≥ 3% moderate bets. */
export function getCachedPremiumValueBets(matchId: number) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("value_bets")
        .select("*, bookmaker:bookmakers(*)")
        .eq("match_id", matchId)
        .eq("result", "pending")
        .eq("is_premium", true)
        .order("edge", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    [`match-vb-premium-${matchId}`],
    { revalidate: 60, tags: [`match-${matchId}`, "value-bets"] },
  )();
}

// ─── Injuries + news ──────────────────────────────────────────────────────────

export function getCachedMatchSideData(matchId: number) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const [injuriesRes, newsRes, matchRes] = await Promise.all([
        supabase
          .from("injuries")
          .select("*, team:teams(id, name, logo_url)")
          .eq("match_id", matchId)
          .order("reason", { ascending: true }), // suspensions first
        supabase
          .from("news")
          .select("*")
          .eq("related_match_id", matchId)
          .order("published_at", { ascending: false })
          .limit(5),
        supabase
          .from("matches")
          .select("kickoff, status")
          .eq("id", matchId)
          .single(),
      ]);

      let injuries = injuriesRes.data ?? [];

      // If DB has no injuries and the match hasn't finished, fetch live from
      // API-Football so the tab is never permanently empty between cron runs.
      if (injuries.length === 0 && matchRes.data) {
        const { kickoff, status } = matchRes.data;
        const kickoffMs = new Date(kickoff).getTime();
        const isUpcomingOrLive =
          status === "live" ||
          (status === "scheduled" &&
            kickoffMs - Date.now() < 7 * 24 * 3600 * 1000);

        if (isUpcomingOrLive) {
          try {
            const apiInjuries = await fetchInjuriesForFixture(matchId);
            if (apiInjuries.length > 0) {
              // Persist so the cron (and future cache misses) use the DB path
              await supabase.from("injuries").insert(apiInjuries);
              const { data: stored } = await supabase
                .from("injuries")
                .select("*, team:teams(id, name, logo_url)")
                .eq("match_id", matchId)
                .order("reason", { ascending: true });
              injuries = stored ?? [];
            }
          } catch {
            // Non-critical — leave tab empty if API call fails
          }
        }
      }

      return {
        injuries,
        news: newsRes.data ?? [],
      };
    },
    [`match-side-${matchId}`],
    { revalidate: 300, tags: [`match-${matchId}`, "news", "injuries"] },
  )();
}
