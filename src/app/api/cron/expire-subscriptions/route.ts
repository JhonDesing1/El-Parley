import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Vercel Cron — runs daily at 05:00 UTC.
 *
 * Belt-and-suspenders subscription hygiene — catches cases where MP webhooks
 * were missed or delayed:
 *
 *  1. Active subscriptions whose current_period_end has passed → mark past_due
 *     and downgrade profile to free.
 *  2. past_due subscriptions older than 14 days with no update → cancel them
 *     and downgrade profile (safety net for webhook delivery failures).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  let expiredCount = 0;
  let canceledCount = 0;

  // ── 1. Active but period has ended ──────────────────────────────
  const { data: expired, error: expiredErr } = await supabase
    .from("subscriptions")
    .select("id, user_id")
    .eq("status", "active")
    .not("current_period_end", "is", null)
    .lt("current_period_end", now.toISOString());

  if (expiredErr) {
    console.error("[expire-subscriptions] query expired:", expiredErr.message);
  } else if (expired?.length) {
    const ids = expired.map((s) => s.id);
    await supabase
      .from("subscriptions")
      .update({ status: "past_due" })
      .in("id", ids);

    await Promise.allSettled(
      expired.map(async (sub) => {
        const { data: stillActive } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", sub.user_id)
          .in("status", ["active", "trialing"])
          .limit(1)
          .maybeSingle();

        if (!stillActive) {
          await supabase
            .from("profiles")
            .update({ tier: "free" })
            .eq("id", sub.user_id);
        }
      }),
    );

    expiredCount = ids.length;
  }

  // ── 2. past_due with no update for 14+ days → cancel ──────────
  const { data: stale, error: staleErr } = await supabase
    .from("subscriptions")
    .select("id, user_id")
    .eq("status", "past_due")
    .lt("updated_at", staleThreshold);

  if (staleErr) {
    console.error("[expire-subscriptions] query stale:", staleErr.message);
  } else if (stale?.length) {
    const ids = stale.map((s) => s.id);
    await supabase
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: now.toISOString() })
      .in("id", ids);

    await Promise.allSettled(
      stale.map(async (sub) => {
        const { data: stillActive } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", sub.user_id)
          .in("status", ["active", "trialing"])
          .limit(1)
          .maybeSingle();

        if (!stillActive) {
          await supabase
            .from("profiles")
            .update({ tier: "free" })
            .eq("id", sub.user_id);
        }
      }),
    );

    canceledCount = ids.length;
  }

  console.info(`[expire-subscriptions] expired=${expiredCount} canceled=${canceledCount}`);
  return NextResponse.json({
    ok: true,
    expiredToPastDue: expiredCount,
    pastDueCanceled: canceledCount,
    timestamp: now.toISOString(),
  });
}
