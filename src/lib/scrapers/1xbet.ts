/**
 * Scraper de cuotas de 1xbet vía la API pública LineFeed.
 *
 * NOTA: Actualmente NO está conectado al cron porque desde IPs cloud
 * (probado en Vercel São Paulo) la API responde Success:true pero filtra
 * Value:[] silenciosamente. Desde IP residencial CO funciona OK.
 * Reactivar en /api/cron/scrape-odds cuando exista proxy residencial
 * o cuando este scraper corra desde una VPS/Pi residencial.
 *
 * Endpoint que consume la web actual de 1xbet:
 *   https://1xbet.com/service-api/LineFeed/Get1x2_Zip?sports=1&...
 *
 * Cada evento trae outcomes principales en `E[]` y mercados alternativos
 * agrupados en `AE[].ME[]`. Las líneas de over/under viven en `AE` con
 * G=17, así que iteramos ambos arrays y dedupe por (T, P).
 *
 * Códigos T conocidos:
 *    1 = Win 1 (home)        2 = Draw            3 = Win 2 (away)
 *    4 = 1X                  5 = 12              6 = X2
 *    7 = Asian Handicap 1    8 = Asian Handicap 2
 *    9 = Total Over          10 = Total Under
 *  180 = Both Teams Yes    181 = Both Teams No
 */

import { type ScrapedOdd, colombiaDate } from "./types";

const BASE_URL = process.env.ONEXBET_BASE_URL ?? "https://1xbet.com";
const SPORT_SOCCER = 1;

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: `${BASE_URL}/`,
  Origin: BASE_URL,
};

interface OneXOutcome {
  T: number; // outcome type code
  C?: number; // odds (decimal)
  P?: number; // line (for totals/handicaps)
  G?: number; // group id
}

interface OneXAltGroup {
  G: number;
  ME: OneXOutcome[];
}

interface OneXEvent {
  I: number; // event id
  O1?: string; // home team
  O2?: string; // away team
  S?: number; // kickoff (unix seconds)
  E?: OneXOutcome[]; // outcomes principales
  AE?: OneXAltGroup[]; // mercados alternativos agrupados
  L?: string; // league name
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
    lng: "en",
    mode: "4",
    country: "19",
    partner: "51",
    getEmpty: "true",
    virtualSports: "true",
    noFilterBlockEvent: "true",
  });
  return `${BASE_URL}/service-api/LineFeed/Get1x2_Zip?${params}`;
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
    if (!ev.O1 || !ev.O2 || !ev.S) continue;
    const kickoff_date = colombiaDate(new Date(ev.S * 1000).toISOString());
    const home = ev.O1;
    const away = ev.O2;

    // Index outcomes por (T, P) — combina E (principales) y AE.ME (alternativos).
    // Dedupe: la primera ocurrencia gana, así E (línea principal) tiene prioridad.
    const byKey = new Map<string, number>();
    const ingest = (outcomes: OneXOutcome[] | undefined) => {
      if (!outcomes) return;
      for (const o of outcomes) {
        if (typeof o.T !== "number" || typeof o.C !== "number") continue;
        if (o.C <= 1) continue;
        const k = o.P !== undefined ? `${o.T}|${o.P}` : `${o.T}`;
        if (!byKey.has(k)) byKey.set(k, o.C);
      }
    };
    ingest(ev.E);
    if (Array.isArray(ev.AE)) {
      for (const grp of ev.AE) ingest(grp.ME);
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

    // BTTS
    {
      const yes = get(180), no = get(181);
      if (yes) odds.push({ home_team: home, away_team: away, kickoff_date, market: "btts", selection: "yes", price: yes, line: null, is_live: false });
      if (no) odds.push({ home_team: home, away_team: away, kickoff_date, market: "btts", selection: "no", price: no, line: null, is_live: false });
    }

    // Totals 1.5 y 2.5 — viven principalmente en AE con G=17.
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
