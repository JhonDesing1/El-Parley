export const siteConfig = {
  name: "ApuestaValue",
  shortName: "AV",
  tagline: "Value betting con matemáticas, no con corazonadas.",
  description:
    "Plataforma de análisis de cuotas, value bets y parlays para Colombia y LATAM. Compara Betplay, Wplay, Codere y más.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://apuestavalue.com",
  ogImage: "/og-default.png",
  links: {
    twitter: "https://twitter.com/apuestavalue",
    instagram: "https://instagram.com/apuestavalue",
    telegram: "https://t.me/apuestavalue",
  },
  responsibleGambling: {
    line: "LÍNEA 106 (Bogotá)",
    url: "https://ludopatia.org.co",
    minAge: 18,
  },
} as const;

export type SiteConfig = typeof siteConfig;
