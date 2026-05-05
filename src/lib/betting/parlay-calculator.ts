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

  // Pierna desbalanceada: si hay una cuota >2x el promedio del resto, es una
  // pierna de mucha menor probabilidad mezclada con bankers, y arrastra la
  // probabilidad combinada hacia abajo aunque las demás sean seguras.
  if (legs.length >= 3) {
    const oddsList = legs.map((l) => l.decimalOdds);
    for (let i = 0; i < oddsList.length; i++) {
      const others = oddsList.filter((_, j) => j !== i);
      const avgOthers = others.reduce((s, o) => s + o, 0) / others.length;
      if (oddsList[i] > avgOthers * 2 && oddsList[i] >= 2.0) {
        warnings.push(
          `La pierna #${i + 1} (cuota ${oddsList[i].toFixed(2)}) tiene cuota más del doble del promedio del resto (${avgOthers.toFixed(2)}). Es la pierna más débil del parlay y reduce mucho la probabilidad combinada.`,
        );
        break;
      }
    }
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
  candidates: Array<
    ParlayLeg & {
      confidence: "low" | "medium" | "high";
      edge?: number;
      priorityWeight?: number;
      /**
       * Tier numérico de la competición (1 = Champions, mejor). Si está
       * presente, se usa como clave primaria de orden — Champions encabeza
       * el pool antes que cualquier otra liga, sin importar el score crudo.
       */
      priorityTier?: number;
    }
  >,
  options: {
    targetOdds?: number;
    minCombinedProb?: number;
    minIndividualProb?: number;
    /**
     * Cuota individual máxima por pierna. La idea de una "Combinada Segura"
     * es que cada pierna sea un banker (~1.20–1.50) — no permitimos colar
     * una pierna a 2.0+ aunque su modelProb pase el filtro: arrastra la
     * coherencia del producto y descuadra la promesa al usuario.
     */
    maxIndividualOdds?: number;
  } = {},
): ParlayLeg[] | null {
  // Defaults coherentes: con minIndividualProb=0.82 y 2 piernas la combinada
  // máxima es 0.67 — exigir 0.80 hacía que esta función nunca devolviera
  // parlay. Bajamos el suelo a 0.65 para que matemáticamente sea alcanzable
  // y mantenemos el filtro individual estricto.
  const {
    targetOdds = 3.5,
    minCombinedProb = 0.65,
    minIndividualProb = 0.82,
    maxIndividualOdds = 1.50,
  } = options;

  // priorityTier (1 = Champions, mejor) ordena primero — Champions y demás
  // competiciones top encabezan el pool sin que un partido de liga menor con
  // mayor probabilidad bruta los desplace. priorityWeight refina el orden
  // dentro del mismo tier. La matemática combinada sigue usando modelProb crudo.
  const filtered = candidates
    .filter(
      (c) =>
        (c.modelProb ?? 0) >= minIndividualProb &&
        c.decimalOdds <= maxIndividualOdds,
    )
    .sort((a, b) => {
      const tierA = a.priorityTier ?? 99;
      const tierB = b.priorityTier ?? 99;
      if (tierA !== tierB) return tierA - tierB;
      return (
        (b.modelProb ?? 0) * (b.priorityWeight ?? 1) -
        (a.modelProb ?? 0) * (a.priorityWeight ?? 1)
      );
    });

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
 * Genera el "FunBet del día": combinada multi-pierna donde cada pierna es un
 * banker (alta probabilidad, cuota baja), pero el producto da una cuota
 * llamativa.
 *
 * Filosofía: en vez de mezclar piernas con cuotas dispares (1.20 + 1.30 +
 * 5.0) — que hace caer la probabilidad combinada — todas las piernas son
 * "1.30-1.60", y la cuota total atractiva sale del número de piernas. Por
 * ejemplo, 8 piernas a 1.40 promedio dan ~14.8x con probabilidad combinada
 * mucho más realista que un parlay de 4 con un moonshot de 5.0 dentro.
 *
 * Algoritmo:
 *  1. Filtra candidatos con `modelProb ≥ minIndividualProb` y cuota dentro
 *     de [minIndividualOdds, maxIndividualOdds].
 *  2. Deduplica por partido (un bet por partido).
 *  3. Ordena por modelProb DESC × priorityWeight (los bankers más sólidos
 *     primero, con preferencia por competiciones top).
 *  4. Acumula piernas mientras la cuota combinada no supere targetOdds y la
 *     combinada de modelo no caiga por debajo de minCombinedProb.
 *  5. Devuelve null si no se alcanza al menos `minLegs` con cuota ≥ targetOdds×0.7.
 */
export function generateFunBet(
  candidates: Array<
    ParlayLeg & {
      confidence: "low" | "medium" | "high";
      edge?: number;
      priorityWeight?: number;
      priorityTier?: number;
    }
  >,
  options: {
    targetOdds?: number;
    minLegs?: number;
    maxLegs?: number;
    minIndividualProb?: number;
    minIndividualOdds?: number;
    maxIndividualOdds?: number;
    /** Probabilidad combinada mínima del modelo. Por debajo ya no es "fun" sino lotería. */
    minCombinedProb?: number;
  } = {},
): ParlayLeg[] | null {
  const {
    targetOdds = 12,
    minLegs = 4,
    maxLegs = 10,
    minIndividualProb = 0.65,
    minIndividualOdds = 1.25,
    maxIndividualOdds = 1.70,
    minCombinedProb = 0.10,
  } = options;

  // Deduplicar por matchId (un único bet por partido)
  const seenMatches = new Set<number>();
  const deduped = candidates.filter((c) => {
    if (seenMatches.has(c.matchId)) return false;
    seenMatches.add(c.matchId);
    return true;
  });

  // Filtra por banda de cuota y prob individual; ordena por tier de competición
  // primero (Champions encabeza), luego por banker más sólido dentro del tier.
  const sorted = deduped
    .filter(
      (c) =>
        (c.modelProb ?? 0) >= minIndividualProb &&
        c.decimalOdds >= minIndividualOdds &&
        c.decimalOdds <= maxIndividualOdds,
    )
    .sort((a, b) => {
      const tierA = a.priorityTier ?? 99;
      const tierB = b.priorityTier ?? 99;
      if (tierA !== tierB) return tierA - tierB;
      return (
        (b.modelProb ?? 0) * (b.priorityWeight ?? 1) -
        (a.modelProb ?? 0) * (a.priorityWeight ?? 1)
      );
    });

  if (sorted.length < minLegs) return null;

  const selected: typeof sorted = [];
  let combinedOdds = 1;
  let combinedProb = 1;

  for (const leg of sorted) {
    if (selected.length >= maxLegs) break;
    const newOdds = combinedOdds * leg.decimalOdds;
    const newProb = combinedProb * (leg.modelProb ?? 0);

    // No exceder targetOdds: una vez que la cuota combinada ya rebasa el
    // objetivo, parar — agregar una pierna más sería innecesariamente
    // riesgoso aunque cumpliera el filtro.
    if (selected.length >= minLegs && newOdds > targetOdds * 1.10) break;

    // Probabilidad combinada por debajo del piso: paramos antes de
    // degradar el parlay a lotería.
    if (selected.length >= minLegs && newProb < minCombinedProb) break;

    selected.push(leg);
    combinedOdds = newOdds;
    combinedProb = newProb;

    // Alcanzamos el target → corte limpio
    if (selected.length >= minLegs && combinedOdds >= targetOdds) break;
  }

  if (selected.length < minLegs) return null;
  // Sin alcanzar al menos el 70% del target la cuota es poco atractiva
  if (combinedOdds < targetOdds * 0.70) return null;

  return selected;
}

/**
 * Genera hasta `count` combinadas con probabilidad combinada ≥ 90%
 * y cuota total ≥ 1.60 (ganancia neta ≥ 0.60 por unidad apostada).
 *
 * Pensadas para usuarios premium: riesgo muy bajo, cuota atractiva.
 *
 * Algoritmo:
 * 1. Filtra candidatos con prob individual ≥ 0.88 y cuota ≥ 1.10
 * 2. Genera todas las combinaciones de 2 piernas; si faltan, añade de 3
 * 3. Filtra combinaciones donde prob_combinada ≥ 0.90 y cuota_total ≥ 1.60
 * 4. Ordena por EV (prob × cuota − 1) y devuelve las `count` mejores
 *    garantizando diversidad de partidos primarios
 */
export function generatePremium90Parlays(
  candidates: Array<
    ParlayLeg & {
      confidence: "low" | "medium" | "high";
      edge?: number;
      priorityWeight?: number;
      priorityTier?: number;
    }
  >,
  count = 4,
): ParlayLeg[][] {
  const MIN_COMBINED_PROB = 0.90;
  const MIN_TOTAL_ODDS = 1.60;
  const MIN_INDIVIDUAL_PROB = 0.88;
  // Tope de cuota por pierna: con prob ≥ 0.88 la cuota fair máxima es 1.136.
  // Con el cap de edge del modelo (0.25) la cuota real máxima esperable es
  // ~1.42. Ponemos 1.40 como techo duro para evitar que una pierna con
  // prob=0.88 pero cuota=1.80 (escenario raro pero posible con xG legacy)
  // se cuele en una "Combinada 90%".
  const MAX_INDIVIDUAL_ODDS = 1.40;

  // Pre-orden por tier de competición primero (Champions encabeza), luego por
  // modelProb × priorityWeight dentro del mismo tier. Así el pool de top-25 que
  // se usa para combinatoria está dominado por competiciones importantes.
  const filtered = candidates
    .filter(
      (c) =>
        (c.modelProb ?? 0) >= MIN_INDIVIDUAL_PROB &&
        c.decimalOdds >= 1.10 &&
        c.decimalOdds <= MAX_INDIVIDUAL_ODDS,
    )
    .sort((a, b) => {
      const tierA = a.priorityTier ?? 99;
      const tierB = b.priorityTier ?? 99;
      if (tierA !== tierB) return tierA - tierB;
      return (
        (b.modelProb ?? 0) * (b.priorityWeight ?? 1) -
        (a.modelProb ?? 0) * (a.priorityWeight ?? 1)
      );
    });

  if (filtered.length < 2) return [];

  // Cap para evitar explosión combinatoria
  const pool = filtered.slice(0, 25);

  type Combo = { legs: typeof pool; prob: number; odds: number };
  const validCombos: Combo[] = [];

  // ── Combinaciones de 2 piernas ──
  for (let i = 0; i < pool.length - 1; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (pool[i].matchId === pool[j].matchId) continue;
      const prob = (pool[i].modelProb ?? 0) * (pool[j].modelProb ?? 0);
      const odds = pool[i].decimalOdds * pool[j].decimalOdds;
      if (prob >= MIN_COMBINED_PROB && odds >= MIN_TOTAL_ODDS) {
        validCombos.push({ legs: [pool[i], pool[j]], prob, odds });
      }
    }
  }

  // ── Combinaciones de 3 piernas si todavía faltan ──
  if (validCombos.length < count) {
    for (let i = 0; i < pool.length - 2; i++) {
      for (let j = i + 1; j < pool.length - 1; j++) {
        for (let k = j + 1; k < pool.length; k++) {
          const legs = [pool[i], pool[j], pool[k]];
          const matchIds = new Set(legs.map((l) => l.matchId));
          if (matchIds.size < legs.length) continue; // mismo partido en dos piernas
          const prob = legs.reduce((p, l) => p * (l.modelProb ?? 0), 1);
          const odds = legs.reduce((p, l) => p * l.decimalOdds, 1);
          if (prob >= MIN_COMBINED_PROB && odds >= MIN_TOTAL_ODDS) {
            validCombos.push({ legs, prob, odds });
          }
        }
      }
    }
  }

  if (validCombos.length === 0) return [];

  // Ordenar por EV = prob × cuota − 1
  validCombos.sort((a, b) => b.prob * b.odds - a.prob * a.odds);

  // Seleccionar top `count` con diversidad de partido primario
  const selected: Combo[] = [];
  const usedPrimaryMatches = new Set<number>();

  for (const combo of validCombos) {
    if (selected.length >= count) break;
    const primary = combo.legs[0].matchId;
    if (!usedPrimaryMatches.has(primary)) {
      selected.push(combo);
      usedPrimaryMatches.add(primary);
    }
  }

  // Si aún faltan, completar permitiendo solapamiento de partido
  for (const combo of validCombos) {
    if (selected.length >= count) break;
    if (!selected.includes(combo)) selected.push(combo);
  }

  return selected.map((s) => s.legs);
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
  candidates: Array<
    ParlayLeg & {
      confidence: "low" | "medium" | "high";
      edge?: number;
      priorityWeight?: number;
      priorityTier?: number;
    }
  >,
  options: {
    minLegs?: number;
    maxLegs?: number;
    minCombinedProb?: number;
    /** Probabilidad individual mínima por pierna. */
    minIndividualProb?: number;
    /**
     * Cuota máxima por pierna. Evita mezclar bankers (1.30) con un moonshot
     * (4.0) dentro del mismo parlay — que es lo que en la práctica hace caer
     * la probabilidad combinada y rompe la promesa de "todas las piernas son
     * seguras".
     */
    maxIndividualOdds?: number;
  } = {},
): ParlayLeg[] | null {
  const {
    minLegs = 2,
    maxLegs = 4,
    minCombinedProb = 0.35,
    minIndividualProb = 0.65,
    maxIndividualOdds = 1.80,
  } = options;

  // Solo high/medium confidence; prob individual ≥ piso; cuota individual ≤ techo.
  // El piso a 0.65 reemplaza el viejo 0.55: evita que una pierna con 56% de
  // probabilidad (cuota fair ~1.78) entre como pierna "segura" en una
  // combinada que el usuario espera de bankers.
  const filtered = candidates
    .filter(
      (c) =>
        c.confidence !== "low" &&
        (c.modelProb ?? 0) >= minIndividualProb &&
        c.decimalOdds <= maxIndividualOdds,
    )
    .sort((a, b) => {
      // Tier primero (1 = Champions, mejor) — un partido Champions con 0.70
      // prob debe ir antes que un partido de liga menor con 0.85 prob, porque
      // la calidad del rival y la fiabilidad del modelo son superiores en
      // competiciones top.
      const tierA = a.priorityTier ?? 99;
      const tierB = b.priorityTier ?? 99;
      if (tierA !== tierB) return tierA - tierB;
      // Score dentro del tier = modelProb × (1 + edge) × priorityWeight.
      // priorityWeight sólo influye en el orden, no en la matemática combinada
      // que calcula `calculateParlay`.
      const scoreA = (a.modelProb ?? 0) * (1 + (a.edge ?? 0)) * (a.priorityWeight ?? 1);
      const scoreB = (b.modelProb ?? 0) * (1 + (b.edge ?? 0)) * (b.priorityWeight ?? 1);
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

  // Devolver null si no alcanzamos el umbral combinado: el cron debería
  // saltarse este partido en vez de publicar una combinada que no cumple la
  // promesa de probabilidad. (Antes se devolvía igualmente, lo que generaba
  // parlays con `combinedProb << minCombinedProb` y rompía expectativas.)
  if (selected.length < minLegs) return null;
  if (combinedProb < minCombinedProb) return null;
  return selected;
}
