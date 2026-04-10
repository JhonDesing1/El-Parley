/**
 * Probabilidad implícita y eliminación del margen de la casa.
 *
 * La cuota decimal de una casa codifica su probabilidad + un margen ("vig").
 * Para detectar value bets necesitamos quitar ese margen.
 */

/** Convierte una cuota decimal a probabilidad implícita cruda (con margen). */
export function impliedProbability(decimalOdds: number): number {
  if (decimalOdds <= 1) throw new Error("La cuota debe ser > 1");
  return 1 / decimalOdds;
}

/** Margen total del libro (overround) para un set de cuotas 1x2. */
export function overround(odds: number[]): number {
  return odds.reduce((sum, o) => sum + impliedProbability(o), 0) - 1;
}

/**
 * Elimina el margen usando el método multiplicativo (el más simple y común).
 * Devuelve probabilidades que suman exactamente 1.
 */
export function removeVigMultiplicative(odds: number[]): number[] {
  const rawProbs = odds.map(impliedProbability);
  const total = rawProbs.reduce((a, b) => a + b, 0);
  return rawProbs.map((p) => p / total);
}

/**
 * Método Shin — más preciso para eventos con favoritos fuertes.
 * Asume que parte del margen se debe a "insider trading" (apostadores informados).
 * https://en.wikipedia.org/wiki/Shin%27s_method
 */
export function removeVigShin(odds: number[]): number[] {
  const rawProbs = odds.map(impliedProbability);
  const n = rawProbs.length;
  const sumProbs = rawProbs.reduce((a, b) => a + b, 0);

  // Resolver z iterativamente (método de punto fijo)
  let z = 0;
  for (let i = 0; i < 1000; i++) {
    const newZ =
      (rawProbs.reduce(
        (acc, p) => acc + Math.sqrt(z * z + 4 * (1 - z) * (p * p) / sumProbs),
        0,
      ) -
        2) /
      (n - 2);
    if (Math.abs(newZ - z) < 1e-12) break;
    z = newZ;
  }

  return rawProbs.map(
    (p) =>
      (Math.sqrt(z * z + 4 * (1 - z) * (p * p) / sumProbs) - z) / (2 * (1 - z)),
  );
}

/** Convierte una probabilidad de vuelta a cuota "fair" (sin margen). */
export function probabilityToFairOdds(prob: number): number {
  if (prob <= 0 || prob >= 1) throw new Error("Probabilidad fuera de rango");
  return 1 / prob;
}
