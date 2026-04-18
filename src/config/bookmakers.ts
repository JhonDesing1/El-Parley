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
