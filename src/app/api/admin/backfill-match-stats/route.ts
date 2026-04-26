import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchFixtureStatistics } from "@/lib/api/api-football";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/admin/backfill-match-stats?secret=CRON_SECRET&days=14&limit=30
 *
 * Backfill manual de match_stats para partidos finalizados que aún no
 * tienen snapshot. Útil para alimentar sync-team-stats con muestra
 * histórica sin esperar a que sync-results vaya procesando uno a uno.
 *
 * CUIDADO: cada partido = 1 request a API-Football (límite 100/día).
 * Por defecto procesa máximo 30 partidos por invocación. Ajustar el
 * parámetro `limit` con consciencia del cupo restante.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const days = Math.min(Number(req.nextUrl.searchParams.get("days") ?? 14), 90);
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 30), 80);

  const supabase = createAdminClient();
  const now = new Date();
  const fromIso = new Date(now.getTime() - days * 24 * 3600 * 1000).toISOString();

  // Partidos finalizados en la ventana sin row en match_stats.
  // Usamos un anti-join via .not("match_stats.match_id", "is", null) no es
  // expresable en supabase-js, así que cargamos los IDs ya cubiertos primero.
  const { data: existingRows } = await supabase
    .from("match_stats")
    .select("match_id");
  const existing = new Set((existingRows ?? []).map((r) => r.match_id));

  const { data: candidates, error } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id, kickoff")
    .eq("status", "finished")
    .gte("kickoff", fromIso)
    .order("kickoff", { ascending: false })
    .limit(limit + existing.size);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!candidates?.length) {
    return NextResponse.json({ ok: true, processed: 0, timestamp: now.toISOString() });
  }

  const todo = candidates.filter((m) => !existing.has(m.id)).slice(0, limit);
  if (!todo.length) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      message: "Todos los partidos en la ventana ya tienen match_stats",
      timestamp: now.toISOString(),
    });
  }

  let processed = 0;
  let upserted = 0;
  const failed: number[] = [];

  // Secuencial — no querés gatillar el rate-limit de API-Football haciendo
  // 30 requests en paralelo.
  for (const m of todo) {
    processed++;
    try {
      const stats = await fetchFixtureStatistics(m.id);
      if (!stats || !m.home_team_id || !m.away_team_id) continue;

      const home = stats.perTeam.find((t) => t.teamId === m.home_team_id);
      const away = stats.perTeam.find((t) => t.teamId === m.away_team_id);
      if (!home && !away) continue;

      const { error: upErr } = await supabase.from("match_stats").upsert(
        {
          match_id: m.id,
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
      if (upErr) {
        failed.push(m.id);
        continue;
      }
      upserted++;
    } catch (e) {
      console.error("[backfill-match-stats]", m.id, e);
      failed.push(m.id);
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    upserted,
    failed,
    skippedAlreadyHaveStats: candidates.length - todo.length,
    windowDays: days,
    timestamp: now.toISOString(),
  });
}
