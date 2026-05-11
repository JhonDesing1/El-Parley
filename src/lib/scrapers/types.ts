/**
 * Tipos compartidos por todos los scrapers de cuotas.
 *
 * Cada scraper (kambi.ts, pinnacle.ts, ...) devuelve `ScrapedOdd[]`
 * y la ingesta resuelve `match_id` por nombre + fecha en hora Colombia.
 */

export type Market =
  | "1x2"
  | "over_under_1_5"
  | "over_under_2_5"
  | "over_under_3_5"
  | "btts"
  | "double_chance"
  | "asian_handicap"
  | "draw_no_bet";

export interface ScrapedOdd {
  home_team: string;
  away_team: string;
  kickoff_date: string; // "YYYY-MM-DD" en hora Colombia (UTC-5)
  market: Market;
  selection: string;
  price: number;
  line: number | null;
  is_live: boolean;
}

export function colombiaDate(isoUtc: string): string {
  return new Date(isoUtc).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}
