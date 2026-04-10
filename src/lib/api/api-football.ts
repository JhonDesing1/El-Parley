const BASE = `https://${process.env.API_FOOTBALL_HOST ?? "v3.football.api-sports.io"}`;

function headers() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY no configurada");
  return {
    "x-apisports-key": key,
    "Content-Type": "application/json",
  };
}

async function af<T = any>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`API-Football ${path} -> ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  }
  return json.response as T;
}

interface AfFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null }; venue: { name: string | null }; referee: string | null };
  league: { id: number; season: number; round: string };
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null } };
}

interface AfOddsResponse {
  fixture: { id: number };
  bookmakers: Array<{ id: number; name: string; bets: Array<{ id: number; name: string; values: Array<{ value: string; odd: string }> }> }>;
}

function mapStatus(short: string): "scheduled" | "live" | "finished" | "postponed" | "canceled" {
  if (["NS", "TBD"].includes(short)) return "scheduled";
  if (["1H", "HT", "2H", "ET", "P", "BT", "LIVE"].includes(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (["PST", "SUSP", "INT"].includes(short)) return "postponed";
  return "canceled";
}

const BOOKMAKER_NAME_TO_SLUG: Record<string, string> = {
  "1xBet": "1xbet",
  "Bet365": "betplay",
  "Marathonbet": "wplay",
  "Pinnacle": "codere",
  "Betfair": "rivalo",
};

const SLUG_TO_ID: Record<string, number> = {
  betplay: 1, wplay: 2, codere: 3, rivalo: 4, "1xbet": 5,
};

const MARKET_MAP: Record<string, { market: string; mapValue: (v: string) => string | null }> = {
  "Match Winner": {
    market: "1x2",
    mapValue: (v) => (v === "Home" ? "home" : v === "Draw" ? "draw" : v === "Away" ? "away" : null),
  },
  "Goals Over/Under": {
    market: "over_under_2_5",
    mapValue: (v) => {
      if (v === "Over 2.5") return "over";
      if (v === "Under 2.5") return "under";
      return null;
    },
  },
  "Both Teams Score": {
    market: "btts",
    mapValue: (v) => (v === "Yes" ? "yes" : v === "No" ? "no" : null),
  },
};

export async function fetchFixturesForLeague(leagueId: number, season: number, fromDate: string, toDate: string) {
  const response = await af<AfFixture[]>("/fixtures", {
    league: leagueId,
    season,
    from: fromDate,
    to: toDate,
  });

  const teamsMap = new Map<number, any>();
  const fixtures = response.map((f) => {
    teamsMap.set(f.teams.home.id, {
      id: f.teams.home.id,
      name: f.teams.home.name,
      slug: f.teams.home.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      logo_url: f.teams.home.logo,
    });
    teamsMap.set(f.teams.away.id, {
      id: f.teams.away.id,
      name: f.teams.away.name,
      slug: f.teams.away.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      logo_url: f.teams.away.logo,
    });
    return {
      id: f.fixture.id,
      league_id: f.league.id,
      season: f.league.season,
      round: f.league.round,
      home_team_id: f.teams.home.id,
      away_team_id: f.teams.away.id,
      kickoff: f.fixture.date,
      status: mapStatus(f.fixture.status.short),
      minute: f.fixture.status.elapsed,
      home_score: f.goals.home,
      away_score: f.goals.away,
      home_score_ht: f.score.halftime.home,
      away_score_ht: f.score.halftime.away,
      venue: f.fixture.venue.name,
      referee: f.fixture.referee,
    };
  });

  return { fixtures, teams: Array.from(teamsMap.values()) };
}

interface AfPrediction {
  predictions: {
    goals: { home: string | null; away: string | null };
  };
}

/**
 * Devuelve los xG estimados por API-Football para un fixture.
 * El endpoint /predictions combina estadísticas históricas para producir
 * goles esperados home/away. Retorna null si no hay datos.
 */
export async function fetchPredictionsForFixture(
  fixtureId: number,
): Promise<{ homeXg: number; awayXg: number } | null> {
  const response = await af<AfPrediction[]>("/predictions", { fixture: fixtureId });
  if (!response.length) return null;

  const goals = response[0].predictions?.goals;
  const homeXg = goals?.home != null ? parseFloat(goals.home) : NaN;
  const awayXg = goals?.away != null ? parseFloat(goals.away) : NaN;

  if (isNaN(homeXg) || isNaN(awayXg) || homeXg <= 0 || awayXg <= 0) return null;
  return { homeXg, awayXg };
}

export async function fetchOddsForFixtures(fixtureId: number) {
  const response = await af<AfOddsResponse[]>("/odds", { fixture: fixtureId });
  if (!response.length) return [];

  const out: any[] = [];
  for (const entry of response) {
    for (const book of entry.bookmakers) {
      const slug = BOOKMAKER_NAME_TO_SLUG[book.name];
      if (!slug) continue;
      const bookmakerId = SLUG_TO_ID[slug];
      if (!bookmakerId) continue;

      for (const bet of book.bets) {
        const cfg = MARKET_MAP[bet.name];
        if (!cfg) continue;

        for (const v of bet.values) {
          const selection = cfg.mapValue(v.value);
          if (!selection) continue;
          const price = parseFloat(v.odd);
          if (isNaN(price) || price <= 1) continue;

          out.push({
            match_id: fixtureId,
            bookmaker_id: bookmakerId,
            market: cfg.market,
            selection,
            price,
            line: cfg.market.startsWith("over_under") ? 2.5 : null,
            is_live: false,
          });
        }
      }
    }
  }
  return out;
}
