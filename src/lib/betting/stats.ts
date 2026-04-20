/**
 * Promedios históricos de córners y tarjetas por liga.
 *
 * Usados como modelo estadístico base cuando no hay datos por equipo disponibles.
 * Los valores son promedios por equipo/partido (home = equipo local, away = visitante).
 * Fuente: FBRef / Understat / promedios históricos de temporadas recientes.
 *
 * Segunda iteración: reemplazar con promedios reales por equipo almacenados en DB.
 */

export interface TeamAvg {
  home: number;
  away: number;
}

/**
 * Córners esperados por equipo por partido.
 * Totales típicos: Premier ~10.2, La Liga ~9.5, Bundesliga ~10.5.
 */
export const LEAGUE_AVG_CORNERS: Record<number, TeamAvg> = {
  39:  { home: 5.4, away: 4.8 }, // Premier League
  140: { home: 5.0, away: 4.5 }, // La Liga
  78:  { home: 5.5, away: 5.0 }, // Bundesliga
  135: { home: 5.2, away: 4.7 }, // Serie A
  61:  { home: 4.8, away: 4.3 }, // Ligue 1
  2:   { home: 5.3, away: 4.8 }, // Champions League
  3:   { home: 5.0, away: 4.5 }, // Europa League
  848: { home: 4.8, away: 4.3 }, // Conference League
  13:  { home: 4.8, away: 4.3 }, // Copa Libertadores
  239: { home: 4.5, away: 4.0 }, // Liga BetPlay Colombia
};

export const DEFAULT_CORNERS: TeamAvg = { home: 5.0, away: 4.5 };

/**
 * Tarjetas amarillas esperadas por equipo por partido.
 * La Liga tiene la tasa más alta del top 5 europeo (~4.5 totales).
 */
export const LEAGUE_AVG_CARDS: Record<number, TeamAvg> = {
  39:  { home: 1.7, away: 1.9 }, // Premier League   (~3.6 total)
  140: { home: 2.1, away: 2.4 }, // La Liga           (~4.5 total)
  78:  { home: 1.8, away: 2.0 }, // Bundesliga        (~3.8 total)
  135: { home: 2.0, away: 2.2 }, // Serie A            (~4.2 total)
  61:  { home: 1.8, away: 2.0 }, // Ligue 1            (~3.8 total)
  2:   { home: 1.7, away: 1.9 }, // Champions League  (~3.6 total)
  3:   { home: 1.8, away: 2.0 }, // Europa League      (~3.8 total)
  848: { home: 1.7, away: 1.9 }, // Conference League (~3.6 total)
  13:  { home: 2.0, away: 2.2 }, // Copa Libertadores (~4.2 total)
  239: { home: 2.2, away: 2.4 }, // Liga BetPlay       (~4.6 total)
};

export const DEFAULT_CARDS: TeamAvg = { home: 1.9, away: 2.1 };
