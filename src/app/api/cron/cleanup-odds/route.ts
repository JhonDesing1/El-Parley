import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron — runs weekly on Sunday at 02:00 UTC.
 *
 * Prunes stale rows that accumulate over time and inflate the DB:
 *
 *  1. odds rows for matches that finished 30+ days ago — odds from
 *     past matches have no analytical value once bets are settled.
 *  2. affiliate_clicks older than 90 days — beyond the attribution
 *     window for any CPA/revshare program.
 *  3. blog_posts for matches older than 1 year — stale content that
 *     hurts SEO crawl budget more than it helps.
 *
 * value_bets and user_picks are intentionally kept for historical ROI
 * tracking and leaderboard recalculation.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  const threshold30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const threshold90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const threshold1y = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // IDs of old finished matches (used as FK for odds + blog posts)
  const { data: oldMatches } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "finished")
    .lt("kickoff", threshold30d);

  let oddsDeleted = 0;
  let clicksDeleted = 0;
  let blogPostsDeleted = 0;

  if (oldMatches?.length) {
    const matchIds = oldMatches.map((m) => m.id);

    // Delete in batches of 500 to avoid DB timeouts
    for (let i = 0; i < matchIds.length; i += 500) {
      const batch = matchIds.slice(i, i + 500);

      const { count: oddsCount } = await supabase
        .from("odds")
        .delete({ count: "exact" })
        .in("match_id", batch);

      oddsDeleted += oddsCount ?? 0;
    }

    // Blog posts tied to old matches (not just by kickoff — check related_match_id)
    const { data: oldMatchIds1y } = await supabase
      .from("matches")
      .select("id")
      .eq("status", "finished")
      .lt("kickoff", threshold1y);

    if (oldMatchIds1y?.length) {
      const ids1y = oldMatchIds1y.map((m) => m.id);
      for (let i = 0; i < ids1y.length; i += 500) {
        const batch = ids1y.slice(i, i + 500);
        const { count } = await supabase
          .from("blog_posts")
          .delete({ count: "exact" })
          .in("related_match_id", batch);
        blogPostsDeleted += count ?? 0;
      }
    }
  }

  // Affiliate clicks beyond attribution window
  const { count: clickCount } = await supabase
    .from("affiliate_clicks")
    .delete({ count: "exact" })
    .lt("clicked_at", threshold90d);

  clicksDeleted = clickCount ?? 0;

  console.info(
    `[cleanup-odds] odds=${oddsDeleted} clicks=${clicksDeleted} blog_posts=${blogPostsDeleted}`,
  );

  return NextResponse.json({
    ok: true,
    oddsDeleted,
    clicksDeleted,
    blogPostsDeleted,
    timestamp: now.toISOString(),
  });
}
