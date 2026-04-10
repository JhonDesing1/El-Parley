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
