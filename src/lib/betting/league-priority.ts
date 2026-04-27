/**
 * Prioridad de competiciones para ranking de picks.
 *
 * Tier 1 — Selecciones top (Mundial, Eurocopa, Copa América)
 * Tier 2 — Continentales top (Champions, Libertadores)
 * Tier 3 — Top 5 ligas europeas
 * Tier 4 — Continentales 2ª (Europa League, Conference)
 * Tier 5 — Locales relevantes (Liga BetPlay, MLS)
 * Tier 6 — Resto
 *
 * Los IDs corresponden a los de API-Football y a `public.leagues.id`.
 *
 * - `leagueTier`: tier numérico (1 = mejor) para sort estable.
 * - `leagueWeight`: multiplicador de score (>1 favorece, <1 penaliza).
 */

const TIER_BY_LEAGUE: Record<number, number> = {
  // Tier 1 — selecciones
  1: 1,    // World Cup
  4: 1,    // UEFA Euro
  9: 1,    // Copa America

  // Tier 2 — continentales top
  2: 2,    // UEFA Champions League
  13: 2,   // Copa Libertadores

  // Tier 3 — top 5 europeas
  39: 3,   // Premier League
  140: 3,  // La Liga
  135: 3,  // Serie A
  78: 3,   // Bundesliga
  61: 3,   // Ligue 1

  // Tier 4 — continentales secundarias
  3: 4,    // UEFA Europa League
  848: 4,  // UEFA Conference League
  11: 4,   // Copa Sudamericana

  // Tier 5 — locales relevantes
  239: 5,  // Liga BetPlay (Colombia)
  253: 5,  // MLS
};

const TIER_WEIGHT: Record<number, number> = {
  1: 1.30,
  2: 1.20,
  3: 1.10,
  4: 1.00,
  5: 0.90,
  6: 0.80,
};

const FALLBACK_TIER = 6;

export function leagueTier(leagueId: number | null | undefined): number {
  if (leagueId == null) return FALLBACK_TIER;
  return TIER_BY_LEAGUE[leagueId] ?? FALLBACK_TIER;
}

export function leagueWeight(leagueId: number | null | undefined): number {
  return TIER_WEIGHT[leagueTier(leagueId)] ?? TIER_WEIGHT[FALLBACK_TIER];
}
