export interface BookmakerConfig {
  slug: string;
  name: string;
  color: string;
  affiliateBase: string;
  envTag: string;
  country: "CO" | "LATAM";
}

export const BOOKMAKERS: Record<string, BookmakerConfig> = {
  betplay: {
    slug: "betplay",
    name: "Betplay",
    color: "#FFD200",
    affiliateBase: "https://betplay.com.co/?aff=",
    envTag: "NEXT_PUBLIC_BETPLAY_AFF",
    country: "CO",
  },
  wplay: {
    slug: "wplay",
    name: "Wplay",
    color: "#E30613",
    affiliateBase: "https://wplay.co/?ref=",
    envTag: "NEXT_PUBLIC_WPLAY_AFF",
    country: "CO",
  },
  codere: {
    slug: "codere",
    name: "Codere",
    color: "#7AB800",
    affiliateBase: "https://apuestas.codere.com.co/?tag=",
    envTag: "NEXT_PUBLIC_CODERE_AFF",
    country: "CO",
  },
  rivalo: {
    slug: "rivalo",
    name: "Rivalo",
    color: "#FF6B00",
    affiliateBase: "https://rivalo.com/co/?btag=",
    envTag: "NEXT_PUBLIC_RIVALO_AFF",
    country: "CO",
  },
  "1xbet": {
    slug: "1xbet",
    name: "1xBet",
    color: "#1E5BAA",
    affiliateBase: "https://1xbet.com/es/?tag=",
    envTag: "NEXT_PUBLIC_1XBET_AFF",
    country: "LATAM",
  },
};

export function buildAffiliateUrl(slug: string): string {
  const cfg = BOOKMAKERS[slug];
  if (!cfg) return "#";
  const tag = process.env[cfg.envTag] ?? "apuestavalue";
  return `${cfg.affiliateBase}${tag}`;
}
