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

/**
 * CDF de Poisson: P(X <= n) donde X ~ Poisson(lambda).
 * Útil para calcular Over/Under en córners y tarjetas.
 */
export function poissonCDF(n: number, lambda: number): number {
  let cdf = 0;
  for (let k = 0; k <= Math.floor(n); k++) {
    cdf += poissonPMF(k, lambda);
  }
  return Math.min(cdf, 1);
}

/**
 * Probabilidades Over/Under para una línea X.5 usando modelo Poisson.
 * La línea debe ser X.5 para evitar el caso de empate exacto (push).
 */
export function poissonOverUnder(
  line: number,
  lambda: number,
): { over: number; under: number } {
  const under = poissonCDF(Math.floor(line), lambda);
  return { over: 1 - under, under };
}

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
  over35: number;
  under35: number;
  btts: number;
  noBtts: number;
  /** Doble oportunidad: local o empate */
  dc1x: number;
  /** Doble oportunidad: local o visitante */
  dc12: number;
  /** Doble oportunidad: empate o visitante */
  dcx2: number;
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
    over25 = 0,
    over35 = 0;
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
      if (h + a > 3) over35 += p;
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
    over35,
    under35: 1 - over35,
    btts,
    noBtts: 1 - btts,
    dc1x: home + draw,
    dc12: home + away,
    dcx2: draw + away,
    mostLikelyScore: mostLikely,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Córners
// ─────────────────────────────────────────────────────────────────────────────

export interface CornerProbabilities {
  over85: number;
  under85: number;
  over95: number;
  under95: number;
  over105: number;
  under105: number;
}

/**
 * Probabilidades de córners totales del partido usando Poisson.
 * Modela el total como Poisson(homeExpected + awayExpected).
 * Los valores esperados vienen de promedios históricos por liga en stats.ts.
 */
export function calculateCornerProbabilities(
  homeExpected: number,
  awayExpected: number,
): CornerProbabilities {
  const lambda = homeExpected + awayExpected;
  return {
    over85:  poissonOverUnder(8.5,  lambda).over,
    under85: poissonOverUnder(8.5,  lambda).under,
    over95:  poissonOverUnder(9.5,  lambda).over,
    under95: poissonOverUnder(9.5,  lambda).under,
    over105: poissonOverUnder(10.5, lambda).over,
    under105: poissonOverUnder(10.5, lambda).under,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjetas amarillas
// ─────────────────────────────────────────────────────────────────────────────

export interface CardProbabilities {
  over35: number;
  under35: number;
  over45: number;
  under45: number;
}

/**
 * Probabilidades de tarjetas amarillas totales usando Poisson.
 * Modela el total como Poisson(homeExpected + awayExpected).
 */
export function calculateCardProbabilities(
  homeExpected: number,
  awayExpected: number,
): CardProbabilities {
  const lambda = homeExpected + awayExpected;
  return {
    over35:  poissonOverUnder(3.5, lambda).over,
    under35: poissonOverUnder(3.5, lambda).under,
    over45:  poissonOverUnder(4.5, lambda).over,
    under45: poissonOverUnder(4.5, lambda).under,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hándicap asiático
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Probabilidad de que una selección cubra el hándicap asiático.
 * Solo soporta líneas X.5 (sin push / devolución parcial).
 *
 * @param side      "home" | "away" — equipo al que se apuesta
 * @param line      Hándicap desde la perspectiva del equipo seleccionado.
 *                  Negativo = desventaja (debe ganar por margen), positivo = ventaja.
 *
 * Ejemplos:
 *   side="home", line=-1.5 → local gana por 2+ (cubre -1.5)
 *   side="away", line=+1.5 → visitante no pierde por 2+ (cubre +1.5)
 *   side="home", line=+1.5 → local no pierde por 2+ (cubre +1.5)
 */
export function calculateHandicapProbability(
  homeXg: number,
  awayXg: number,
  side: "home" | "away",
  line: number,
  maxGoals = 10,
): number {
  const rho = -0.1; // Dixon-Coles rho
  let prob = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      let p = poissonPMF(h, homeXg) * poissonPMF(a, awayXg);

      // Corrección Dixon-Coles para marcadores bajos
      if (h === 0 && a === 0)      p *= 1 - homeXg * awayXg * rho;
      else if (h === 0 && a === 1) p *= 1 + homeXg * rho;
      else if (h === 1 && a === 0) p *= 1 + awayXg * rho;
      else if (h === 1 && a === 1) p *= 1 - rho;

      // ¿Cubre el hándicap? (solo líneas .5, sin push)
      const margin = side === "home" ? h - a : a - h;
      if (margin + line > 0) prob += p;
    }
  }

  return Math.min(prob, 1);
}
