/**
 * Precios "justos" derivados de Pinnacle.
 *
 * Pinnacle es la casa con menor margen del mercado (~2%, vs 6-12% en soft
 * books colombianas). Sus líneas se consideran la mejor aproximación al
 * precio eficiente. Si la quitamos el vig (margen), obtenemos la mejor
 * estimación pública de la probabilidad real del evento.
 *
 * Caso de uso principal: comparar cuotas de Betplay/Wplay/Codere/1xBet
 * contra Pinnacle de-vigada → detecta "value real", que es mucho más
 * confiable que comparar contra un modelo Poisson genérico.
 *
 *   edge_pinnacle = cuota_soft × pinnacle_fair_prob − 1
 *
 *   > 0  →  la soft book paga MEJOR que el precio justo → value
 *   < 0  →  la soft book paga PEOR  que el precio justo → no value
 *
 * CLV (Closing Line Value) usa la misma fórmula pero con el `pinnacle_fair_prob`
 * capturado en los minutos previos al kickoff (la "closing line"). Es el
 * único KPI que correlaciona empíricamente con rentabilidad a largo plazo.
 */

import { removeVigMultiplicative } from "./implied-probability";

export interface PinnacleOdd {
  market: string;
  selection: string;
  line: number | null;
  price: number;
}

export type PinnacleFairKey = string; // `${market}:${selection}:${line ?? "_"}`

export type PinnacleFairMap = Map<PinnacleFairKey, number>;

export function pinnacleFairKey(
  market: string,
  selection: string,
  line: number | null | undefined,
): PinnacleFairKey {
  return `${market}:${selection}:${line ?? "_"}`;
}

/**
 * Selecciones esperadas por mercado para que el de-vigado sea válido.
 * Si falta cualquiera, el grupo se descarta (no podemos quitar el margen
 * sin tener el set completo).
 */
const MARKET_EXPECTED_SELECTIONS: Record<string, readonly string[]> = {
  "1x2": ["home", "draw", "away"],
  btts: ["yes", "no"],
  double_chance: ["1x", "12", "x2"],
  over_under_1_5: ["over", "under"],
  over_under_2_5: ["over", "under"],
  over_under_3_5: ["over", "under"],
  corners_over_under: ["over", "under"],
  cards_over_under: ["over", "under"],
};

/**
 * De-viga las cuotas de Pinnacle agrupando por (market, line) y devuelve
 * un mapa con la probabilidad justa de cada selección.
 *
 * Mercados de 2 vías (over/under, btts) → multiplicativo equivale a Shin.
 * 1x2 (3 vías) → usamos multiplicativo por simplicidad; Shin es opcional
 * y aporta poco en cuotas líquidas de Pinnacle.
 */
export function pinnacleFairProbs(odds: PinnacleOdd[]): PinnacleFairMap {
  const result: PinnacleFairMap = new Map();
  if (!odds.length) return result;

  // Agrupar por (market, line). El line es parte de la clave porque
  // over 1.5 / over 2.5 son mercados distintos con sumas de probabilidad
  // independientes (no se de-vigan juntos).
  const groups = new Map<string, PinnacleOdd[]>();
  for (const o of odds) {
    const gk = `${o.market}|${o.line ?? "_"}`;
    const bucket = groups.get(gk);
    if (bucket) bucket.push(o);
    else groups.set(gk, [o]);
  }

  for (const group of groups.values()) {
    const market = group[0].market;
    const line = group[0].line;
    const expected = MARKET_EXPECTED_SELECTIONS[market];
    if (!expected) continue;

    // bySelection conserva el último precio si hay duplicados — Pinnacle
    // suele entregar uno solo por (matchupId, market, line, designation).
    const bySelection = new Map<string, number>();
    for (const o of group) bySelection.set(o.selection, o.price);

    if (expected.some((s) => !bySelection.has(s))) continue;

    const prices = expected.map((s) => bySelection.get(s)!);
    if (prices.some((p) => !Number.isFinite(p) || p <= 1)) continue;

    let fair: number[];
    try {
      fair = removeVigMultiplicative(prices);
    } catch {
      continue;
    }

    expected.forEach((sel, i) => {
      result.set(pinnacleFairKey(market, sel, line), fair[i]);
    });
  }

  return result;
}

/**
 * Edge real (en decimal) entre una cuota soft y la probabilidad justa
 * derivada de Pinnacle. Positivo = la soft book paga por encima de Pinnacle.
 */
export function pinnacleEdge(softPrice: number, pinnacleFairProb: number): number {
  if (!Number.isFinite(softPrice) || softPrice <= 1) return -1;
  if (pinnacleFairProb <= 0 || pinnacleFairProb >= 1) return -1;
  return softPrice * pinnacleFairProb - 1;
}
