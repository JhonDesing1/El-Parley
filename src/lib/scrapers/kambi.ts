/**
 * Scraper de cuotas para casas que usan la plataforma Kambi (Betplay, Wplay).
 *
 * La API de Kambi es pública. Solo cambia el slug del operador en la URL:
 *   https://us1.offering-api.kambicdn.com/offering/v2018/{operator}/...
 *
 * Wplay tiende a hacer rate-limit más agresivo, así que sus requests van
 * secuenciales con un pequeño delay; Betplay puede ir en paralelo.
 */

export type Market =
  | "1x2"
  | "over_under_2_5"
  | "over_under_1_5"
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

const PARAMS = "lang=es_CO&market=CO&client_id=200&channel_id=1&ncid=1&useCombined=true";

function operatorUrls(operator: string): string[] {
  const base = `https://us1.offering-api.kambicdn.com/offering/v2018/${operator}`;
  return [
    `${base}/listView/football/colombia/liga_betplay_dimayor/all/matches.json?${PARAMS}`,
    `${base}/listView/football/colombia/copa_betplay_dimayor/all/matches.json?${PARAMS}`,
    `${base}/category/combined_layout,list_view/sport/FOOTBALL.json?${PARAMS}&displayDefault=false`,
  ];
}

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

function parseEvents(data: KambiResponse, seenEventIds: Set<number>): ScrapedOdd[] {
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

    for (const offer of item.betOffers ?? []) {
      if (offer.suspended) continue;
      const label = (offer.criterion?.englishLabel ?? offer.criterion?.label ?? "").toLowerCase();

      // 1x2
      if (label.includes("full time") || label.includes("resultado final") || label === "match") {
        for (const o of offer.outcomes) {
          if (o.suspended) continue;
          const price = o.odds / 1000;
          if (price <= 1) continue;
          const selection =
            o.type === "OT_ONE" ? "home" : o.type === "OT_CROSS" ? "draw" : o.type === "OT_TWO" ? "away" : null;
          if (!selection) continue;
          odds.push({ home_team: home, away_team: away, kickoff_date, market: "1x2", selection, price, line: null, is_live: isLive });
        }
      }

      // Over/Under
      if (label.includes("over/under") || label.includes("goles +") || label.includes("total goals")) {
        const lineVal = offer.line ? offer.line / 1000 : null;
        const market: Market | null =
          lineVal === 2.5 ? "over_under_2_5" : lineVal === 1.5 ? "over_under_1_5" : null;
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

      // BTTS
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

const BETPLAY_HEADERS = {
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; ElParley-Scraper/1.0)",
};

const WPLAY_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://www.wplay.co/",
  "Origin": "https://www.wplay.co",
};

export async function scrapeBetplay(): Promise<ScrapedOdd[]> {
  const seenEventIds = new Set<number>();
  const allOdds: ScrapedOdd[] = [];

  const results = await Promise.allSettled(
    operatorUrls("betplay").map((url) =>
      fetch(url, { headers: BETPLAY_HEADERS })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
          return r.json() as Promise<KambiResponse>;
        })
        .then((data) => parseEvents(data, seenEventIds)),
    ),
  );

  for (const r of results) {
    if (r.status === "fulfilled") allOdds.push(...r.value);
    else console.warn("[betplay] URL falló:", r.reason);
  }

  console.log(`[betplay] ${allOdds.length} cuotas extraídas de ${seenEventIds.size} partidos`);
  return allOdds;
}

export async function scrapeWplay(): Promise<ScrapedOdd[]> {
  const seenEventIds = new Set<number>();
  const allOdds: ScrapedOdd[] = [];

  // Secuencial con delay — Wplay rate-limita la operator key.
  for (const url of operatorUrls("wplay")) {
    try {
      let r = await fetch(url, { headers: WPLAY_HEADERS });
      if (r.status === 429) {
        await new Promise((res) => setTimeout(res, 3000));
        r = await fetch(url, { headers: WPLAY_HEADERS });
      }
      if (!r.ok) {
        console.warn(`[wplay] URL falló (${r.status}): ${url}`);
        continue;
      }
      const data = (await r.json()) as KambiResponse;
      allOdds.push(...parseEvents(data, seenEventIds));
      await new Promise((res) => setTimeout(res, 800));
    } catch (err) {
      console.warn("[wplay] URL falló:", err);
    }
  }

  console.log(`[wplay] ${allOdds.length} cuotas extraídas de ${seenEventIds.size} partidos`);
  return allOdds;
}
