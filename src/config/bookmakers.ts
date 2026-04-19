export interface BookmakerConfig {
  slug: string;
  name: string;
  color: string;
  affiliateBase: string;
  envTag: string;
  country: "CO" | "LATAM";
}

export const BOOKMAKERS: Record<string, BookmakerConfig> = {
  bet365: {
    slug: "bet365",
    name: "Bet365",
    color: "#027B5B",
    affiliateBase: "https://www.bet365.com/#/AC/B1/C1/D1002/E79147574/G40/",
    envTag: "NEXT_PUBLIC_BET365_AFF",
    country: "LATAM",
  },
  pinnacle: {
    slug: "pinnacle",
    name: "Pinnacle",
    color: "#CC0000",
    affiliateBase: "https://www.pinnacle.com/es/",
    envTag: "NEXT_PUBLIC_PINNACLE_AFF",
    country: "LATAM",
  },
  "1xbet": {
    slug: "1xbet",
    name: "1xBet",
    color: "#1E5BAA",
    affiliateBase: "https://1xbet.com/es/?tag=",
    envTag: "NEXT_PUBLIC_1XBET_AFF",
    country: "LATAM",
  },
  marathonbet: {
    slug: "marathonbet",
    name: "Marathonbet",
    color: "#FF6600",
    affiliateBase: "https://www.marathonbet.com/es/",
    envTag: "NEXT_PUBLIC_MARATHONBET_AFF",
    country: "LATAM",
  },
  betfair: {
    slug: "betfair",
    name: "Betfair",
    color: "#FFCC00",
    affiliateBase: "https://www.betfair.com/sport/",
    envTag: "NEXT_PUBLIC_BETFAIR_AFF",
    country: "LATAM",
  },
  // ── Casas colombianas (Coljuegos) ────────────────────────────────────────
  betplay: {
    slug: "betplay",
    name: "Betplay",
    color: "#E4002B",
    affiliateBase: "https://www.betplay.com.co/apuestas/",
    envTag: "NEXT_PUBLIC_BETPLAY_AFF",
    country: "CO",
  },
  wplay: {
    slug: "wplay",
    name: "Wplay",
    color: "#003087",
    affiliateBase: "https://www.wplay.co/apuestas/",
    envTag: "NEXT_PUBLIC_WPLAY_AFF",
    country: "CO",
  },
  betcris: {
    slug: "betcris",
    name: "Betcris",
    color: "#E30613",
    affiliateBase: "https://www.betcris.com/es/colombia/",
    envTag: "NEXT_PUBLIC_BETCRIS_AFF",
    country: "CO",
  },
  betano: {
    slug: "betano",
    name: "Betano",
    color: "#FFD700",
    affiliateBase: "https://www.betano.com.co/sport/",
    envTag: "NEXT_PUBLIC_BETANO_AFF",
    country: "CO",
  },
  codere: {
    slug: "codere",
    name: "Codere",
    color: "#00A651",
    affiliateBase: "https://www.codere.com.co/apuestas-deportivas/",
    envTag: "NEXT_PUBLIC_CODERE_AFF",
    country: "CO",
  },
  rushbet: {
    slug: "rushbet",
    name: "Rushbet",
    color: "#FF6B00",
    affiliateBase: "https://rushbet.co/apuestas/",
    envTag: "NEXT_PUBLIC_RUSHBET_AFF",
    country: "CO",
  },
};

export function buildAffiliateUrl(slug: string): string {
  const cfg = BOOKMAKERS[slug];
  if (!cfg) return "#";
  const value = process.env[cfg.envTag] ?? "";
  if (!value) return cfg.affiliateBase;
  // Si el valor es una URL completa, usarla directamente
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${cfg.affiliateBase}${value}`;
}
