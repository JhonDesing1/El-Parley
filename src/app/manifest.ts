import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "El Parley — Value Betting LATAM",
    short_name: "El Parley",
    description:
      "Cuotas en vivo, value bets matemáticas y parlays de alta probabilidad para Colombia y LATAM.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    orientation: "portrait",
    categories: ["sports", "finance", "entertainment"],
    icons: [
      { src: "/api/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/api/icons/512", sizes: "512x512", type: "image/png" },
      {
        src: "/api/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
