/**
 * Kelly Criterion para staking óptimo.
 *
 * f* = (bp - q) / b
 *   b = cuota - 1 (ganancia neta por unidad)
 *   p = probabilidad real estimada
 *   q = 1 - p
 *
 * Recomendamos SIEMPRE Kelly fraccional (1/4 o 1/2) por:
 *   - Incertidumbre del modelo
 *   - Reducción de varianza
 *   - Protección psicológica ante drawdowns
 */

export function kellyFraction(
  modelProb: number,
  decimalOdds: number,
  fraction: 0.25 | 0.5 | 1 = 0.25,
): number {
  const b = decimalOdds - 1;
  const p = modelProb;
  const q = 1 - p;
  const fullKelly = (b * p - q) / b;
  if (fullKelly <= 0) return 0;
  // Capamos en 5% del bankroll por seguridad incluso si Kelly sugiere más
  return Math.min(fullKelly * fraction, 0.05);
}

export function suggestedStake(
  bankroll: number,
  modelProb: number,
  decimalOdds: number,
): number {
  return Math.round(bankroll * kellyFraction(modelProb, decimalOdds) * 100) / 100;
}
