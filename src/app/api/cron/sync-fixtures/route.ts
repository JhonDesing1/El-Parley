import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchFixturesForLeague, fetchPredictionsForFixture, HIGH_PRIORITY_LEAGUE_IDS } from "@/lib/api/api-football";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Cron cada 6 horas — refresca fixtures de las próximas 2 semanas
 * para todas las ligas marcadas como featured.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: leagues, error: leaguesError } = await supabase
    .from("leagues")
    .select("id, season")
    .eq("is_featured", true);

  if (leaguesError) {
    return NextResponse.json(
      { error: "supabase error", detail: leaguesError.message },
      { status: 500 },
    );
  }
  if (!leagues || leagues.length === 0) {
    return NextResponse.json(
      { error: "no leagues found", hint: "verify is_featured=true rows exist in public.leagues" },
      { status: 500 },
    );
  }

  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // Process high-priority leagues first to ensure Champions/World Cup data is
  // always fresh even if the cron hits the runtime limit.
  const sortedLeagues = [...leagues].sort((a, b) => {
    const aHigh = HIGH_PRIORITY_LEAGUE_IDS.includes(a.id) ? 0 : 1;
    const bHigh = HIGH_PRIORITY_LEAGUE_IDS.includes(b.id) ? 0 : 1;
    return aHigh - bHigh;
  });

  let totalFixtures = 0;
  let totalTeams = 0;

  const debug: any[] = [];

  for (const league of sortedLeagues) {
    try {
      const { fixtures, teams } = await fetchFixturesForLeague(
        league.id,
        league.season,
        from,
        to,
      );
      console.log(`[sync-fixtures] league=${league.id} season=${league.season} → fixtures=${fixtures.length} teams=${teams.length}`);
      debug.push({ league: league.id, season: league.season, fixtures: fixtures.length });

      // Upsert teams primero (FK)
      if (teams.length) {
        await supabase.from("teams").upsert(teams, { onConflict: "id" });
        totalTeams += teams.length;
      }

      if (fixtures.length) {
        await supabase.from("matches").upsert(fixtures, { onConflict: "id" });
        totalFixtures += fixtures.length;
      }

      // Throttle por rate limit de API-Football
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[sync-fixtures] league ${league.id}:`, err);
    }
  }

  // ── Paso 2: poblar xG para partidos próximos 72h sin datos ──────
  // 72h (en lugar de 48h) para que Champions/Mundial tengan xG disponible
  // con más anticipación — el cron de sync-live-odds lo necesita para
  // detectar value bets en tiempo real.
  // Solo pide predicciones para fixtures que aún no las tienen,
  // para no quemar el límite de 100 req/día de la API.
  // Prioridad: ligas de alto tráfico primero.
  const in72h = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  const { data: needsXg } = await supabase
    .from("matches")
    .select("id, league_id")
    .gte("kickoff", new Date().toISOString())
    .lte("kickoff", in72h)
    .eq("status", "scheduled")
    .is("model_expected_goals_home", null);

  let xgUpdated = 0;

  if (needsXg?.length) {
    // High-priority leagues get xG first
    const sortedNeedsXg = [...needsXg].sort((a, b) => {
      const aHigh = HIGH_PRIORITY_LEAGUE_IDS.includes(a.league_id ?? 0) ? 0 : 1;
      const bHigh = HIGH_PRIORITY_LEAGUE_IDS.includes(b.league_id ?? 0) ? 0 : 1;
      return aHigh - bHigh;
    });

    for (const match of sortedNeedsXg) {
      try {
        const preds = await fetchPredictionsForFixture(match.id);
        if (!preds) continue;

        await supabase
          .from("matches")
          .update({
            model_expected_goals_home: preds.homeXg,
            model_expected_goals_away: preds.awayXg,
          })
          .eq("id", match.id);

        xgUpdated++;
        // Throttle para no exceder rate limits
        await new Promise((r) => setTimeout(r, 1200));
      } catch (err) {
        console.error(`[sync-fixtures] predictions fixture=${match.id}:`, err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    leaguesProcessed: leagues.length,
    fixtures: totalFixtures,
    teams: totalTeams,
    xgUpdated,
    debug,
    timestamp: new Date().toISOString(),
  });
}
