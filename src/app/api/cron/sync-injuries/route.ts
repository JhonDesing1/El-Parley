import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchInjuriesForFixture } from "@/lib/api/api-football";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Cron twice daily (06:00 / 18:00 UTC) — syncs injury/suspension reports
 * for all matches scheduled within the next 72 hours (or live right now).
 *
 * Budget: ~1 API-Football call per fixture → ~10–20 calls per run.
 * Total: ≤ 40 calls/day, well within the 100 req/day free-tier limit.
 *
 * Strategy: delete existing rows for the match, then re-insert fresh data
 * from API-Football. This avoids the need for a unique constraint on
 * (match_id, team_id, player_name) and guarantees stale entries are removed.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const ago2h = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const in72h = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

  // Fetch upcoming + live matches.
  // Lower bound is 2h in the past so matches that recently kicked off
  // (status = 'live', kickoff already elapsed) are also included.
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id")
    .lte("kickoff", in72h)
    .gte("kickoff", ago2h)
    .in("status", ["scheduled", "live"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, skipped: 0 });
  }

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const match of matches) {
    try {
      const injuries = await fetchInjuriesForFixture(match.id);

      // Always delete then insert — ensures stale entries are cleaned up
      await supabase.from("injuries").delete().eq("match_id", match.id);

      if (injuries.length > 0) {
        const { error: insertError } = await supabase
          .from("injuries")
          .insert(injuries);

        if (insertError) {
          errors.push(`match=${match.id}: ${insertError.message}`);
          skipped++;
          continue;
        }
      }

      // Invalidate the match page cache so Next.js serves fresh injuries
      revalidatePath(`/partido/${match.id}`);

      synced++;
      console.log(
        `[sync-injuries] fixture=${match.id} → ${injuries.length} entries`,
      );

      // Throttle to stay within API-Football rate limits
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`match=${match.id}: ${msg}`);
      skipped++;
      console.error(`[sync-injuries] fixture=${match.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    synced,
    skipped,
    total: matches.length,
    ...(errors.length > 0 && { errors }),
    timestamp: new Date().toISOString(),
  });
}
