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

/**
 * Ligas con calendario por año natural (Ene→Dic). El resto sigue el calendario
 * europeo (Ago→May), que API-Football identifica con el año de inicio.
 *
 *  - Mundial / Eurocopa / Copa América → torneo en un único año
 *  - Libertadores / Sudamericana → temporada por año natural
 *  - Liga BetPlay (Colombia), MLS, Brasileirão → calendario natural
 */
const CALENDAR_YEAR_LEAGUES = new Set<number>([1, 4, 9, 13, 11, 71, 239, 253]);

/**
 * Devuelve la temporada vigente para una liga en API-Football. Para ligas
 * europeas usa el año de inicio (Ago 2025 – May 2026 → 2025); para ligas de
 * año natural usa el año actual.
 *
 * Esto evita depender del valor estático en `public.leagues.season`, que
 * inevitablemente se queda atrás cada vez que arranca una temporada nueva.
 */
export function currentSeasonForLeague(leagueId: number, today: Date = new Date()): number {
  const year = today.getUTCFullYear();
  if (CALENDAR_YEAR_LEAGUES.has(leagueId)) return year;
  // Ligas europeas: la temporada nueva arranca en agosto (mes índice 7).
  return today.getUTCMonth() >= 7 ? year : year - 1;
}

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

const CORNER_BET_NAMES = [
  "Corners Over Under",
  "Corners Over/Under",
  "Total Corners",
  "Total - Corners",
  "Asian Corners",
  "Asian Total Corners",
  "Corners 1x2 (Total)",
];

const CARD_BET_NAMES = [
  "Cards Over/Under",
  "Cards Over Under",
  "Total Cards",
  "Total Yellow Cards",
  "Yellow Cards",
  "Yellow Over/Under",
  "Booking Points Over/Under",
  "Total Bookings",
];

function buildCornerAliases(): Record<string, OddsMapping> {
  const parser: OddsMapping = (v) => {
    const parsed = parseOverUnder(v, [8.5, 9.5, 10.5]);
    if (!parsed) return null;
    return { market: "corners_over_under", selection: parsed.dir, line: parsed.lineVal };
  };
  return Object.fromEntries(CORNER_BET_NAMES.map((name) => [name, parser]));
}

function buildCardAliases(): Record<string, OddsMapping> {
  const parser: OddsMapping = (v) => {
    const parsed = parseOverUnder(v, [3.5, 4.5]);
    if (!parsed) return null;
    return { market: "cards_over_under", selection: parsed.dir, line: parsed.lineVal };
  };
  return Object.fromEntries(CARD_BET_NAMES.map((name) => [name, parser]));
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
  // Registrado bajo múltiples nombres porque API-Football los envía distintos
  // según la casa: bet365 usa "Corners Over Under", Pinnacle "Total Corners",
  // 1xBet "Corners 1x2 (Total)", etc.
  ...buildCornerAliases(),

  // ── Tarjetas amarillas Over/Under (líneas 3.5 y 4.5) ─────────────────────
  ...buildCardAliases(),

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

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: headers(),
        next: { revalidate: revalidateSec, ...(tag ? { tags: [tag] } : {}) },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        if (!isRetryable(res.status) || attempt === MAX_ATTEMPTS) {
          throw new Error(`API-Football ${path} -> ${res.status} ${res.statusText}`);
        }
        lastError = new Error(`HTTP ${res.status}`);
      } else {
        const json = await res.json();
        if (json.errors && Object.keys(json.errors).length > 0) {
          // errors.requests = "daily limit" es determinista, no reintentamos
          throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
        }
        return json.response as T;
      }
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS) break;
    }
    // backoff suave — 500ms, 1500ms
    await new Promise((r) => setTimeout(r, 500 * attempt * (1 + Math.random() * 0.3)));
  }
  throw lastError instanceof Error ? lastError : new Error("API-Football no disponible");
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

export type NextFixtureResult =
  | { kind: "ok"; fixture: NextFixtureForTeam }
  | { kind: "empty" }            // API respondió OK pero no hay fixture programado
  | { kind: "error"; reason: string }; // fallo de red/config (key, cuota, 5xx)

function buildFixture(f: AfFixture): NextFixtureForTeam {
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
}

function pickNextUpcoming(fixtures: AfFixture[]): AfFixture | null {
  const nowMs = Date.now();
  const upcoming = fixtures
    .filter((f) => {
      const t = new Date(f.fixture.date).getTime();
      if (Number.isNaN(t) || t < nowMs - 3 * 3600 * 1000) return false;
      return !["FT", "AET", "PEN", "CANC", "ABD"].includes(f.fixture.status.short);
    })
    .sort(
      (a, b) =>
        new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime(),
    );
  return upcoming[0] ?? null;
}

/**
 * Próximo partido confirmado de un equipo — usado por /analisis como fallback
 * cuando la BD aún no lo tiene sincronizado (liga fuera del set high-priority).
 *
 * Estrategia (3 intentos en cascada, paramos en el primero que devuelva fixture):
 *   1) `team + next=20` — devuelve los próximos 20 partidos del equipo en
 *      cualquier competición. En el plan Pro suele ser la respuesta más rápida
 *      y exhaustiva, pero a veces API-Football pide `season` obligatorio.
 *   2) `team + season=year` y `team + season=year-1` en paralelo — cubre el
 *      año europeo (Aug-May) y el calendario natural (Jan-Dec).
 *   3) `team + season=year + from/to` por si season-only devuelve sólo
 *      históricos para equipos con muchas competiciones (Champions+Liga+Copa).
 *
 * Cache corta (5 min) para que respuestas vacías transitorias no bloqueen
 * al usuario media hora. Con plan Pro (7500 req/día) el coste es asumible.
 */
export async function fetchNextFixtureForTeam(teamId: number): Promise<NextFixtureResult> {
  const errors: string[] = [];

  // ── Intento 1: next=20 (sin season) ───────────────────────────────────
  try {
    const data = await afCached<AfFixture[]>(
      "/fixtures",
      { team: teamId, next: 20 },
      5 * 60,
      `team-${teamId}-next20`,
    );
    const hit = pickNextUpcoming(data);
    if (hit) return { kind: "ok", fixture: buildFixture(hit) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // "Season field is required" = el plan/endpoint exige season → seguimos.
    if (!/season/i.test(msg)) errors.push(`next20: ${msg}`);
  }

  // ── Intento 2: por temporada actual y anterior ────────────────────────
  const now = new Date();
  const year = now.getFullYear();
  const candidates = [year, year - 1];

  const seasonResults = await Promise.all(
    candidates.map((season) =>
      afCached<AfFixture[]>(
        "/fixtures",
        { team: teamId, season },
        5 * 60,
        `team-${teamId}-season-${season}`,
      )
        .then((r) => ({ ok: true as const, data: r, season }))
        .catch((e) => ({ ok: false as const, error: e, season })),
    ),
  );

  const allFixtures: AfFixture[] = seasonResults.flatMap((r) => (r.ok ? r.data : []));
  const seasonHit = pickNextUpcoming(allFixtures);
  if (seasonHit) return { kind: "ok", fixture: buildFixture(seasonHit) };

  for (const r of seasonResults) {
    if (!r.ok) {
      const msg = r.error instanceof Error ? r.error.message : String(r.error);
      errors.push(`season=${r.season}: ${msg}`);
    }
  }

  // ── Intento 3: season + from/to explícito (60 días) ───────────────────
  // Cubre el caso raro donde season-only devuelve sólo el histórico para
  // equipos con muchas competiciones. Probamos las dos seasons.
  const fromIso = new Date(now.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const toIso = new Date(now.getTime() + 60 * 86400 * 1000).toISOString().slice(0, 10);

  const rangeResults = await Promise.all(
    candidates.map((season) =>
      afCached<AfFixture[]>(
        "/fixtures",
        { team: teamId, season, from: fromIso, to: toIso },
        5 * 60,
        `team-${teamId}-season-${season}-range`,
      )
        .then((r) => ({ ok: true as const, data: r, season }))
        .catch((e) => ({ ok: false as const, error: e, season })),
    ),
  );

  const rangeFixtures: AfFixture[] = rangeResults.flatMap((r) => (r.ok ? r.data : []));
  const rangeHit = pickNextUpcoming(rangeFixtures);
  if (rangeHit) return { kind: "ok", fixture: buildFixture(rangeHit) };

  for (const r of rangeResults) {
    if (!r.ok) {
      const msg = r.error instanceof Error ? r.error.message : String(r.error);
      errors.push(`range season=${r.season}: ${msg}`);
    }
  }

  // Si TODOS los intentos fallaron por error (no por respuesta vacía),
  // surfaceamos el primer mensaje útil. Si simplemente no hubo fixtures,
  // devolvemos empty para que la UI muestre el mensaje correcto.
  if (errors.length > 0 && allFixtures.length === 0 && rangeFixtures.length === 0) {
    return { kind: "error", reason: errors[0] };
  }
  return { kind: "empty" };
}

interface AfTeamSearch {
  team: { id: number; name: string; country: string; logo: string | null };
  venue?: { name: string | null; city: string | null };
}

/**
 * Busca un equipo en API-Football por nombre. Útil cuando el team_id en nuestra
 * BD no coincide con el de API-Football (filas legacy) y necesitamos recuperar
 * el ID correcto para consultar fixtures/predictions.
 *
 * Cachea 7 días por nombre+país: los nombres cambian raramente.
 */
export async function fetchTeamByName(
  name: string,
  country?: string,
): Promise<{ id: number; name: string; country: string; logo: string | null } | null> {
  try {
    const params: Record<string, string | number> = { search: name.slice(0, 60) };
    if (country) params.country = country;
    const cacheKey = `team-search-${name.toLowerCase()}-${country ?? ""}`
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 120);
    const response = await afCached<AfTeamSearch[]>(
      "/teams",
      params,
      7 * 86400,
      cacheKey,
    );
    if (!response.length) return null;

    const needle = name.toLowerCase().trim();
    // Exact match preferred; si no, devolvemos el primer candidato.
    const exact = response.find((r) => r.team.name.toLowerCase() === needle);
    const best = exact ?? response[0];
    return {
      id: best.team.id,
      name: best.team.name,
      country: best.team.country,
      logo: best.team.logo,
    };
  } catch (err) {
    console.warn("[fetchTeamByName] falló:", err);
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
 * xG promedio por liga — sólo se usa como ESCALA al derivar xG desde la
 * predicción de porcentajes 1x2 (paso 2). El home/away ratio viene de la
 * derivación específica del partido; estos valores únicamente normalizan
 * el total al rango realista de la liga.
 *
 * NO se usan como fallback final: si /predictions no devuelve nada útil,
 * preferimos retornar null antes que asumir un xG genérico de liga
 * (eso producía "value bets" para equipos débiles porque a un Pereira
 * último de la tabla le aplicábamos el mismo xG que a un puntero).
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

const DEFAULT_LEAGUE_AVG_XG: [number, number] = [1.40, 1.10];

/**
 * Devuelve los xG estimados para un fixture, o `null` cuando API-Football
 * no entrega una predicción específica del partido.
 *
 * Estrategia (en orden):
 *  1. Toma `predictions.goals.home/away` si vienen explícitos y > 0.
 *  2. Si hay `predictions.percent` (1x2), deriva xG por grid-search Poisson
 *     y escala el total al promedio de la liga.
 *  3. Si nada de lo anterior está disponible, retorna `null`.
 *
 * Antes existía un paso 3 que devolvía `LEAGUE_AVG_XG[leagueId]` como
 * último recurso. Eso producía "value bets" tóxicas: con xG genérico
 * (~1.4 home / 1.1 away) el Poisson estima ~71% para "local o empate"
 * sea cual sea el partido — y los bookmakers, que SÍ saben quién es
 * último de la tabla, ofrecen 1X de equipos débiles a cuotas altas.
 * El edge resultante (>50%) era ruido del modelo, no valor real.
 *
 * Con `null` los crons saltan el match (sólo procesan los que tienen xG)
 * y la página /analisis muestra "Modelo aún no disponible" en lugar de
 * un análisis fabricado.
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
          const [leagueHome, leagueAway] =
            (leagueId ? LEAGUE_AVG_XG[leagueId] : null) ?? DEFAULT_LEAGUE_AVG_XG;
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
    // Fallo silencioso — caemos al return null
  }

  // Sin predicción específica del partido. Mejor null que xG genérico.
  return null;
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

/**
 * Devuelve estadísticas finales de un partido — totales por partido sumando
 * ambos equipos. Usado para resolver bets de córners y tarjetas amarillas.
 *
 * Llama a /fixtures/statistics?fixture={id}. Una request por fixture.
 * Devuelve null si la API no tiene stats todavía (común en ligas menores
 * o en los primeros minutos tras el pitido final).
 *
 * Nota: API-Football devuelve "Yellow Cards" y "Red Cards" como tipos
 * separados; aquí sumamos solo amarillas porque nuestros mercados de
 * cards_over_under apuntan a tarjetas amarillas exclusivamente.
 */
interface AfTeamStat {
  team: { id: number; name: string };
  statistics: Array<{ type: string; value: number | string | null }>;
}

export interface TeamStatBreakdown {
  teamId: number;
  corners: number | null;
  yellowCards: number | null;
  redCards: number | null;
}

export interface FixtureStatistics {
  totalCorners: number | null;
  totalYellowCards: number | null;
  totalRedCards: number | null;
  perTeam: TeamStatBreakdown[];
}

export async function fetchFixtureStatistics(
  fixtureId: number,
): Promise<FixtureStatistics | null> {
  const response = await af<AfTeamStat[]>("/fixtures/statistics", {
    fixture: fixtureId,
  });
  if (!response?.length) return null;

  const readStat = (team: AfTeamStat, typeName: string): number | null => {
    const entry = team.statistics?.find((s) => s.type === typeName);
    if (!entry || entry.value == null) return null;
    const n = typeof entry.value === "number" ? entry.value : Number(entry.value);
    return Number.isFinite(n) ? n : null;
  };

  const perTeam: TeamStatBreakdown[] = response.map((team) => ({
    teamId: team.team.id,
    corners: readStat(team, "Corner Kicks"),
    yellowCards: readStat(team, "Yellow Cards"),
    redCards: readStat(team, "Red Cards"),
  }));

  const sumOrNull = (key: keyof Omit<TeamStatBreakdown, "teamId">): number | null => {
    let total = 0;
    let found = false;
    for (const t of perTeam) {
      const v = t[key];
      if (v == null) continue;
      total += v;
      found = true;
    }
    return found ? total : null;
  };

  return {
    totalCorners: sumOrNull("corners"),
    totalYellowCards: sumOrNull("yellowCards"),
    totalRedCards: sumOrNull("redCards"),
    perTeam,
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

  // Dedup por la clave única (match_id, bookmaker_id, market, selection, line):
  // córners y tarjetas tienen varios alias (`Total Corners`, `Corners Over Under`,
  // `Corners 1x2 (Total)`...) que API-Football devuelve para la misma casa, lo
  // que generaba duplicados → el upsert con onConflict los rechazaba con
  // "ON CONFLICT DO UPDATE command cannot affect row a second time" y caía
  // todo el batch en silencio (matches sin cuotas).
  // Política: nos quedamos con el precio más alto (mejor para el apostador).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dedup = new Map<string, any>();

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

          const key = `${bookmakerId}|${mapped.market}|${mapped.selection}|${mapped.line ?? ""}`;
          const existing = dedup.get(key);
          if (!existing || price > existing.price) {
            dedup.set(key, {
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
  }
  return [...dedup.values()];
}
