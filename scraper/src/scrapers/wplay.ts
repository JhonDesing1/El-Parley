/**
 * Scraper de Wplay — usando la API de Kambi directamente.
 *
 * Wplay usa la plataforma Kambi (operator: "wplay", región: us1).
 * Misma estructura que Betplay, solo cambia el nombre del operador en la URL.
 */

import { ScrapedOdd } from "../types.js";

const BASE = "https://us1.offering-api.kambicdn.com/offering/v2018/wplay";
const PARAMS = "lang=es_CO&market=CO&client_id=200&channel_id=1&ncid=1&useCombined=true";

const FOOTBALL_URLS = [
  `${BASE}/listView/football/colombia/liga_betplay_dimayor/all/matches.json?${PARAMS}`,
  `${BASE}/listView/football/colombia/copa_betplay_dimayor/all/matches.json?${PARAMS}`,
  `${BASE}/category/combined_layout,list_view/sport/FOOTBALL.json?${PARAMS}&displayDefault=false`,
];

interface KambiOutcome {
  id: number;
  label: string;
  odds: number;
  type: string;
  suspended?: boolean;
}

interface KambiBetOffer {
  id: number;
  criterion: { label: string; englishLabel: string };
  outcomes: KambiOutcome[];
  suspended?: boolean;
  line?: number;
}

interface KambiEvent {
  id: number;
  homeName: string;
  awayName: string;
  start: string;
}

interface KambiResponse {
  events: Array<{
    event: KambiEvent;
    betOffers: KambiBetOffer[];
    liveData?: unknown;
  }>;
}

function colombiaDate(isoUtc: string): string {
  return new Date(isoUtc).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function parseKambiEvents(data: KambiResponse, seenEventIds: Set<number>): ScrapedOdd[] {
  const odds: ScrapedOdd[] = [];
  if (!data?.events?.length) return odds;

  for (const item of data.events) {
    const ev = item.event;
    if (!ev?.homeName || !ev?.awayName) continue;
    if (seenEventIds.has(ev.id)) continue;
    seenEventIds.add(ev.id);

    const kickoff_date = colombiaDate(ev.start);
    const home = ev.homeName;
    const away = ev.awayName;
    const isLive = !!item.liveData;

    for (const offer of (item.betOffers ?? [])) {
      if (offer.suspended) continue;
      const label = (offer.criterion?.englishLabel ?? offer.criterion?.label ?? "").toLowerCase();

      if (label.includes("full time") || label.includes("resultado final") || label === "match") {
        for (const o of offer.outcomes) {
          if (o.suspended) continue;
          const price = o.odds / 1000;
          if (price <= 1) continue;
          const selection = o.type === "OT_ONE" ? "home" : o.type === "OT_CROSS" ? "draw" : o.type === "OT_TWO" ? "away" : null;
          if (!selection) continue;
          odds.push({ home_team: home, away_team: away, kickoff_date, market: "1x2", selection, price, line: null, is_live: isLive });
        }
      }

      if (label.includes("over/under") || label.includes("goles +") || label.includes("total goals")) {
        const lineVal = offer.line ? offer.line / 1000 : null;
        const market = lineVal === 2.5 ? "over_under_2_5" : lineVal === 1.5 ? "over_under_1_5" : null;
        if (!market) continue;
        for (const o of offer.outcomes) {
          if (o.suspended) continue;
          const price = o.odds / 1000;
          if (price <= 1) continue;
          const selection = o.type === "OT_OVER" ? "over" : o.type === "OT_UNDER" ? "under" : null;
          if (!selection) continue;
          odds.push({ home_team: home, away_team: away, kickoff_date, market, selection, price, line: lineVal, is_live: isLive });
        }
      }

      if (label.includes("both teams") || label.includes("ambos") || label.includes("btts")) {
        for (const o of offer.outcomes) {
          if (o.suspended) continue;
          const price = o.odds / 1000;
          if (price <= 1) continue;
          const selection = o.type === "OT_YES" ? "yes" : o.type === "OT_NO" ? "no" : null;
          if (!selection) continue;
          odds.push({ home_team: home, away_team: away, kickoff_date, market: "btts", selection, price, line: null, is_live: isLive });
        }
      }
    }
  }

  return odds;
}

const FETCH_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://www.wplay.co/",
  "Origin": "https://www.wplay.co",
};

export async function scrapeWplay(): Promise<ScrapedOdd[]> {
  console.log("[wplay] Consultando API Kambi...");

  const seenEventIds = new Set<number>();
  const allOdds: ScrapedOdd[] = [];

  // Sequential fetching with delay to avoid rate limiting on the wplay operator key
  for (const url of FOOTBALL_URLS) {
    try {
      const r = await fetch(url, { headers: FETCH_HEADERS });
      if (!r.ok) {
        if (r.status === 429) {
          // Brief pause then retry once
          await new Promise((res) => setTimeout(res, 3000));
          const r2 = await fetch(url, { headers: FETCH_HEADERS });
          if (!r2.ok) { console.warn(`[wplay] URL sigue fallando (${r2.status}): ${url}`); continue; }
          const data = await r2.json() as KambiResponse;
          allOdds.push(...parseKambiEvents(data, seenEventIds));
        } else {
          console.warn(`[wplay] URL falló (${r.status}): ${url}`);
        }
        continue;
      }
      const data = await r.json() as KambiResponse;
      allOdds.push(...parseKambiEvents(data, seenEventIds));
      // Small delay between requests
      await new Promise((res) => setTimeout(res, 800));
    } catch (err) {
      console.warn("[wplay] URL falló:", err);
    }
  }

  console.log(`[wplay] ${allOdds.length} cuotas extraídas de ${seenEventIds.size} partidos`);
  return allOdds;
}
