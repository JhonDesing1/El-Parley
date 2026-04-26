import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { notifyAdminError } from "@/lib/telegram/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron — corre 1 vez al día (6 AM UTC).
 *
 * Recalcula medias rodantes por equipo (córners y tarjetas) sobre los
 * últimos N partidos disponibles en match_stats. Estos valores reemplazan
 * los promedios estáticos LEAGUE_AVG_* en detect-value-bets, dando
 * expectativas específicas por equipo:
 *
 *  - avg_corners_for       → córners que el equipo SUELE forzar
 *  - avg_corners_against   → córners que SUELE conceder
 *  - avg_yellow_cards      → amarillas que SUELE recibir
 *  - avg_red_cards         → rojas que SUELE recibir
 *
 * Solo procesa equipos con ≥ MIN_SAMPLE partidos para evitar inflar
 * la confianza con muestras pequeñas. El detector usa un fallback a
 * LEAGUE_AVG_* cuando matches_sample < umbral.
 */

const SAMPLE_LIMIT = 20; // últimos N partidos por equipo
const MIN_SAMPLE = 5;    // mínimo para considerar la muestra significativa

interface MatchStatRow {
  match_id: number;
  home_corners: number | null;
  away_corners: number | null;
  home_yellow_cards: number | null;
  away_yellow_cards: number | null;
  home_red_cards: number | null;
  away_red_cards: number | null;
}

interface MatchRow {
  id: number;
  home_team_id: number;
  away_team_id: number;
  kickoff: string;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // 1. Pull all match_stats joined with matches for the last 12 months.
  //    Older partidos se descartan (ratings de equipo cambian con el tiempo).
  const cutoff = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("match_stats")
    .select(
      `
      match_id,
      home_corners, away_corners,
      home_yellow_cards, away_yellow_cards,
      home_red_cards, away_red_cards,
      matches!inner(id, home_team_id, away_team_id, kickoff, status)
    `,
    )
    .eq("matches.status", "finished")
    .gte("matches.kickoff", cutoff);

  if (error) {
    await notifyAdminError("sync-team-stats", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows?.length) {
    return NextResponse.json({ ok: true, teamsUpdated: 0, timestamp: now.toISOString() });
  }

  // 2. Index by team — cada partido contribuye a la muestra de ambos equipos.
  type Sample = {
    cornersFor: number;
    cornersAgainst: number;
    yellowCards: number;
    redCards: number;
    kickoff: string;
  };
  const byTeam = new Map<number, Sample[]>();

  for (const r of rows) {
    const stats = r as unknown as MatchStatRow & { matches: MatchRow };
    const m = stats.matches;
    if (!m) continue;

    const homeSample: Sample = {
      cornersFor: stats.home_corners ?? 0,
      cornersAgainst: stats.away_corners ?? 0,
      yellowCards: stats.home_yellow_cards ?? 0,
      redCards: stats.home_red_cards ?? 0,
      kickoff: m.kickoff,
    };
    const awaySample: Sample = {
      cornersFor: stats.away_corners ?? 0,
      cornersAgainst: stats.home_corners ?? 0,
      yellowCards: stats.away_yellow_cards ?? 0,
      redCards: stats.away_red_cards ?? 0,
      kickoff: m.kickoff,
    };

    if (!byTeam.has(m.home_team_id)) byTeam.set(m.home_team_id, []);
    if (!byTeam.has(m.away_team_id)) byTeam.set(m.away_team_id, []);
    byTeam.get(m.home_team_id)!.push(homeSample);
    byTeam.get(m.away_team_id)!.push(awaySample);
  }

  // 3. Compute averages over the most recent SAMPLE_LIMIT matches per team.
  const upserts: Array<{
    team_id: number;
    matches_sample: number;
    avg_corners_for: number;
    avg_corners_against: number;
    avg_yellow_cards: number;
    avg_red_cards: number;
    updated_at: string;
  }> = [];

  for (const [teamId, samples] of byTeam) {
    const recent = samples
      .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())
      .slice(0, SAMPLE_LIMIT);

    if (recent.length < MIN_SAMPLE) continue;

    const n = recent.length;
    const sum = recent.reduce(
      (acc, s) => {
        acc.cf += s.cornersFor;
        acc.ca += s.cornersAgainst;
        acc.yc += s.yellowCards;
        acc.rc += s.redCards;
        return acc;
      },
      { cf: 0, ca: 0, yc: 0, rc: 0 },
    );

    upserts.push({
      team_id: teamId,
      matches_sample: n,
      avg_corners_for: +(sum.cf / n).toFixed(2),
      avg_corners_against: +(sum.ca / n).toFixed(2),
      avg_yellow_cards: +(sum.yc / n).toFixed(2),
      avg_red_cards: +(sum.rc / n).toFixed(2),
      updated_at: now.toISOString(),
    });
  }

  if (!upserts.length) {
    return NextResponse.json({ ok: true, teamsUpdated: 0, timestamp: now.toISOString() });
  }

  // 4. Upsert in batches to keep the request payload manageable.
  const BATCH = 200;
  let teamsUpdated = 0;
  for (let i = 0; i < upserts.length; i += BATCH) {
    const slice = upserts.slice(i, i + BATCH);
    const { error: upErr } = await supabase
      .from("team_stats")
      .upsert(slice, { onConflict: "team_id" });
    if (upErr) {
      await notifyAdminError("sync-team-stats", upErr.message);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    teamsUpdated += slice.length;
  }

  return NextResponse.json({
    ok: true,
    teamsUpdated,
    matchStatsRows: rows.length,
    timestamp: now.toISOString(),
  });
}
