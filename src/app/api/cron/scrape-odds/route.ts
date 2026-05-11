/**
 * GET /api/cron/scrape-odds
 *
 * Ejecuta los scrapers de Betplay y Wplay (API de Kambi) y persiste las
 * cuotas vía ingestScrapedOdds. Disparado por Vercel Cron cada 15 min.
 *
 * Reemplaza al workflow .github/workflows/scraper.yml — Vercel ofrece
 * mayor confiabilidad que los runners hospedados de GitHub Actions.
 */

import { NextRequest, NextResponse } from "next/server";
import { scrapeBetplay, scrapeWplay } from "@/lib/scrapers/kambi";
import { scrapePinnacle } from "@/lib/scrapers/pinnacle";
import type { ScrapedOdd } from "@/lib/scrapers/types";
import { ingestScrapedOdds, IngestError } from "@/lib/odds/ingest";
import { notifyAdminError } from "@/lib/telegram/send";

// 1xbet desactivado: la API responde Success:true pero filtra Value:[]
// desde IPs cloud (Vercel São Paulo). El scraper en src/lib/scrapers/1xbet.ts
// queda listo para reactivar cuando exista proxy residencial.

export const dynamic = "force-dynamic";
// Pinnacle (sin primaryOnly + withSpecials) devuelve ~18MB de markets +
// ~12MB de matchups, y la ingesta upsertea ~6.5k cuotas. 60s no alcanza
// en la región gru1; con 300s (max del plan Pro de Vercel) hay margen.
export const maxDuration = 300;

interface SourceResult {
  source: string;
  scraped: number;
  upserted?: number;
  unresolved?: number;
  error?: string;
}

async function runSource(
  source: "betplay" | "wplay" | "pinnacle",
  scraper: () => Promise<ScrapedOdd[]>,
): Promise<SourceResult> {
  try {
    const odds = await scraper();
    if (!odds.length) {
      return { source, scraped: 0 };
    }
    const result = await ingestScrapedOdds(source, odds);
    return {
      source,
      scraped: odds.length,
      upserted: result.upserted,
      unresolved: result.unresolved,
    };
  } catch (e) {
    const msg = e instanceof IngestError ? e.message : e instanceof Error ? e.message : String(e);
    console.error(`[scrape-odds][${source}] falló:`, e);
    await notifyAdminError(`scrape-odds:${source}`, msg);
    return { source, scraped: 0, error: msg };
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();

  const [betplay, wplay, pinnacle] = await Promise.all([
    runSource("betplay", scrapeBetplay),
    runSource("wplay", scrapeWplay),
    runSource("pinnacle", scrapePinnacle),
  ]);

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    sources: [betplay, wplay, pinnacle],
  });
}
