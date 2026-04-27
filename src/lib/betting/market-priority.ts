/**
 * Prioridad de mercados para ranking de picks.
 *
 * Los mercados de "eventos contables" (córners, amarillas, total de goles) son
 * más predecibles estadísticamente que los de resultado (BTTS, doble oportunidad)
 * y que los de signo puro (1x2, hándicap). Cuando dos picks tienen probabilidad
 * similar, queremos mostrar primero los más sólidos.
 *
 * - `marketRank`: orden lexicográfico (1 = mejor) para sort estable.
 * - `marketWeight`: multiplicador de score (≥1 favorece, <1 penaliza). Se aplica
 *   sobre `modelProb` o `modelProb * (1+edge)` según el caller.
 */

import type { Database } from "@/types/database";

type MarketType = Database["public"]["Enums"]["market_type"];

const RANK: Record<MarketType, number> = {
  corners_over_under: 1,
  cards_over_under: 2,
  over_under_2_5: 3,
  over_under_1_5: 4,
  over_under_3_5: 4,
  btts: 5,
  double_chance: 6,
  draw_no_bet: 7,
  "1x2": 8,
  asian_handicap: 8,
  correct_score: 9,
};

const WEIGHT: Record<number, number> = {
  1: 1.20,
  2: 1.15,
  3: 1.10,
  4: 1.05,
  5: 1.00,
  6: 0.95,
  7: 0.90,
  8: 0.85,
  9: 0.80,
};

export function marketRank(market: MarketType | string | null | undefined): number {
  if (!market) return 99;
  return RANK[market as MarketType] ?? 99;
}

export function marketWeight(market: MarketType | string | null | undefined): number {
  return WEIGHT[marketRank(market)] ?? 1.0;
}
