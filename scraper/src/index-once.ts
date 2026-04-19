/**
 * Versión de una sola ejecución para GitHub Actions.
 * Corre ambos scrapers, envía al endpoint y termina.
 */
import "dotenv/config";
import { scrapeBetplay } from "./scrapers/betplay.js";
import { scrapeWplay } from "./scrapers/wplay.js";
import { ingestOdds } from "./ingest.js";

async function main() {
  if (!process.env.APP_URL || !process.env.CRON_SECRET) {
    console.error("ERROR: APP_URL y CRON_SECRET son requeridos");
    process.exit(1);
  }

  console.log(`[scraper] Iniciando — ${new Date().toISOString()}`);
  console.log(`[scraper] APP_URL: ${process.env.APP_URL}`);

  const [betplayOdds, wplayOdds] = await Promise.allSettled([
    scrapeBetplay(),
    scrapeWplay(),
  ]);

  await Promise.allSettled([
    betplayOdds.status === "fulfilled"
      ? ingestOdds({ source: "betplay", odds: betplayOdds.value })
      : Promise.resolve(console.error("[scraper] Betplay falló:", betplayOdds.reason)),

    wplayOdds.status === "fulfilled"
      ? ingestOdds({ source: "wplay", odds: wplayOdds.value })
      : Promise.resolve(console.error("[scraper] Wplay falló:", wplayOdds.reason)),
  ]);

  console.log(`[scraper] Completado — ${new Date().toISOString()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
