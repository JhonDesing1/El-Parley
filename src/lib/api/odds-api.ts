/**
 * The Odds API — cliente REST.
 * Documentación: https://the-odds-api.com/lol-api/
 *
 * Cuota diaria: 500 req en plan gratuito.
 * Se usa como fuente SUPLEMENTARIA de cuotas cuando API-Football no tiene
 * datos de un partido o para ampliar cobertura de mercados (h2h, totals).
 *
 * Mapeo de sports:
 *   soccer_colombia_primera_a → Liga BetPlay
 *   soccer_uefa_champs_league  → Champions League
 *   soccer_epl                 → Premier League
 */

const BASE = "https://api.the-odds-api.com/v4";

// Mapeo The Odds API sport → nuestro league slug
export const SPORT_MAP: Record<string, string> = {
  soccer_colombia_primera_a: "liga-betplay",
  soccer_copa_libertadores: "copa-libertadores",
  soccer_uefa_champs_league: "champions-league",
  soccer_spain_la_liga: "la-liga",
  soccer_england_league1: "premier-league",
  soccer_brazil_campeonato: "brasileirao",
  soccer_argentina_primera_division: "primera-division-arg",
};

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number }>;
    }>;
  }>;
}

export interface OddsApiUsage {
  remaining: number;
  used: number;
}

/** Devuelve eventos con cuotas 1x2 de una liga. */
export async function fetchOddsApiEvents(
  sportKey: string,
  options: { markets?: string; regions?: string } = {},
): Promise<{ events: OddsApiEvent[]; usage: OddsApiUsage }> {
  const key = process.env.ODDS_API_KEY;
  if (!key) return { events: [], usage: { remaining: 0, used: 0 } };

  const markets = options.markets ?? "h2h";
  const regions = options.regions ?? "eu";

  const url = new URL(`${BASE}/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", key);
  url.searchParams.set("regions", regions);
  url.searchParams.set("markets", markets);
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  const res = await fetch(url.toString(), {
    next: { revalidate: 600 }, // cache 10 min en Next.js fetch
  });

  if (!res.ok) {
    console.error(`[odds-api] ${sportKey} HTTP ${res.status}`);
    return { events: [], usage: { remaining: 0, used: 0 } };
  }

  const data: OddsApiEvent[] = await res.json();
  const usage: OddsApiUsage = {
    remaining: Number(res.headers.get("x-requests-remaining") ?? 0),
    used: Number(res.headers.get("x-requests-used") ?? 0),
  };

  return { events: data, usage };
}

/**
 * Convierte un evento de The Odds API al formato de nuestra tabla `odds`.
 * Solo inserta bookmakers que ya existen en nuestra tabla `bookmakers`.
 */
export function oddsApiEventToRows(
  event: OddsApiEvent,
  matchId: number,
  bookmakersMap: Map<string, number>, // slug → id
): Array<{
  match_id: number;
  bookmaker_id: number;
  market: string;
  selection: string;
  price: number;
  line: null;
  is_live: boolean;
}> {
  const rows: ReturnType<typeof oddsApiEventToRows> = [];

  for (const bm of event.bookmakers) {
    const bookId = bookmakersMap.get(bm.key);
    if (!bookId) continue; // no mapeado a nuestra tabla

    for (const market of bm.markets) {
      // h2h → 1x2
      if (market.key === "h2h") {
        for (const outcome of market.outcomes) {
          let selection = "";
          if (outcome.name === event.home_team) selection = "home";
          else if (outcome.name === event.away_team) selection = "away";
          else selection = "draw";

          rows.push({
            match_id: matchId,
            bookmaker_id: bookId,
            market: "1x2",
            selection,
            price: outcome.price,
            line: null,
            is_live: false,
          });
        }
      }

      // totals → over_under_2_5
      if (market.key === "totals") {
        for (const outcome of market.outcomes) {
          rows.push({
            match_id: matchId,
            bookmaker_id: bookId,
            market: "over_under_2_5",
            selection: outcome.name.toLowerCase() as "over" | "under",
            price: outcome.price,
            line: null,
            is_live: false,
          });
        }
      }
    }
  }

  return rows;
}
