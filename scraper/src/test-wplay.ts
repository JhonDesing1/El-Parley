/**
 * Script de prueba rápida — solo Wplay vía API Kambi (sin browser ni Next.js).
 * Ejecutar: npx tsx src/test-wplay.ts
 */
import "dotenv/config";
import { chromium } from "playwright";
import { scrapeWplay } from "./scrapers/wplay.js";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const odds = await scrapeWplay(browser);
    console.log(`\nTotal cuotas: ${odds.length}`);
    console.log("Muestra (primeras 5):");
    console.log(JSON.stringify(odds.slice(0, 5), null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
