export type MarketType =
  | "1x2"
  | "double_chance"
  | "over_under_2_5"
  | "over_under_1_5"
  | "btts"
  | "correct_score"
  | "asian_handicap"
  | "draw_no_bet";

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "canceled";

export interface Team {
  id: number;
  name: string;
  short_name?: string;
  logo_url?: string;
}

export interface League {
  id: number;
  name: string;
  slug: string;
  country: string;
  logo_url?: string;
  flag_url?: string;
}

export interface Match {
  id: number;
  league: League;
  home_team: Team;
  away_team: Team;
  kickoff: string;
  status: MatchStatus;
  minute?: number;
  home_score?: number;
  away_score?: number;
  best_odds?: { home?: number; draw?: number; away?: number };
  has_value_bet?: boolean;
}

export interface Bookmaker {
  id: number;
  slug: string;
  name: string;
  logo_url?: string;
  affiliate_url: string;
}

export interface Odd {
  id: number;
  match_id: number;
  bookmaker: Bookmaker;
  market: MarketType;
  selection: string;
  price: number;
  previous_price?: number | null;
  line?: number;
  is_live: boolean;
  updated_at: string;
}

export interface ValueBet {
  id: number;
  match_id: number;
  bookmaker: Bookmaker;
  market: MarketType;
  selection: string;
  price: number;
  edge: number;
  model_prob: number;
  kelly_fraction: number;
  confidence: "low" | "medium" | "high";
  reasoning: string;
  is_premium: boolean;
}

export interface ParlayLeg {
  id: number;
  match: Match;
  bookmaker?: Bookmaker;
  market: MarketType;
  selection: string;
  price: number;
  result?: "pending" | "won" | "lost" | "void";
}

export interface Parlay {
  id: string;
  title: string;
  description?: string;
  total_odds: number;
  total_probability: number;
  expected_value?: number;
  confidence: "low" | "medium" | "high";
  tier: "free" | "premium" | "pro";
  status: "pending" | "won" | "lost" | "void" | "partial";
  legs: ParlayLeg[];
  created_at: string;
}

export interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
  author: string | null;
}
