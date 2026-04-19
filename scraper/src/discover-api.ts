/**
 * Herramienta de diagnóstico: captura todas las llamadas de red de Wplay y Betplay
 * para descubrir los endpoints de sus APIs internas.
 * Ejecutar: npx tsx src/discover-api.ts
 */
import "dotenv/config";
import { chromium } from "playwright";
import fs from "fs";

async function discover(url: string, label: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const apiCalls: Array<{ url: string; status: number; contentType: string }> = [];

  page.on("response", async (response) => {
    const reqUrl = response.url();
    const ct = response.headers()["content-type"] ?? "";
    // Capturar solo JSON y las que no sean assets
    if (ct.includes("json") || reqUrl.includes("api") || reqUrl.includes("odds") || reqUrl.includes("event")) {
      apiCalls.push({ url: reqUrl, status: response.status(), contentType: ct });

      // Guardar el body de respuestas JSON relevantes
      if (ct.includes("json") && response.status() === 200) {
        try {
          const body = await response.text();
          const data = JSON.parse(body);
          const filename = `debug/api-${label}-${Date.now()}.json`;
          fs.mkdirSync("debug", { recursive: true });
          fs.writeFileSync(filename, JSON.stringify(data, null, 2).slice(0, 50000)); // max 50KB
          console.log(`  → Guardado: ${filename} (${body.length} bytes)`);
        } catch { /* ignorar */ }
      }
    }
  });

  console.log(`\n[discover][${label}] Navegando a ${url}...`);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(8_000); // Esperar carga completa

    // Hacer scroll para triggear carga lazy
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(3_000);

    await page.screenshot({ path: `debug/${label}-discover.png`, fullPage: true });
  } catch (e) {
    console.error(`[discover][${label}] Error:`, e);
  }

  console.log(`\n[discover][${label}] Llamadas de red capturadas (${apiCalls.length}):`);
  for (const call of apiCalls) {
    console.log(`  ${call.status} ${call.url.slice(0, 120)}`);
  }

  await browser.close();
}

async function main() {
  fs.mkdirSync("debug", { recursive: true });
  await discover("https://www.betplay.com.co/apuestas#/deporte/1", "betplay");
  await discover("https://www.wplay.co/apuestas/#/filter/football", "wplay");
}

main().catch(console.error);
