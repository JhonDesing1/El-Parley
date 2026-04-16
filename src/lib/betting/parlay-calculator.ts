/**
 * Cálculo de parlays (apuestas combinadas / acumuladas).
 *
 * Asume INDEPENDENCIA entre selecciones, lo cual no es estrictamente cierto
 * (dos goleadores del mismo equipo están correlacionados, por ejemplo) pero es
 * la aproximación estándar de la industria.
 *
 * Para correlaciones fuertes, mostramos un warning al usuario en el builder.
 */

export interface ParlayLeg {
  matchId: number;
  market: string;
  selection: string;
  decimalOdds: number;
  modelProb?: number; // si lo tenemos, calculamos EV real
}

export interface ParlayResult {
  totalOdds: number;
  combinedImpliedProb: number; // sin ajuste
  combinedModelProb?: number; // con modelo
  expectedValue?: number;
  edge?: number;
  isValue?: boolean;
  warnings: string[];
}

export function calculateParlay(legs: ParlayLeg[]): ParlayResult {
  if (legs.length < 2) {
    throw new Error("Un parlay requiere al menos 2 selecciones");
  }
  if (legs.length > 12) {
    throw new Error("Máximo 12 selecciones (las casas no aceptan más)");
  }

  const totalOdds = legs.reduce((acc, leg) => acc * leg.decimalOdds, 1);
  const combinedImpliedProb = legs.reduce(
    (acc, leg) => acc * (1 / leg.decimalOdds),
    1,
  );

  const warnings: string[] = [];

  // Detectar correlaciones obvias
  const matchCount = new Map<number, number>();
  legs.forEach((l) => matchCount.set(l.matchId, (matchCount.get(l.matchId) ?? 0) + 1));
  for (const [matchId, count] of matchCount) {
    if (count > 1) {
      warnings.push(
        `Hay ${count} selecciones del mismo partido (#${matchId}). Las casas suelen rechazar parlays con correlación o reducen pagos.`,
      );
    }
  }

  if (legs.length > 6) {
    warnings.push(
      `${legs.length} selecciones es estadísticamente improbable. La probabilidad combinada cae exponencialmente.`,
    );
  }

  const allHaveModel = legs.every((l) => l.modelProb !== undefined);
  if (allHaveModel) {
    const combinedModelProb = legs.reduce(
      (acc, leg) => acc * (leg.modelProb as number),
      1,
    );
    const expectedValue = combinedModelProb * (totalOdds - 1) - (1 - combinedModelProb);
    const edge = combinedModelProb * totalOdds - 1;
    return {
      totalOdds,
      combinedImpliedProb,
      combinedModelProb,
      expectedValue,
      edge,
      isValue: edge >= 0.05, // exigimos +5% en parlays por la varianza
      warnings,
    };
  }

  return { totalOdds, combinedImpliedProb, warnings };
}

/**
 * Genera el "parlay del día": combinación de N selecciones con
 * probabilidad combinada del modelo > umbral.
 *
 * Algoritmo greedy optimizado:
 * 1. Filtra candidatos con prob individual > 55% y confianza medium/high
 * 2. Ordena por score compuesto: modelProb * (1 + edge) si hay edge, o solo modelProb
 * 3. Construye el parlay greedy asegurando prob combinada ≥ minCombinedProb
 * 4. Si no hay suficientes legs de alta prob, relaja el umbral y toma los mejores disponibles
 */
export function generateDailyParlay(
  candidates: Array<ParlayLeg & { confidence: "low" | "medium" | "high"; edge?: number }>,
  options: {
    minLegs?: number;
    maxLegs?: number;
    minCombinedProb?: number;
  } = {},
): ParlayLeg[] | null {
  const { minLegs = 2, maxLegs = 4, minCombinedProb = 0.35 } = options;

  // Solo high/medium confidence con prob individual > 55%
  const filtered = candidates
    .filter((c) => c.confidence !== "low" && (c.modelProb ?? 0) > 0.55)
    .sort((a, b) => {
      // Score = modelProb * (1 + edge) para priorizar bets con más valor esperado
      const scoreA = (a.modelProb ?? 0) * (1 + (a.edge ?? 0));
      const scoreB = (b.modelProb ?? 0) * (1 + (b.edge ?? 0));
      return scoreB - scoreA;
    });

  if (filtered.length < minLegs) return null;

  // Greedy: suma legs mientras la prob combinada se mantenga sobre el umbral
  const selected: typeof filtered = [];
  let combinedProb = 1;

  for (const leg of filtered) {
    if (selected.length >= maxLegs) break;
    const newProb = combinedProb * (leg.modelProb ?? 0);
    // Siempre añadir hasta minLegs; después solo si la prob sigue siendo aceptable
    if (selected.length < minLegs || newProb >= minCombinedProb) {
      selected.push(leg);
      combinedProb = newProb;
    }
  }

  // Si no alcanzamos el umbral pero tenemos suficientes legs, devolver igualmente
  // (el display mostrará la prob real, el usuario decide)
  return selected.length >= minLegs ? selected : null;
}
