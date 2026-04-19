/**
 * El Parley — Scraper de cuotas colombianas
 *
 * Ejecuta scrapers de Betplay y Wplay en un intervalo configurable
 * y envía los resultados al endpoint /api/admin/ingest-odds de la app.
 *
 * Uso:
 *   npm start                 # producción (Railway/Render)
 *   npm run dev               # desarrollo con hot-reload
 *   DEBUG=true npm run dev    # con screenshots de depuración
 */

import "dotenv/config";
import cron from "node-cron";
import { scrapeBetplay } from "./scrapers/betplay.js";
import { scrapeWplay } from "./scrapers/wplay.js";
import { ingestOdds } from "./ingest.js";

const INTERVAL_MIN = parseInt(process.env.SCRAPE_INTERVAL_MIN ?? "15", 10);

// Validar variables de entorno críticas
if (!process.env.APP_URL) {
  console.error("ERROR: APP_URL no está configurado en .env");
  process.exit(1);
}
if (!process.env.CRON_SECRET) {
  console.error("ERROR: CRON_SECRET no está configurado en .env");
  process.exit(1);
}

// ── Ciclo de scraping ────────────────────────────────────────────────────────

async function runScraper() {
  console.log(`\n[scraper] ▶ Iniciando ciclo — ${new Date().toISOString()}`);

  // Ambos scrapers usan la API de Kambi directamente (sin browser)
  const [betplayOdds, wplayOdds] = await Promise.allSettled([
    scrapeBetplay(),
    scrapeWplay(),
  ]);

  // Enviar resultados al endpoint
  await Promise.allSettled([
    betplayOdds.status === "fulfilled"
      ? ingestOdds({ source: "betplay", odds: betplayOdds.value })
      : Promise.resolve(console.error("[scraper] Betplay falló:", betplayOdds.reason)),

    wplayOdds.status === "fulfilled"
      ? ingestOdds({ source: "wplay", odds: wplayOdds.value })
      : Promise.resolve(console.error("[scraper] Wplay falló:", wplayOdds.reason)),
  ]);

  console.log(`[scraper] ✓ Ciclo completado — próximo en ${INTERVAL_MIN} min`);
}

// ── Inicio ───────────────────────────────────────────────────────────────────

console.log(`[scraper] El Parley — Scraper de cuotas colombianas`);
console.log(`[scraper] APP_URL: ${process.env.APP_URL}`);
console.log(`[scraper] Intervalo: cada ${INTERVAL_MIN} minutos`);
console.log(`[scraper] DEBUG: ${process.env.DEBUG === "true" ? "activado" : "desactivado"}`);

// Ejecutar inmediatamente al arrancar
runScraper().catch(console.error);

// Luego en el intervalo configurado
cron.schedule(`*/${INTERVAL_MIN} * * * *`, () => {
  runScraper().catch(console.error);
});
