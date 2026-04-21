import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchOddsForFixtures, BOOKMAKER_NAME_TO_SLUG } from "@/lib/api/api-football";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron — corre cada 10 minutos.
 * Sincroniza cuotas de los partidos del día desde API-Football.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Construir mapa slug → bookmaker_id desde la BD para evitar IDs hardcodeados
  const { data: bookmakerRows } = await supabase.from("bookmakers").select("id, slug");
  const slugToId: Record<string, number> = {};
  for (const b of bookmakerRows ?? []) slugToId[b.slug] = b.id;

  // Verificar que tenemos al menos los bookmakers que devuelve API-Football
  const knownSlugs = Object.values(BOOKMAKER_NAME_TO_SLUG);
  const missingSlugs = knownSlugs.filter((s) => !slugToId[s]);
  if (missingSlugs.length > 0) {
    console.warn(`[sync-odds] Bookmakers faltantes en BD: ${missingSlugs.join(", ")}. Aplica migración 00014.`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // Partidos en ventana hoy/mañana
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id")
    .gte("kickoff", today)
    .lte("kickoff", tomorrow + "T23:59:59")
    .in("status", ["scheduled", "live"]);

  if (error || !matches) {
    return NextResponse.json({ error: error?.message ?? "no matches" }, { status: 500 });
  }

  let totalOdds = 0;
  let updatedMatches = 0;

  // Procesar en lotes de 10 para no exceder rate limits
  for (let i = 0; i < matches.length; i += 10) {
    const batch = matches.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(async (m) => {
        const odds = await fetchOddsForFixtures(m.id, slugToId);
        if (!odds.length) return 0;

        // Upsert en bulk
        const { error: upErr } = await supabase.from("odds").upsert(odds, {
          onConflict: "match_id,bookmaker_id,market,selection,line",
        });
        if (upErr) throw upErr;
        return odds.length;
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        totalOdds += r.value;
        if (r.value > 0) updatedMatches++;
      }
    }

    // Throttle ~1s entre lotes
    if (i + 10 < matches.length) await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({
    ok: true,
    matchesScanned: matches.length,
    matchesUpdated: updatedMatches,
    oddsUpserted: totalOdds,
    timestamp: new Date().toISOString(),
  });
}
