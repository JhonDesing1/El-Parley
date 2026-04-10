/**
 * Modelo Poisson para fútbol.
 *
 * Estima la probabilidad de cada marcador posible dadas las "expected goals" (xG)
 * de cada equipo, y de ahí deriva probabilidades de 1X2, Over/Under y BTTS.
 *
 * Referencias:
 *  - Maher (1982) "Modelling association football scores"
 *  - Dixon & Coles (1997) ajuste para marcadores bajos
 */

/** Probabilidad de marcar exactamente k goles dado lambda (goles esperados). */
export function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  // log-space para estabilidad numérica
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/** Matriz de probabilidades de marcadores hasta maxGoals x maxGoals. */
export function scoreMatrix(
  homeXg: number,
  awayXg: number,
  maxGoals = 8,
): number[][] {
  const matrix: number[][] = [];
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      matrix[h][a] = poissonPMF(h, homeXg) * poissonPMF(a, awayXg);
    }
  }
  return matrix;
}

/** Ajuste Dixon-Coles para marcadores bajos (0-0, 1-0, 0-1, 1-1). */
function dixonColesAdjustment(
  h: number,
  a: number,
  homeXg: number,
  awayXg: number,
  rho = -0.1,
): number {
  if (h === 0 && a === 0) return 1 - homeXg * awayXg * rho;
  if (h === 0 && a === 1) return 1 + homeXg * rho;
  if (h === 1 && a === 0) return 1 + awayXg * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

export interface MatchProbabilities {
  home: number;
  draw: number;
  away: number;
  over25: number;
  under25: number;
  over15: number;
  under15: number;
  btts: number;
  noBtts: number;
  mostLikelyScore: { home: number; away: number; probability: number };
}

/** Todas las probabilidades para un partido usando Poisson + Dixon-Coles. */
export function calculateMatchProbabilities(
  homeXg: number,
  awayXg: number,
  options: { applyDixonColes?: boolean; maxGoals?: number } = {},
): MatchProbabilities {
  const { applyDixonColes = true, maxGoals = 8 } = options;
  const matrix = scoreMatrix(homeXg, awayXg, maxGoals);

  if (applyDixonColes) {
    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        matrix[h][a] *= dixonColesAdjustment(h, a, homeXg, awayXg);
      }
    }
  }

  let home = 0,
    draw = 0,
    away = 0;
  let over15 = 0,
    over25 = 0;
  let btts = 0;
  let mostLikely = { home: 0, away: 0, probability: 0 };

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = matrix[h][a];
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;

      if (h + a > 1) over15 += p;
      if (h + a > 2) over25 += p;
      if (h > 0 && a > 0) btts += p;

      if (p > mostLikely.probability) {
        mostLikely = { home: h, away: a, probability: p };
      }
    }
  }

  // Normalizar por si la matriz truncada no suma exactamente 1
  const total = home + draw + away;
  home /= total;
  draw /= total;
  away /= total;

  return {
    home,
    draw,
    away,
    over25,
    under25: 1 - over25,
    over15,
    under15: 1 - over15,
    btts,
    noBtts: 1 - btts,
    mostLikelyScore: mostLikely,
  };
}
