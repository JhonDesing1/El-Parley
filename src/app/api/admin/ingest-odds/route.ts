/**
 * POST /api/admin/ingest-odds
 *
 * Recibe cuotas scrapeadas de casas colombianas (Betplay, Wplay, etc.)
 * y las inserta en la tabla `odds` resolviendo el match_id por nombre de equipo + fecha.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 *
 * Body:
 * {
 *   source: "betplay" | "wplay" | ...,   // slug del bookmaker
 *   odds: Array<{
 *     home_team: string,
 *     away_team: string,
 *     kickoff_date: string,              // "YYYY-MM-DD" en hora Colombia (UTC-5)
 *     market: "1x2" | "over_under_2_5" | "over_under_1_5" | "btts" | ...,
 *     selection: "home" | "draw" | "away" | "over" | "under" | "yes" | "no",
 *     price: number,                     // cuota decimal > 1
 *     line: number | null,               // 2.5 para over/under, null para 1x2
 *     is_live: boolean,
 *   }>
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

// ── Normalización para fuzzy matching ───────────────────────────────────────

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // sin tildes
    .replace(/[^a-z0-9\s]/g, "")       // solo alfanumérico
    .replace(/\s+/g, " ")
    .trim();
}

/** Score 0..1 de similitud entre dos nombres de equipo. */
function teamSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const wordsA = na.split(" ").filter((w) => w.length > 2);
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 2));
  const shared = wordsA.filter((w) => wordsB.has(w)).length;
  const total = new Set([...wordsA, ...wordsB]).size;
  return total === 0 ? 0 : shared / total;
}

// ── Schemas de validación ────────────────────────────────────────────────────

const MARKETS = [
  "1x2",
  "double_chance",
  "over_under_2_5",
  "over_under_1_5",
  "btts",
  "asian_handicap",
  "draw_no_bet",
] as const;

const OddSchema = z.object({
  home_team:    z.string().min(1),
  away_team:    z.string().min(1),
  kickoff_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "formato YYYY-MM-DD"),
  market:       z.enum(MARKETS),
  selection:    z.string().min(1),
  price:        z.number().gt(1),
  line:         z.number().nullable().default(null),
  is_live:      z.boolean().default(false),
});

const BodySchema = z.object({
  source: z.string().min(1),
  odds:   z.array(OddSchema).min(1).max(1000),
});

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Validar body
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "invalid body", details: String(e) }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Resolver bookmaker_id
  const { data: bm, error: bmErr } = await supabase
    .from("bookmakers")
    .select("id")
    .eq("slug", body.source)
    .eq("is_active", true)
    .single();

  if (bmErr || !bm) {
    return NextResponse.json(
      { error: `Bookmaker no encontrado o inactivo: ${body.source}` },
      { status: 400 },
    );
  }

  // Cargar partidos próximos con nombres de equipos (ventana ±1 día)
  const dates = [...new Set(body.odds.map((o) => o.kickoff_date))];
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));

  // Ampliar ventana 1 día en cada extremo para absorber diferencias UTC-5
  const from = new Date(`${minDate}T00:00:00-05:00`).toISOString();
  const to   = new Date(`${maxDate}T23:59:59-05:00`).toISOString();

  const { data: matchRows, error: matchErr } = await supabase
    .from("matches")
    .select("id, kickoff, home_team_id, away_team_id")
    .gte("kickoff", from)
    .lte("kickoff", to)
    .in("status", ["scheduled", "live"]);

  if (matchErr) {
    return NextResponse.json({ error: matchErr.message }, { status: 500 });
  }

  // Si hay partidos, cargar nombres de equipos en una sola query
  const teamIds = [
    ...new Set([
      ...(matchRows ?? []).map((m) => m.home_team_id),
      ...(matchRows ?? []).map((m) => m.away_team_id),
    ]),
  ];

  const { data: teamRows } = teamIds.length
    ? await supabase.from("teams").select("id, name").in("id", teamIds)
    : { data: [] };

  const teamNameById = new Map((teamRows ?? []).map((t) => [t.id, t.name]));

  type MatchRow = { id: number; kickoff: string; homeName: string; awayName: string };
  const matches: MatchRow[] = (matchRows ?? []).map((m) => ({
    id:       m.id,
    kickoff:  m.kickoff,
    homeName: teamNameById.get(m.home_team_id) ?? "",
    awayName: teamNameById.get(m.away_team_id) ?? "",
  }));

  // Resolver cada cuota → match_id
  type MarketEnum = "1x2" | "double_chance" | "over_under_2_5" | "over_under_1_5" | "btts" | "correct_score" | "asian_handicap" | "draw_no_bet";

  const upsertRows: Array<{
    match_id: number;
    bookmaker_id: number;
    market: MarketEnum;
    selection: string;
    price: number;
    line: number | null;
    is_live: boolean;
  }> = [];

  const unresolved: string[] = [];
  const MIN_SCORE = 0.5;

  for (const odd of body.odds) {
    // Candidatos del mismo día (hora Colombia UTC-5)
    const candidates = matches.filter((m) => {
      const mLocalDate = new Date(m.kickoff)
        .toLocaleDateString("en-CA", { timeZone: "America/Bogota" }); // "YYYY-MM-DD"
      return mLocalDate === odd.kickoff_date;
    });

    let best: MatchRow | null = null;
    let bestScore = 0;

    for (const m of candidates) {
      const score = (teamSimilarity(odd.home_team, m.homeName) + teamSimilarity(odd.away_team, m.awayName)) / 2;
      if (score > bestScore) { bestScore = score; best = m; }
    }

    if (!best || bestScore < MIN_SCORE) {
      unresolved.push(
        `"${odd.home_team}" vs "${odd.away_team}" (${odd.kickoff_date}) — score=${bestScore.toFixed(2)}`,
      );
      continue;
    }

    upsertRows.push({
      match_id:     best.id,
      bookmaker_id: bm.id,
      market:       odd.market as MarketEnum,
      selection:    odd.selection,
      price:        odd.price,
      line:         odd.line,
      is_live:      odd.is_live,
    });
  }

  // Upsert en lotes de 200 para no superar límites de PostgREST
  let upserted = 0;
  for (let i = 0; i < upsertRows.length; i += 200) {
    const batch = upsertRows.slice(i, i + 200);
    const { error } = await supabase.from("odds").upsert(batch, {
      onConflict: "match_id,bookmaker_id,market,selection,line",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    upserted += batch.length;
  }

  return NextResponse.json({
    ok: true,
    source:     body.source,
    received:   body.odds.length,
    upserted,
    unresolved: unresolved.length,
    ...(unresolved.length > 0 && { unresolvedMatches: unresolved }),
  });
}
