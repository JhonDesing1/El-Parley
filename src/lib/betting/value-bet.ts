/**
 * Detector de Value Bets.
 *
 * Una apuesta es "value" cuando la probabilidad real estimada por nuestro modelo
 * es mayor que la probabilidad implícita de la cuota ofrecida (sin margen).
 *
 * Edge = (model_prob * odds) - 1
 *     = model_prob / implied_prob_fair - 1
 *
 * Si edge > 0 → la apuesta tiene valor esperado positivo (EV+).
 * Umbral típico: edge ≥ 3% para ignorar ruido del modelo.
 */

import { kellyFraction } from "./kelly";

export interface ValueBetInput {
  modelProb: number; // 0..1
  decimalOdds: number; // cuota ofrecida
  minEdge?: number; // default 0.03
}

export interface ValueBetResult {
  isValue: boolean;
  edge: number; // % expresado como decimal (0.05 = 5%)
  expectedValue: number; // EV por unidad apostada
  kelly: number; // fracción de Kelly sugerida
  confidence: "low" | "medium" | "high";
  impliedProb: number;
}

export function detectValueBet({
  modelProb,
  decimalOdds,
  minEdge = 0.03,
}: ValueBetInput): ValueBetResult {
  if (modelProb <= 0 || modelProb >= 1)
    throw new Error("modelProb fuera de rango");
  if (decimalOdds <= 1) throw new Error("cuota debe ser > 1");

  const impliedProb = 1 / decimalOdds;
  const edge = modelProb * decimalOdds - 1;
  const expectedValue = modelProb * (decimalOdds - 1) - (1 - modelProb);
  const kelly = kellyFraction(modelProb, decimalOdds);

  let confidence: ValueBetResult["confidence"] = "low";
  if (edge >= 0.08 && modelProb >= 0.4) confidence = "high";
  else if (edge >= 0.05) confidence = "medium";

  return {
    isValue: edge >= minEdge,
    edge,
    expectedValue,
    kelly,
    confidence,
    impliedProb,
  };
}

/**
 * Genera un análisis corto orientado al apostador que explica POR QUÉ
 * la apuesta tiene valor, usando los xG del partido como contexto.
 */
export function buildReasoning(
  market: string,
  selection: string,
  modelProb: number,
  impliedProb: number,
  edge: number,
  xgHome: number,
  xgAway: number,
): string {
  const modelPct = (modelProb * 100).toFixed(0);
  const impliedPct = (impliedProb * 100).toFixed(0);
  const edgePct = (edge * 100).toFixed(1);
  const xgTotal = (xgHome + xgAway).toFixed(1);

  switch (`${market}:${selection}`) {
    case "1x2:home":
      return `El local genera más peligro (xG ${xgHome.toFixed(1)} vs ${xgAway.toFixed(1)} visitante). Nuestro modelo estima ~${modelPct}% para victoria local, pero la cuota solo refleja un ${impliedPct}%. Edge: +${edgePct}%.`;
    case "1x2:away":
      return `El visitante supera en ocasiones de gol (xG ${xgAway.toFixed(1)} vs ${xgHome.toFixed(1)} local). El modelo ve ~${modelPct}% para triunfo visitante frente al ${impliedPct}% implícito de la cuota. Edge: +${edgePct}%.`;
    case "1x2:draw":
      return `Los xG de ambos equipos son similares (local ${xgHome.toFixed(1)}, visitante ${xgAway.toFixed(1)}), lo que eleva la probabilidad de empate. El modelo estima ~${modelPct}% vs el ${impliedPct}% que paga la casa. Edge: +${edgePct}%.`;
    case "over_under_2_5:over":
      return `Partido con alto potencial goleador: xG combinado de ${xgTotal} goles esperados. El modelo ve ~${modelPct}% para +2.5 goles, frente al ${impliedPct}% implícito. Edge: +${edgePct}%.`;
    case "over_under_2_5:under":
      return `Partido cerrado previsto: xG combinado de solo ${xgTotal} goles esperados. El modelo estima ~${modelPct}% para -2.5 goles, por encima del ${impliedPct}% implícito. Edge: +${edgePct}%.`;
    case "btts:yes":
      return `Ambos equipos generan ocasiones (xG local ${xgHome.toFixed(1)}, visitante ${xgAway.toFixed(1)}). El modelo estima ~${modelPct}% de probabilidad para que ambos anoten, vs el ${impliedPct}% de la cuota. Edge: +${edgePct}%.`;
    case "btts:no":
      return `Al menos un equipo tiene dificultades ofensivas (xG local ${xgHome.toFixed(1)}, visitante ${xgAway.toFixed(1)}). El modelo ve ~${modelPct}% para que no marquen ambos, frente al ${impliedPct}% implícito. Edge: +${edgePct}%.`;
    default:
      return `Modelo estima ${modelPct}% vs ${impliedPct}% implícita. Edge +${edgePct}%.`;
  }
}

/** Genera una explicación en lenguaje natural para mostrarle al usuario. */
export function explainValueBet(
  result: ValueBetResult,
  context: { selection: string; bookmaker: string; market: string },
): string {
  const edgePct = (result.edge * 100).toFixed(1);
  const modelPct = ((1 / result.impliedProb) * (result.edge + 1) * 100).toFixed(
    0,
  );

  if (!result.isValue) {
    return `Sin valor detectado: la cuota de ${context.bookmaker} refleja o sobreestima la probabilidad real.`;
  }

  const confidenceTxt =
    result.confidence === "high"
      ? "⭐⭐⭐ Alta confianza"
      : result.confidence === "medium"
      ? "⭐⭐ Confianza media"
      : "⭐ Confianza baja";

  return `${confidenceTxt} — Nuestro modelo estima ~${modelPct}% de probabilidad para "${context.selection}" en ${context.market}, mientras ${context.bookmaker} paga una cuota cuya probabilidad implícita es menor. Edge estimado: +${edgePct}%. Staking sugerido: ${(result.kelly * 100).toFixed(1)}% del bankroll (Kelly fraccional).`;
}
