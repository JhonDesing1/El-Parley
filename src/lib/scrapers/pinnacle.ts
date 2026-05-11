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
 *
 * Mercados extraídos (full match, period=0):
 *   1x2                   ← market `moneyline` del main matchup
 *   over_under_1_5/2_5/3_5 ← market `total` (alternates) del main matchup
 *   btts                  ← special "Both Teams To Score?" (moneyline)
 *   double_chance         ← special "Double Chance" (moneyline)
 *
 * Notas:
 *  - Pinnacle expone las líneas 1.5/2.5/3.5 como ALTERNATES (la primary
 *    suele ser 2.75 — Asian total). Por eso NO se pasa primaryOnly=true.
 *  - Los specials son matchups independientes con parentId apuntando al
 *    main matchup. Hay que cruzarlos.
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
  id: number;
  name: string;
  alignment: "home" | "away" | "neutral";
}

interface PinnacleMatchup {
  id: number;
  type: string; // "matchup" | "special" | ...
  parentId: number | null;
  startTime: string;
  isLive: boolean;
  league?: { id: number; name: string };
  participants: PinnacleParticipant[];
  special?: { category?: string; description?: string };
}

interface PinnaclePrice {
  designation?: "home" | "away" | "draw" | "over" | "under";
  participantId?: number;
  price: number;
  points?: number;
}

interface PinnacleMarket {
  matchupId: number;
  type: "moneyline" | "total" | "spread" | "team_total";
  period: number;
  isAlternate: boolean;
  status?: string;
  prices: PinnaclePrice[];
}

/**
 * Líneas de totales que extraemos. La primary de Pinnacle suele ser 2.75
 * (Asian), pero el detector usa 1.5/2.5/3.5 (medio asiático puro).
 */
const TOTAL_LINES = new Set([1.5, 2.5, 3.5]);

/** Specials que mapean a mercados que sí procesamos. */
type SpecialKind = "btts" | "double_chance";
const SPECIAL_BY_DESCRIPTION: Record<string, SpecialKind> = {
  "Both Teams To Score?": "btts",
  "Double Chance": "double_chance",
};

function americanToDecimal(price: number): number {
  if (!Number.isFinite(price) || price === 0) return 0;
  return price > 0 ? price / 100 + 1 : 100 / Math.abs(price) + 1;
}

/**
 * Mapea un participant de un special a la selección estándar.
 *  - BTTS: "Yes"/"No" → "yes"/"no".
 *  - Double Chance: "X Or Draw"/"Draw Or Y"/"X Or Y" → "1x"/"x2"/"12".
 *    Identificado por la posición del "Draw" en el texto (Pinnacle no
 *    expone alignment para specials).
 */
function specialSelection(kind: SpecialKind, participantName: string): string | null {
  const n = participantName.trim();
  if (kind === "btts") {
    if (/^yes$/i.test(n)) return "yes";
    if (/^no$/i.test(n)) return "no";
    return null;
  }
  // double_chance: el orden de las palabras alrededor de "Draw" identifica
  // la doble oportunidad de forma robusta a equipos/idioma.
  const lower = n.toLowerCase();
  if (!/\bor\b/.test(lower)) return null;
  const hasDrawFirst  = /^draw\b/.test(lower);
  const hasDrawSecond = /\bor draw$/.test(lower);
  if (hasDrawSecond) return "1x"; // "<home> Or Draw"
  if (hasDrawFirst)  return "x2"; // "Draw Or <away>"
  return "12";                    // "<home> Or <away>"
}

export async function scrapePinnacle(): Promise<ScrapedOdd[]> {
  const [matchupsRes, marketsRes] = await Promise.all([
    fetch(
      `${BASE}/sports/${SOCCER_SPORT_ID}/matchups?withSpecials=true&brandId=0`,
      { headers: HEADERS },
    ),
    fetch(
      `${BASE}/sports/${SOCCER_SPORT_ID}/markets/straight`,
      { headers: HEADERS },
    ),
  ]);

  if (!matchupsRes.ok) throw new Error(`Pinnacle matchups HTTP ${matchupsRes.status}`);
  if (!marketsRes.ok) throw new Error(`Pinnacle markets HTTP ${marketsRes.status}`);

  const matchups = (await matchupsRes.json()) as PinnacleMatchup[];
  const markets = (await marketsRes.json()) as PinnacleMarket[];

  // ── Indexar matchups ──────────────────────────────────────────────
  // Main matchups: type "matchup", sin parentId, dos participantes con
  // alineamiento home/away.
  const mainById = new Map<number, PinnacleMatchup>();
  for (const m of matchups) {
    if (m.type !== "matchup") continue;
    if (m.parentId) continue;
    if (!Array.isArray(m.participants) || m.participants.length < 2) continue;
    mainById.set(m.id, m);
  }

  // Specials que vamos a procesar (BTTS, DC). Mapa: specialMatchupId →
  // { mainMatchup, kind, participants }.
  interface SpecialEntry {
    main: PinnacleMatchup;
    kind: SpecialKind;
    participants: PinnacleParticipant[];
  }
  const specialById = new Map<number, SpecialEntry>();
  for (const s of matchups) {
    if (s.type !== "special") continue;
    if (!s.parentId) continue;
    const main = mainById.get(s.parentId);
    if (!main) continue;
    const kind = SPECIAL_BY_DESCRIPTION[s.special?.description ?? ""];
    if (!kind) continue;
    if (!Array.isArray(s.participants) || s.participants.length < 2) continue;
    specialById.set(s.id, { main, kind, participants: s.participants });
  }

  const odds: ScrapedOdd[] = [];

  for (const market of markets) {
    if (market.period !== 0) continue;
    if (market.status && market.status !== "open") continue;

    // ── Camino 1: market sobre el main matchup ──────────────────────
    const main = mainById.get(market.matchupId);
    if (main) {
      const home = main.participants.find((p) => p.alignment === "home")?.name;
      const away = main.participants.find((p) => p.alignment === "away")?.name;
      if (!home || !away) continue;
      const kickoff_date = colombiaDate(main.startTime);
      const isLive = !!main.isLive;

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
            home_team: home, away_team: away, kickoff_date,
            market: "1x2", selection, price: decimal, line: null, is_live: isLive,
          });
        }
        continue;
      }

      if (market.type === "total") {
        const points = market.prices[0]?.points;
        if (points == null || !TOTAL_LINES.has(points)) continue;
        const m: Market =
          points === 1.5 ? "over_under_1_5" :
          points === 2.5 ? "over_under_2_5" :
          "over_under_3_5";
        for (const p of market.prices) {
          const decimal = americanToDecimal(p.price);
          if (decimal <= 1) continue;
          const selection =
            p.designation === "over" ? "over" :
            p.designation === "under" ? "under" : null;
          if (!selection) continue;
          odds.push({
            home_team: home, away_team: away, kickoff_date,
            market: m, selection, price: decimal, line: points, is_live: isLive,
          });
        }
        continue;
      }
      // El main matchup expone también spread/team_total — los ignoramos
      // por ahora (no los procesa el detector).
      continue;
    }

    // ── Camino 2: market sobre un special (BTTS, DC) ────────────────
    const special = specialById.get(market.matchupId);
    if (!special) continue;
    if (market.type !== "moneyline") continue;

    const main2 = special.main;
    const home = main2.participants.find((p) => p.alignment === "home")?.name;
    const away = main2.participants.find((p) => p.alignment === "away")?.name;
    if (!home || !away) continue;
    const kickoff_date = colombiaDate(main2.startTime);
    const isLive = !!main2.isLive;

    // Mapa participantId → nombre del participant en el special
    const partNameById = new Map(special.participants.map((p) => [p.id, p.name]));

    for (const p of market.prices) {
      const decimal = americanToDecimal(p.price);
      if (decimal <= 1) continue;
      if (p.participantId == null) continue;
      const partName = partNameById.get(p.participantId);
      if (!partName) continue;
      const selection = specialSelection(special.kind, partName);
      if (!selection) continue;
      odds.push({
        home_team: home, away_team: away, kickoff_date,
        market: special.kind, selection, price: decimal, line: null, is_live: isLive,
      });
    }
  }

  console.log(
    `[pinnacle] ${odds.length} cuotas extraídas — ` +
    `${mainById.size} main matchups, ${specialById.size} specials relevantes`,
  );
  return odds;
}
