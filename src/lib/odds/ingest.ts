/**
 * Ingesta de cuotas scrapeadas: resuelve match_id por nombre de equipo + fecha
 * (fuzzy match) y upserta en `odds`.
 *
 * Usado por:
 *  - POST /api/admin/ingest-odds  (endpoint público para scrapers externos)
 *  - GET  /api/cron/scrape-odds   (cron interno de Vercel)
 */

import { createAdminClient } from "@/lib/supabase/server";

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

export type IngestMarket =
  | "1x2"
  | "double_chance"
  | "over_under_2_5"
  | "over_under_1_5"
  | "btts"
  | "asian_handicap"
  | "draw_no_bet";

export interface IngestOdd {
  home_team: string;
  away_team: string;
  kickoff_date: string;
  market: IngestMarket;
  selection: string;
  price: number;
  line: number | null;
  is_live: boolean;
}

export interface IngestResult {
  source: string;
  received: number;
  upserted: number;
  unresolved: number;
  unresolvedMatches?: string[];
}

export class IngestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const MIN_SCORE = 0.5;

export async function ingestScrapedOdds(source: string, odds: IngestOdd[]): Promise<IngestResult> {
  if (!odds.length) {
    return { source, received: 0, upserted: 0, unresolved: 0 };
  }

  const supabase = createAdminClient();

  const { data: bm, error: bmErr } = await supabase
    .from("bookmakers")
    .select("id")
    .eq("slug", source)
    .single();

  if (bmErr || !bm) {
    throw new IngestError(`Bookmaker no encontrado: ${source}`, 400);
  }

  const dates = [...new Set(odds.map((o) => o.kickoff_date))];
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));

  const from = new Date(`${minDate}T00:00:00-05:00`).toISOString();
  const to = new Date(`${maxDate}T23:59:59-05:00`).toISOString();

  const { data: matchRows, error: matchErr } = await supabase
    .from("matches")
    .select("id, kickoff, home_team_id, away_team_id")
    .gte("kickoff", from)
    .lte("kickoff", to)
    .in("status", ["scheduled", "live"]);

  if (matchErr) throw new IngestError(matchErr.message, 500);

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
    id: m.id,
    kickoff: m.kickoff,
    homeName: teamNameById.get(m.home_team_id) ?? "",
    awayName: teamNameById.get(m.away_team_id) ?? "",
  }));

  const upsertRows: Array<{
    match_id: number;
    bookmaker_id: number;
    market: IngestMarket;
    selection: string;
    price: number;
    line: number | null;
    is_live: boolean;
  }> = [];

  const unresolved: string[] = [];

  for (const odd of odds) {
    const candidates = matches.filter((m) => {
      const mLocalDate = new Date(m.kickoff).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
      return mLocalDate === odd.kickoff_date;
    });

    let best: MatchRow | null = null;
    let bestScore = 0;

    for (const m of candidates) {
      const score = (teamSimilarity(odd.home_team, m.homeName) + teamSimilarity(odd.away_team, m.awayName)) / 2;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }

    if (!best || bestScore < MIN_SCORE) {
      unresolved.push(`"${odd.home_team}" vs "${odd.away_team}" (${odd.kickoff_date}) — score=${bestScore.toFixed(2)}`);
      continue;
    }

    upsertRows.push({
      match_id: best.id,
      bookmaker_id: bm.id,
      market: odd.market,
      selection: odd.selection,
      price: odd.price,
      line: odd.line,
      is_live: odd.is_live,
    });
  }

  let upserted = 0;
  for (let i = 0; i < upsertRows.length; i += 200) {
    const batch = upsertRows.slice(i, i + 200);
    const { error } = await supabase.from("odds").upsert(batch, {
      onConflict: "match_id,bookmaker_id,market,selection,line",
    });
    if (error) throw new IngestError(error.message, 500);
    upserted += batch.length;
  }

  return {
    source,
    received: odds.length,
    upserted,
    unresolved: unresolved.length,
    ...(unresolved.length > 0 && { unresolvedMatches: unresolved }),
  };
}
