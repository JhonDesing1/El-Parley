/**
 * Scraper de Betplay — usando la API de Kambi directamente.
 *
 * Betplay usa la plataforma Kambi (operator: "betplay", región: us1).
 * La API es pública y no requiere autenticación.
 *
 * Estructura de respuesta:
 *   events[].event.homeName / awayName / start
 *   events[].betOffers[].criterion.label  → "Resultado Final" (1x2), "Goles +" (over/under)
 *   events[].betOffers[].outcomes[].type  → OT_ONE (local), OT_CROSS (empate), OT_TWO (visitante)
 *   events[].betOffers[].outcomes[].odds  → milliodds (dividir entre 1000)
 */

import { ScrapedOdd } from "../types.js";

// URLs de la API de Kambi para Betplay
const BASE = "https://us1.offering-api.kambicdn.com/offering/v2018/betplay";
const PARAMS = "lang=es_CO&market=CO&client_id=200&channel_id=1&ncid=1&useCombined=true";

// Ligas colombianas + internacionales disponibles en Betplay
const FOOTBALL_URLS = [
  `${BASE}/listView/football/colombia/liga_betplay_dimayor/all/matches.json?${PARAMS}`,
  `${BASE}/listView/football/colombia/copa_betplay_dimayor/all/matches.json?${PARAMS}`,
  `${BASE}/category/combined_layout,list_view/sport/FOOTBALL.json?${PARAMS}&displayDefault=false`,
];

// ── Tipos Kambi ──────────────────────────────────────────────────────────────

interface KambiOutcome {
  id: number;
  label: string;
  odds: number;           // milliodds (ej: 2250 = 2.250)
  type: string;           // "OT_ONE" | "OT_CROSS" | "OT_TWO" | "OT_OVER" | "OT_UNDER"
  suspended?: boolean;
}

interface KambiBetOffer {
  id: number;
  criterion: { label: string; englishLabel: string };
  betOfferType: { id: number; name: string };
  outcomes: KambiOutcome[];
  suspended?: boolean;
  line?: number;          // milliline (ej: 2500 = 2.5)
}

interface KambiEvent {
  id: number;
  homeName: string;
  awayName: string;
  start: string;          // ISO datetime UTC
  group: string;
  state?: string;
}

interface KambiResponse {
  events: Array<{
    event: KambiEvent;
    betOffers: KambiBetOffer[];
    liveData?: unknown;
  }>;
}

// ── Parseo ───────────────────────────────────────────────────────────────────

function colombiaDate(isoUtc: string): string {
  return new Date(isoUtc).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function parseKambiEvents(data: KambiResponse, seenEventIds: Set<number>): ScrapedOdd[] {
  const odds: ScrapedOdd[] = [];
  if (!data?.events?.length) return odds;

  for (const item of data.events) {
    const ev = item.event;
    if (!ev?.homeName || !ev?.awayName) continue;
    if (seenEventIds.has(ev.id)) continue; // dedup entre URLs
    seenEventIds.add(ev.id);

    const kickoff_date = colombiaDate(ev.start);
    const home = ev.homeName;
    const away = ev.awayName;
    const isLive = !!item.liveData;

    for (const offer of (item.betOffers ?? [])) {
      if (offer.suspended) continue;
      const label = (offer.criterion?.englishLabel ?? offer.criterion?.label ?? "").toLowerCase();

      // ── 1x2 ─────────────────────────────────────────────────────────────
      if (label.includes("full time") || label.includes("resultado final") || label === "match") {
        for (const o of offer.outcomes) {
          if (o.suspended) continue;
          const price = o.odds / 1000;
          if (price <= 1) continue;

          const selection =
            o.type === "OT_ONE"   ? "home" :
            o.type === "OT_CROSS" ? "draw" :
            o.type === "OT_TWO"   ? "away" : null;

          if (!selection) continue;
          odds.push({ home_team: home, away_team: away, kickoff_date, market: "1x2", selection, price, line: null, is_live: isLive });
        }
      }

      // ── Over/Under ───────────────────────────────────────────────────────
      if (label.includes("over/under") || label.includes("goles +") || label.includes("total goals")) {
        const lineVal = offer.line ? offer.line / 1000 : null;
        const market = lineVal === 2.5 ? "over_under_2_5" :
                       lineVal === 1.5 ? "over_under_1_5" : null;
        if (!market) continue;

        for (const o of offer.outcomes) {
          if (o.suspended) continue;
          const price = o.odds / 1000;
          if (price <= 1) continue;

          const selection =
            o.type === "OT_OVER"  ? "over" :
            o.type === "OT_UNDER" ? "under" : null;
          if (!selection) continue;

          odds.push({ home_team: home, away_team: away, kickoff_date, market, selection, price, line: lineVal, is_live: isLive });
        }
      }

      // ── BTTS ─────────────────────────────────────────────────────────────
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

// ── Entry point ──────────────────────────────────────────────────────────────

export async function scrapeBetplay(): Promise<ScrapedOdd[]> {
  console.log("[betplay] Consultando API Kambi...");

  const seenEventIds = new Set<number>();
  const allOdds: ScrapedOdd[] = [];

  const results = await Promise.allSettled(
    FOOTBALL_URLS.map((url) =>
      fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; ElParley-Scraper/1.0)",
        },
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
          return r.json() as Promise<KambiResponse>;
        })
        .then((data) => parseKambiEvents(data, seenEventIds)),
    ),
  );

  for (const r of results) {
    if (r.status === "fulfilled") {
      allOdds.push(...r.value);
    } else {
      console.warn("[betplay] URL falló:", r.reason);
    }
  }

  console.log(`[betplay] ${allOdds.length} cuotas extraídas de ${seenEventIds.size} partidos`);
  return allOdds;
}
