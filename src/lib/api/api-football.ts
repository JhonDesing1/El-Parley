import { poissonPMF } from "@/lib/betting/poisson";

const BASE = `https://${process.env.API_FOOTBALL_HOST ?? "v3.football.api-sports.io"}`;

/**
 * Leagues that get priority API budget during high-traffic events
 * (World Cup, Champions League, clásicos, etc.).
 * Used by cron jobs to decide which matches to sync more aggressively.
 *
 * IDs from API-Football:
 *  1  → FIFA World Cup
 *  2  → UEFA Champions League
 *  3  → UEFA Europa League
 *  13 → Copa Libertadores
 *  39 → Premier League
 *  61 → Ligue 1
 *  78 → Bundesliga
 * 135 → Serie A
 * 140 → La Liga
 * 239 → Liga BetPlay (Colombia)
 * 848 → UEFA Conference League
 */
export const HIGH_PRIORITY_LEAGUE_IDS = [1, 2, 3, 13, 39, 61, 78, 135, 140, 239, 848];

function headers() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY no configurada");
  return {
    "x-apisports-key": key,
    "Content-Type": "application/json",
  };
}

/** Statuses worth retrying — transient failures only. */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

const MAX_ATTEMPTS = 3;

/**
 * Core HTTP client for API-Football with exponential-backoff retry.
 *
 * Retries up to 2 times on network errors, 429 (rate-limited) and 5xx
 * server errors. Does NOT retry on 4xx client errors (bad key, not found).
 * Delays: ~1 s → ~2 s (with ±20% jitter to avoid thundering-herd).
 */
async function af<T = any>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url.toString(), { headers: headers(), cache: "no-store" });

      if (!res.ok) {
        if (!isRetryable(res.status) || attempt === MAX_ATTEMPTS) {
          throw new Error(`API-Football ${path} -> ${res.status} ${res.statusText}`);
        }
        lastError = new Error(`API-Football ${path} -> ${res.status} ${res.statusText}`);
      } else {
        const json = await res.json();
        if (json.errors && Object.keys(json.errors).length > 0) {
          throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
        }
        return json.response as T;
      }
    } catch (err) {
      // Re-throw immediately on the last attempt or non-retryable errors
      if (attempt === MAX_ATTEMPTS) throw err;
      // Only retry on network-level errors (fetch throws) or saved retryable HTTP errors
      const isNetworkError = !(err instanceof Error && err.message.startsWith("API-Football"));
      if (!isNetworkError && lastError === undefined) throw err;
      lastError = err;
    }

    // Exponential backoff with ±20% jitter: 1s, 2s
    const baseMs = 1000 * Math.pow(2, attempt - 1);
    const jitter = baseMs * 0.2 * (Math.random() * 2 - 1);
    const delay = Math.round(baseMs + jitter);
    console.warn(`[api-football] Retry ${attempt}/${MAX_ATTEMPTS - 1} for ${path} in ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }

  throw lastError;
}

interface AfFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null }; venue: { name: string | null }; referee: string | null };
  league: { id: number; season: number; round: string; name?: string; country?: string | null; logo?: string | null };
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

// Mapeo de nombres de API-Football → slug interno.
// API-Football retorna casas internacionales; los slugs deben coincidir
// con los valores insertados en public.bookmakers.
export const BOOKMAKER_NAME_TO_SLUG: Record<string, string> = {
  "Bet365":      "bet365",
  "Pinnacle":    "pinnacle",
  "1xBet":       "1xbet",
  "Marathonbet": "marathonbet",
  "Betfair":     "betfair",
};

type OddsMapping = (v: string) => { market: string; selection: string; line: number | null } | null;

/** Parsea valores "Over X.5" / "Under X.5" para cualquier mercado Over/Under. */
function parseOverUnder(v: string, allowedLines: number[]): { dir: "over" | "under"; lineVal: number } | null {
  const m = v.match(/^(Over|Under) (\d+\.?\d*)$/);
  if (!m) return null;
  const lineVal = parseFloat(m[2]);
  if (!allowedLines.includes(lineVal)) return null;
  return { dir: m[1].toLowerCase() as "over" | "under", lineVal };
}

const MARKET_MAP: Record<string, OddsMapping> = {
  // ── Resultado 1X2 ──────────────────────────────────────────────────────────
  "Match Winner": (v) => {
    const sel = v === "Home" ? "home" : v === "Draw" ? "draw" : v === "Away" ? "away" : null;
    return sel ? { market: "1x2", selection: sel, line: null } : null;
  },

  // ── Goles Over/Under (líneas 1.5, 2.5 y 3.5) ─────────────────────────────
  "Goals Over/Under": (v) => {
    const parsed = parseOverUnder(v, [1.5, 2.5, 3.5]);
    if (!parsed) return null;
    const marketName = `over_under_${String(parsed.lineVal).replace(".", "_")}`;
    return { market: marketName, selection: parsed.dir, line: parsed.lineVal };
  },

  // ── Ambos marcan ──────────────────────────────────────────────────────────
  "Both Teams Score": (v) => {
    const sel = v === "Yes" ? "yes" : v === "No" ? "no" : null;
    return sel ? { market: "btts", selection: sel, line: null } : null;
  },

  // ── Doble oportunidad ─────────────────────────────────────────────────────
  "Double Chance": (v) => {
    if (v === "Home/Draw") return { market: "double_chance", selection: "1x", line: null };
    if (v === "Home/Away") return { market: "double_chance", selection: "12", line: null };
    if (v === "Draw/Away") return { market: "double_chance", selection: "x2", line: null };
    return null;
  },

  // ── Córners Over/Under (líneas 8.5, 9.5 y 10.5) ──────────────────────────
  "Corners Over Under": (v) => {
    const parsed = parseOverUnder(v, [8.5, 9.5, 10.5]);
    if (!parsed) return null;
    return { market: "corners_over_under", selection: parsed.dir, line: parsed.lineVal };
  },
  // Alias que algunos bookmakers usan
  "Total Corners": (v) => {
    const parsed = parseOverUnder(v, [8.5, 9.5, 10.5]);
    if (!parsed) return null;
    return { market: "corners_over_under", selection: parsed.dir, line: parsed.lineVal };
  },

  // ── Tarjetas amarillas Over/Under (líneas 3.5 y 4.5) ─────────────────────
  "Cards Over/Under": (v) => {
    const parsed = parseOverUnder(v, [3.5, 4.5]);
    if (!parsed) return null;
    return { market: "cards_over_under", selection: parsed.dir, line: parsed.lineVal };
  },
  "Yellow Cards": (v) => {
    const parsed = parseOverUnder(v, [3.5, 4.5]);
    if (!parsed) return null;
    return { market: "cards_over_under", selection: parsed.dir, line: parsed.lineVal };
  },

  // ── Hándicap asiático (solo líneas X.5 — sin push) ───────────────────────
  "Asian Handicap": (v) => {
    // Formato esperado: "Home -1.5", "Away +1.5", "Home +0.5", etc.
    const m = v.match(/^(Home|Away)\s+([+-]?\d+\.?\d*)$/);
    if (!m) return null;
    const side = m[1].toLowerCase() as "home" | "away";
    const handicap = parseFloat(m[2]);
    // Solo líneas .5 para evitar push/devolución parcial
    if (Math.abs(handicap) % 1 !== 0.5) return null;
    // Muchas casas (esp. en LATAM) no cubren líneas > 2.5 — descartamos
    if (Math.abs(handicap) > 2.5) return null;
    return { market: "asian_handicap", selection: side, line: handicap };
  },
};

/**
 * HTTP client con caché de Next.js (revalidate + tags) — útil para páginas SSR
 * que necesitan datos frescos pero no en cada request. Usa esto cuando el
 * consumidor es el runtime de Next (Server Component / route handler).
 */
async function afCached<T = any>(
  path: string,
  params: Record<string, string | number>,
  revalidateSec: number,
  tag?: string,
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), {
    headers: headers(),
    next: { revalidate: revalidateSec, ...(tag ? { tags: [tag] } : {}) },
  });
  if (!res.ok) throw new Error(`API-Football ${path} -> ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  }
  return json.response as T;
}

export interface NextFixtureForTeam {
  id: number;
  kickoff: string;
  status: ReturnType<typeof mapStatus>;
  venue: string | null;
  leagueId: number;
  leagueName: string;
  leagueCountry: string | null;
  leagueLogo: string | null;
  home: { id: number; name: string; logo: string | null };
  away: { id: number; name: string; logo: string | null };
}

/**
 * Próximo partido confirmado de un equipo — usado por /analisis como fallback
 * cuando la BD aún no lo tiene sincronizado (liga fuera del set high-priority).
 * Cachea 30 min para respetar el cupo de 100 req/día.
 *
 * Devuelve `null` si API-Football no tiene fixture programado.
 */
export async function fetchNextFixtureForTeam(teamId: number): Promise<NextFixtureForTeam | null> {
  try {
    const response = await afCached<AfFixture[]>(
      "/fixtures",
      { team: teamId, next: 1 },
      30 * 60, // 30 minutos
      `team-${teamId}-next`,
    );
    if (!response.length) return null;
    const f = response[0];
    return {
      id: f.fixture.id,
      kickoff: f.fixture.date,
      status: mapStatus(f.fixture.status.short),
      venue: f.fixture.venue.name,
      leagueId: f.league.id,
      leagueName: f.league.name ?? "",
      leagueCountry: f.league.country ?? null,
      leagueLogo: f.league.logo ?? null,
      home: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
      away: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
    };
  } catch (err) {
    console.warn("[fetchNextFixtureForTeam] falló:", err);
    return null;
  }
}

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
    percent: { home: string; draw: string; away: string } | null;
  };
}

/**
 * Derives (homeXg, awayXg) from 1x2 win probabilities by finding the xG pair
 * that best reproduces those probabilities under a Poisson model.
 *
 * Uses a coarse+fine grid search — accurate enough for our betting model.
 * Returns null if the fit error is too large (> 4pp per market).
 */
function deriveXgFromProbabilities(
  targetHome: number,
  targetDraw: number,
  targetAway: number,
): { homeXg: number; awayXg: number } | null {
  // Validate inputs sum to ~1 and are all positive
  if (
    targetHome <= 0 ||
    targetDraw <= 0 ||
    targetAway <= 0 ||
    Math.abs(targetHome + targetDraw + targetAway - 1) > 0.06
  )
    return null;

  let bestFit = Infinity;
  let bestH = 0;
  let bestA = 0;

  // Coarse grid: 0.4..3.2 step 0.2 (→ 15x15 = 225 evaluations)
  for (let h = 0.4; h <= 3.2; h += 0.2) {
    for (let a = 0.4; a <= 3.2; a += 0.2) {
      const fit = poissonFit(h, a, targetHome, targetDraw, targetAway);
      if (fit < bestFit) {
        bestFit = fit;
        bestH = h;
        bestA = a;
      }
    }
  }

  // Fine grid around best coarse point
  for (let h = bestH - 0.15; h <= bestH + 0.15; h += 0.05) {
    for (let a = bestA - 0.15; a <= bestA + 0.15; a += 0.05) {
      if (h <= 0 || a <= 0) continue;
      const fit = poissonFit(h, a, targetHome, targetDraw, targetAway);
      if (fit < bestFit) {
        bestFit = fit;
        bestH = h;
        bestA = a;
      }
    }
  }

  // Accept if total squared error in home+draw is under 0.04² + 0.04² = 0.0032
  return bestFit < 0.0032 ? { homeXg: +bestH.toFixed(2), awayXg: +bestA.toFixed(2) } : null;
}

/** Sum of squared errors for home+draw probabilities under a Poisson model. */
function poissonFit(
  homeXg: number,
  awayXg: number,
  targetHome: number,
  targetDraw: number,
  _targetAway: number,
): number {
  // Inline Poisson 1x2 computation (no Dixon-Coles to keep it fast)
  let home = 0;
  let draw = 0;
  for (let h = 0; h <= 7; h++) {
    const ph = poissonPMF(h, homeXg);
    if (ph < 1e-9) continue;
    for (let a = 0; a <= 7; a++) {
      const pa = poissonPMF(a, awayXg);
      if (pa < 1e-9) continue;
      const p = ph * pa;
      if (h > a) home += p;
      else if (h === a) draw += p;
    }
  }
  return (home - targetHome) ** 2 + (draw - targetDraw) ** 2;
}

/**
 * xG promedio por liga para usar como fallback cuando el endpoint /predictions
 * no devuelve valores válidos. Basado en promedios históricos de goles/partido
 * en temporadas recientes (fuente: FBRef/Understat agregados).
 *
 * Formato: [homeXg, awayXg]
 */
const LEAGUE_AVG_XG: Record<number, [number, number]> = {
  39:  [1.55, 1.20], // Premier League
  140: [1.45, 1.10], // La Liga
  135: [1.50, 1.15], // Serie A
  78:  [1.60, 1.25], // Bundesliga
  61:  [1.40, 1.10], // Ligue 1
  2:   [1.55, 1.15], // Champions League
  3:   [1.50, 1.20], // Europa League
  848: [1.45, 1.15], // Conference League
  13:  [1.40, 1.10], // Copa Libertadores
  239: [1.35, 1.10], // Liga BetPlay Colombia
};

const DEFAULT_XG: [number, number] = [1.40, 1.10]; // fallback genérico

/**
 * Devuelve los xG estimados para un fixture.
 * Intenta el endpoint /predictions de API-Football primero; si retorna
 * valores inválidos (negativos o cero), usa promedios históricos por liga
 * como fallback razonable para el modelo Poisson.
 */
export async function fetchPredictionsForFixture(
  fixtureId: number,
  leagueId?: number,
): Promise<{ homeXg: number; awayXg: number } | null> {
  try {
    const response = await af<AfPrediction[]>("/predictions", { fixture: fixtureId });
    if (response.length) {
      const pred = response[0].predictions;

      // 1. Try explicit xG from /predictions goals field (valid when > 0)
      const goals = pred?.goals;
      const homeXg = goals?.home != null ? parseFloat(goals.home) : NaN;
      const awayXg = goals?.away != null ? parseFloat(goals.away) : NaN;
      if (!isNaN(homeXg) && !isNaN(awayXg) && homeXg > 0 && awayXg > 0) {
        return { homeXg, awayXg };
      }

      // 2. Derive xG from the 1x2 percent prediction (match-specific model)
      // The API gives coarse values (5% increments) so we preserve the home/away
      // ratio from the derivation but scale totals up to realistic league averages.
      const pct = pred?.percent;
      if (pct) {
        const ph = parseFloat(pct.home) / 100;
        const pd = parseFloat(pct.draw) / 100;
        const pa = parseFloat(pct.away) / 100;
        const derived = deriveXgFromProbabilities(ph, pd, pa);
        if (derived) {
          const [leagueHome, leagueAway] = (leagueId ? LEAGUE_AVG_XG[leagueId] : null) ?? DEFAULT_XG;
          const leagueTotal = leagueHome + leagueAway;
          const derivedTotal = derived.homeXg + derived.awayXg;
          const scale = leagueTotal / derivedTotal;
          return {
            homeXg: +(derived.homeXg * scale).toFixed(2),
            awayXg: +(derived.awayXg * scale).toFixed(2),
          };
        }
      }
    }
  } catch {
    // Fallo silencioso — pasamos al fallback
  }

  // 3. Fallback: promedios históricos por liga (genéricos, sin calidad de equipo)
  const [homeXg, awayXg] = (leagueId ? LEAGUE_AVG_XG[leagueId] : null) ?? DEFAULT_XG;
  return { homeXg, awayXg };
}

/**
 * Devuelve el estado actual de un fixture (score, status, minuto).
 * Un API call por fixture — usar con moderación (100 req/day limit).
 */
export async function fetchFixtureById(fixtureId: number): Promise<{
  id: number;
  status: ReturnType<typeof mapStatus>;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  home_score_ht: number | null;
  away_score_ht: number | null;
} | null> {
  const response = await af<AfFixture[]>("/fixtures", { id: fixtureId });
  if (!response.length) return null;
  const f = response[0];
  return {
    id: f.fixture.id,
    status: mapStatus(f.fixture.status.short),
    minute: f.fixture.status.elapsed,
    home_score: f.goals.home,
    away_score: f.goals.away,
    home_score_ht: f.score.halftime.home,
    away_score_ht: f.score.halftime.away,
  };
}

interface AfInjury {
  player: {
    id: number;
    name: string;
    photo: string;
    type: string;   // e.g. "Ankle", "Knee", "Red Card"
    reason: string; // "Injury" | "Suspended" | "Missing Fixture" | "Doubtful"
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
}

/**
 * Fetches injury/suspension report for a fixture from API-Football `/injuries`.
 * Returns rows ready to upsert into the `injuries` table.
 * One API call per fixture — use conservatively.
 */
export async function fetchInjuriesForFixture(fixtureId: number): Promise<
  Array<{
    match_id: number;
    team_id: number;
    player_name: string;
    player_photo: string | null;
    reason: "injury" | "suspension" | "other";
    type: string | null;
    detail: string | null;
  }>
> {
  const response = await af<AfInjury[]>("/injuries", { fixture: fixtureId });
  if (!response.length) return [];

  return response.map((entry) => {
    const rawReason = (entry.player.reason ?? "").toLowerCase();
    const reason: "injury" | "suspension" | "other" = rawReason.includes("suspend")
      ? "suspension"
      : rawReason.includes("injury") || rawReason.includes("doubtful") || rawReason.includes("missing")
      ? "injury"
      : "other";

    return {
      match_id: fixtureId,
      team_id: entry.team.id,
      player_name: entry.player.name,
      player_photo: entry.player.photo || null,
      reason,
      type: entry.player.type || null,
      detail: entry.player.reason || null,
    };
  });
}

// ── Lineups ───────────────────────────────────────────────────────────────────

interface AfLineupPlayer {
  player: { id: number; name: string; number: number; pos: string; grid: string; photo: string };
}

interface AfLineup {
  team: { id: number; name: string; logo: string };
  formation: string;
  startXI: AfLineupPlayer[];
  substitutes: AfLineupPlayer[];
}

export interface LineupPlayer {
  name: string;
  number: number;
  pos: string; // "G" | "D" | "M" | "F"
  photo?: string;
  grid?: string; // e.g. "1:1" row:col
}

export interface TeamLineup {
  formation: string;
  startXI: LineupPlayer[];
}

export interface MatchLineups {
  home: TeamLineup;
  away: TeamLineup;
}

/**
 * Fetches confirmed lineups for a fixture from API-Football `/fixtures/lineups`.
 * The endpoint returns data only ~1 hour before kickoff.
 * Returns null if lineups are not yet available or the fixture has no data.
 */
export async function fetchLineupsForFixture(
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number,
): Promise<MatchLineups | null> {
  try {
    const response = await af<AfLineup[]>("/fixtures/lineups", { fixture: fixtureId });
    if (!response || response.length < 2) return null;

    function mapTeam(lineup: AfLineup): TeamLineup {
      return {
        formation: lineup.formation ?? "",
        startXI: lineup.startXI.map((p) => ({
          name: p.player.name,
          number: p.player.number,
          pos: p.player.pos,
          photo: p.player.photo || undefined,
          grid: p.player.grid || undefined,
        })),
      };
    }

    const homeEntry = response.find((l) => l.team.id === homeTeamId) ?? response[0];
    const awayEntry = response.find((l) => l.team.id === awayTeamId) ?? response[1];

    if (!homeEntry?.startXI?.length || !awayEntry?.startXI?.length) return null;

    return { home: mapTeam(homeEntry), away: mapTeam(awayEntry) };
  } catch {
    return null;
  }
}

/**
 * slugToId: mapa de slug → bookmaker_id obtenido desde la tabla public.bookmakers.
 * Pasar siempre este parámetro para evitar que los IDs queden hardcodeados
 * y desincronizados con la base de datos.
 */
export async function fetchOddsForFixtures(
  fixtureId: number,
  slugToId: Record<string, number>,
) {
  const response = await af<AfOddsResponse[]>("/odds", { fixture: fixtureId });
  if (!response.length) return [];

  const out: any[] = [];
  for (const entry of response) {
    for (const book of entry.bookmakers) {
      const slug = BOOKMAKER_NAME_TO_SLUG[book.name];
      if (!slug) continue;
      const bookmakerId = slugToId[slug];
      if (!bookmakerId) continue;

      for (const bet of book.bets) {
        const resolve = MARKET_MAP[bet.name];
        if (!resolve) continue;

        for (const v of bet.values) {
          const mapped = resolve(v.value);
          if (!mapped) continue;
          const price = parseFloat(v.odd);
          if (isNaN(price) || price <= 1) continue;

          out.push({
            match_id: fixtureId,
            bookmaker_id: bookmakerId,
            market: mapped.market,
            selection: mapped.selection,
            price,
            line: mapped.line,
            is_live: false,
          });
        }
      }
    }
  }
  return out;
}
