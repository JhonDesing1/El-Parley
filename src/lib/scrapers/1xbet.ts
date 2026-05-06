/**
 * Scraper de cuotas de 1xbet vía la API pública LineFeed.
 *
 * El endpoint Get1x2_VZip es el mismo que consume la web de 1xbet:
 *   https://1xbet.com/LineFeed/Get1x2_VZip?sports=1&...
 *
 * Pese al sufijo "VZip" la respuesta es JSON plano, no comprimido.
 *
 * Códigos T conocidos (event types):
 *    1 = Win 1 (home)        2 = Draw            3 = Win 2 (away)
 *    4 = 1X                  5 = 12              6 = X2
 *    7 = Home no draw        8 = Away no draw
 *    9 = Total Over (P=line) 10 = Total Under (P=line)
 *  180 = Both Teams Yes    181 = Both Teams No
 *
 * Nota sobre IP: 1xbet rate-limita IPs de cloud agresivamente.
 * Si desde Vercel devuelve 403/429 con frecuencia, considerar
 * residential proxy o desactivar este source.
 */

import { type ScrapedOdd, colombiaDate } from "./types";

const BASE_URL = process.env.ONEXBET_BASE_URL ?? "https://1xbet.com";
const SPORT_SOCCER = 1;

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: `${BASE_URL}/`,
  Origin: BASE_URL,
};

interface OneXEvent {
  I: number; // event id
  O1?: string; // home team
  O2?: string; // away team
  S?: number; // kickoff (unix seconds)
  E?: OneXOutcome[]; // markets/outcomes
  L?: string; // league name
}

interface OneXOutcome {
  T: number; // outcome type code
  C?: number; // odds (decimal)
  P?: number; // line (for totals/handicaps)
}

interface OneXResponse {
  Success: boolean;
  Value?: OneXEvent[];
  Error?: string;
}

function buildUrl(): string {
  const params = new URLSearchParams({
    sports: String(SPORT_SOCCER),
    count: "10000",
    lng: "es",
    tf: "2200000",
    mode: "4",
    country: "181", // Colombia
    partner: "51",
    getEmpty: "true",
    virtualSports: "true",
    noFilterBlockEvent: "true",
  });
  return `${BASE_URL}/LineFeed/Get1x2_VZip?${params}`;
}

export async function scrape1xbet(): Promise<ScrapedOdd[]> {
  const res = await fetch(buildUrl(), { headers: HEADERS });
  if (!res.ok) throw new Error(`1xbet HTTP ${res.status}`);

  const json = (await res.json()) as OneXResponse;
  if (!json.Success || !Array.isArray(json.Value)) {
    throw new Error(`1xbet API error: ${json.Error ?? "unknown"}`);
  }

  const odds: ScrapedOdd[] = [];

  for (const ev of json.Value) {
    if (!ev.O1 || !ev.O2 || !ev.S || !Array.isArray(ev.E)) continue;
    const kickoff_date = colombiaDate(new Date(ev.S * 1000).toISOString());
    const home = ev.O1;
    const away = ev.O2;

    // Index outcomes por (T, P) para acceso rápido y evitar duplicados.
    type Key = string;
    const byKey = new Map<Key, number>();
    for (const o of ev.E) {
      if (typeof o.T !== "number" || typeof o.C !== "number") continue;
      if (o.C <= 1) continue;
      const k: Key = o.P !== undefined ? `${o.T}|${o.P}` : `${o.T}`;
      // Quedarse con la primera ocurrencia (línea principal).
      if (!byKey.has(k)) byKey.set(k, o.C);
    }

    const get = (T: number, P?: number): number | undefined =>
      byKey.get(P !== undefined ? `${T}|${P}` : `${T}`);

    // 1x2
    {
      const h = get(1), d = get(2), a = get(3);
      if (h) odds.push({ home_team: home, away_team: away, kickoff_date, market: "1x2", selection: "home", price: h, line: null, is_live: false });
      if (d) odds.push({ home_team: home, away_team: away, kickoff_date, market: "1x2", selection: "draw", price: d, line: null, is_live: false });
      if (a) odds.push({ home_team: home, away_team: away, kickoff_date, market: "1x2", selection: "away", price: a, line: null, is_live: false });
    }

    // Double chance
    {
      const oneX = get(4), twelve = get(5), xTwo = get(6);
      if (oneX) odds.push({ home_team: home, away_team: away, kickoff_date, market: "double_chance", selection: "1x", price: oneX, line: null, is_live: false });
      if (twelve) odds.push({ home_team: home, away_team: away, kickoff_date, market: "double_chance", selection: "12", price: twelve, line: null, is_live: false });
      if (xTwo) odds.push({ home_team: home, away_team: away, kickoff_date, market: "double_chance", selection: "x2", price: xTwo, line: null, is_live: false });
    }

    // Draw no bet
    {
      const dnbHome = get(7), dnbAway = get(8);
      if (dnbHome) odds.push({ home_team: home, away_team: away, kickoff_date, market: "draw_no_bet", selection: "home", price: dnbHome, line: null, is_live: false });
      if (dnbAway) odds.push({ home_team: home, away_team: away, kickoff_date, market: "draw_no_bet", selection: "away", price: dnbAway, line: null, is_live: false });
    }

    // BTTS
    {
      const yes = get(180), no = get(181);
      if (yes) odds.push({ home_team: home, away_team: away, kickoff_date, market: "btts", selection: "yes", price: yes, line: null, is_live: false });
      if (no) odds.push({ home_team: home, away_team: away, kickoff_date, market: "btts", selection: "no", price: no, line: null, is_live: false });
    }

    // Totals 1.5 y 2.5
    for (const line of [1.5, 2.5] as const) {
      const over = get(9, line), under = get(10, line);
      const market = line === 1.5 ? "over_under_1_5" : "over_under_2_5";
      if (over) odds.push({ home_team: home, away_team: away, kickoff_date, market, selection: "over", price: over, line, is_live: false });
      if (under) odds.push({ home_team: home, away_team: away, kickoff_date, market, selection: "under", price: under, line, is_live: false });
    }
  }

  console.log(`[1xbet] ${odds.length} cuotas extraídas de ${json.Value.length} eventos`);
  return odds;
}
