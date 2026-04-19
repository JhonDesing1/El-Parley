export type Market =
  | "1x2"
  | "over_under_2_5"
  | "over_under_1_5"
  | "btts"
  | "double_chance"
  | "asian_handicap"
  | "draw_no_bet";

export interface ScrapedOdd {
  home_team:    string;
  away_team:    string;
  kickoff_date: string;   // "YYYY-MM-DD" en hora Colombia (UTC-5)
  market:       Market;
  selection:    string;   // "home" | "draw" | "away" | "over" | "under" | "yes" | "no"
  price:        number;
  line:         number | null;
  is_live:      boolean;
}

export interface IngestPayload {
  source: string;
  odds:   ScrapedOdd[];
}
