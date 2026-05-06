/**
 * Scraper de cuotas de Pinnacle vía la API guest pública (Arcadia).
 *
 * Pinnacle es la referencia del mercado por sus márgenes bajos (~2%),
 * lo que la hace crítica para detectar value bets — sus cuotas son las
 * más cercanas a la "verdadera" probabilidad implícita.
 *
 * La API es pública (la usa el sitio web). El X-API-Key suele rotar
 * cada cierto tiempo; si comienza a devolver 401, actualizarlo con
 * DevTools desde https://www.pinnacle.com/en/soccer/matchups → Network
 * → cualquier request a guest.api.arcadia.pinnacle.com → header
 * X-API-Key. Override opcional vía env PINNACLE_API_KEY.
 *
 * Pinnacle entrega precios en formato americano (e.g. -150, +220).
 * Conversión a decimal: ver americanToDecimal().
 */

import { type ScrapedOdd, type Market, colombiaDate } from "./types";

const API_KEY = process.env.PINNACLE_API_KEY ?? "CmX2KcMrXuFmNg6YFbmTxE0y9CIrOi0R";
const BASE = "https://guest.api.arcadia.pinnacle.com/0.1";
const SOCCER_SPORT_ID = 29;

const HEADERS = {
  "X-API-Key": API_KEY,
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://www.pinnacle.com/",
  Origin: "https://www.pinnacle.com",
};

interface PinnacleParticipant {
  name: string;
  alignment: "home" | "away" | "neutral";
}

interface PinnacleMatchup {
  id: number;
  type: string; // "matchup" | "special" | "prematchSpecial"
  parentId: number | null;
  startTime: string;
  isLive: boolean;
  league?: { id: number; name: string };
  participants: PinnacleParticipant[];
}

interface PinnaclePrice {
  designation?: "home" | "away" | "draw" | "over" | "under";
  participantId?: number;
  price: number; // formato americano
  points?: number; // line para totals/spreads
}

interface PinnacleMarket {
  matchupId: number;
  type: "moneyline" | "total" | "spread" | "team_total";
  period: number; // 0 = full match
  isAlternate: boolean;
  status: string; // "open" | "suspended" | ...
  prices: PinnaclePrice[];
}

function americanToDecimal(price: number): number {
  if (!Number.isFinite(price) || price === 0) return 0;
  return price > 0 ? price / 100 + 1 : 100 / Math.abs(price) + 1;
}

export async function scrapePinnacle(): Promise<ScrapedOdd[]> {
  const [matchupsRes, marketsRes] = await Promise.all([
    fetch(
      `${BASE}/sports/${SOCCER_SPORT_ID}/matchups?withSpecials=false&brandId=0`,
      { headers: HEADERS },
    ),
    fetch(
      `${BASE}/sports/${SOCCER_SPORT_ID}/markets/straight?primaryOnly=true`,
      { headers: HEADERS },
    ),
  ]);

  if (!matchupsRes.ok) throw new Error(`Pinnacle matchups HTTP ${matchupsRes.status}`);
  if (!marketsRes.ok) throw new Error(`Pinnacle markets HTTP ${marketsRes.status}`);

  const matchups = (await matchupsRes.json()) as PinnacleMatchup[];
  const markets = (await marketsRes.json()) as PinnacleMarket[];

  // Solo full-match matchups (sin parentId, type "matchup" y con 2 participantes alineados).
  const matchupById = new Map<number, PinnacleMatchup>();
  for (const m of matchups) {
    if (m.type !== "matchup") continue;
    if (m.parentId) continue;
    if (!Array.isArray(m.participants) || m.participants.length < 2) continue;
    matchupById.set(m.id, m);
  }

  const odds: ScrapedOdd[] = [];

  for (const market of markets) {
    if (market.period !== 0) continue;
    if (market.isAlternate) continue;
    if (market.status && market.status !== "open") continue;
    const matchup = matchupById.get(market.matchupId);
    if (!matchup) continue;

    const home = matchup.participants.find((p) => p.alignment === "home")?.name;
    const away = matchup.participants.find((p) => p.alignment === "away")?.name;
    if (!home || !away) continue;

    const kickoff_date = colombiaDate(matchup.startTime);
    const isLive = !!matchup.isLive;

    if (market.type === "moneyline") {
      for (const p of market.prices) {
        const decimal = americanToDecimal(p.price);
        if (decimal <= 1) continue;
        const selection =
          p.designation === "home" ? "home" :
          p.designation === "away" ? "away" :
          p.designation === "draw" ? "draw" : null;
        if (!selection) continue;
        odds.push({
          home_team: home,
          away_team: away,
          kickoff_date,
          market: "1x2",
          selection,
          price: decimal,
          line: null,
          is_live: isLive,
        });
      }
    } else if (market.type === "total") {
      const points = market.prices[0]?.points;
      if (points !== 1.5 && points !== 2.5) continue;
      const m: Market = points === 1.5 ? "over_under_1_5" : "over_under_2_5";
      for (const p of market.prices) {
        const decimal = americanToDecimal(p.price);
        if (decimal <= 1) continue;
        const selection =
          p.designation === "over" ? "over" :
          p.designation === "under" ? "under" : null;
        if (!selection) continue;
        odds.push({
          home_team: home,
          away_team: away,
          kickoff_date,
          market: m,
          selection,
          price: decimal,
          line: points,
          is_live: isLive,
        });
      }
    }
    // Pinnacle no expone BTTS ni Double Chance en /markets/straight con primaryOnly.
    // Si en el futuro se añade, ampliar este switch.
  }

  console.log(`[pinnacle] ${odds.length} cuotas extraídas de ${matchupById.size} partidos`);
  return odds;
}
