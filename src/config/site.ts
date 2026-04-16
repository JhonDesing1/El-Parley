export const siteConfig = {
  name: "El Parley",
  shortName: "EP",
  tagline: "Value betting con matemáticas, no con corazonadas.",
  description:
    "Plataforma de análisis de cuotas, value bets y parlays para Colombia y LATAM. Compara Betplay, Wplay, Codere y más.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://elparley.com",
  ogImage: "/og-default.png",
  links: {
    twitter: "https://twitter.com/elparley",
    instagram: "https://instagram.com/elparley",
    telegram: "https://t.me/elparley",
  },
  responsibleGambling: {
    line: "LÍNEA 106 (Bogotá)",
    url: "https://ludopatia.org.co",
    minAge: 18,
  },
} as const;

export type SiteConfig = typeof siteConfig;
