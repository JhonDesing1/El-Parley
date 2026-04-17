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
 * Genera una "Combinada 80%": selecciones donde la probabilidad combinada
 * del modelo supera el 80% y la cuota total objetivo es ≈ 3.5.
 *
 * Algoritmo greedy:
 * 1. Filtra candidatos con modelProb ≥ 0.85 (para mantener prob combinada alta)
 * 2. Ordena por modelProb descendente
 * 3. Añade legs mientras la prob combinada se mantenga ≥ minCombinedProb
 *    y la cuota acumulada no supere targetOdds × 1.3
 * 4. Se detiene al alcanzar el target de odds (±25%)
 */
export function generateValueParlay(
  candidates: Array<ParlayLeg & { confidence: "low" | "medium" | "high"; edge?: number }>,
  options: { targetOdds?: number; minCombinedProb?: number; minIndividualProb?: number } = {},
): ParlayLeg[] | null {
  const { targetOdds = 3.5, minCombinedProb = 0.80, minIndividualProb = 0.82 } = options;

  const filtered = candidates
    .filter((c) => (c.modelProb ?? 0) >= minIndividualProb)
    .sort((a, b) => (b.modelProb ?? 0) - (a.modelProb ?? 0));

  if (filtered.length < 2) return null;

  const selected: typeof filtered = [];
  let combinedOdds = 1;
  let combinedModelProb = 1;

  for (const leg of filtered) {
    const newOdds = combinedOdds * leg.decimalOdds;
    const newProb = combinedModelProb * (leg.modelProb ?? 0);

    // Con ≥2 piernas ya elegidas, detener si la prob combinada caería bajo el umbral
    if (selected.length >= 2 && newProb < minCombinedProb) break;
    // Detener si las cuotas superan el target en más de 30%
    if (newOdds > targetOdds * 1.3) break;

    selected.push(leg);
    combinedOdds = newOdds;
    combinedModelProb = newProb;

    // Alcanzamos el objetivo de cuotas (±25%)
    if (combinedOdds >= targetOdds * 0.75 && selected.length >= 2) break;
  }

  if (selected.length < 2) return null;
  if (combinedModelProb < minCombinedProb) return null;

  return selected;
}

/**
 * Genera el "FunBet del día": combinada de alto riesgo / alta recompensa.
 * Sin restricción de probabilidad combinada — es entretenimiento puro.
 *
 * Algoritmo:
 * 1. Toma todos los candidatos ordenados por cuota individual descendente
 * 2. Acumula hasta que el producto de cuotas alcance el targetOdds (≥70%)
 * 3. Máximo maxLegs piernas
 */
export function generateFunBet(
  candidates: Array<ParlayLeg & { confidence: "low" | "medium" | "high"; edge?: number }>,
  options: { targetOdds?: number; maxLegs?: number } = {},
): ParlayLeg[] | null {
  const { targetOdds = 30, maxLegs = 10 } = options;

  // Deduplicar por matchId (un único bet por partido)
  const seenMatches = new Set<number>();
  const deduped = candidates.filter((c) => {
    if (seenMatches.has(c.matchId)) return false;
    seenMatches.add(c.matchId);
    return true;
  });

  // Ordenar por cuota descendente para alcanzar el target con menos piernas
  const sorted = [...deduped]
    .filter((c) => c.decimalOdds >= 1.25)
    .sort((a, b) => b.decimalOdds - a.decimalOdds);

  if (sorted.length < 2) return null;

  const selected: typeof sorted = [];
  let combinedOdds = 1;

  for (const leg of sorted) {
    if (selected.length >= maxLegs) break;
    selected.push(leg);
    combinedOdds *= leg.decimalOdds;
    if (combinedOdds >= targetOdds * 0.80) break;
  }

  if (selected.length < 2) return null;
  // Debe alcanzar al menos el 60% del target
  if (combinedOdds < targetOdds * 0.60) return null;

  return selected;
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
