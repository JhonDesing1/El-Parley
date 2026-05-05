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
import { ingestScrapedOdds, IngestError } from "@/lib/odds/ingest";
import { notifyAdminError } from "@/lib/telegram/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SourceResult {
  source: string;
  scraped: number;
  upserted?: number;
  unresolved?: number;
  error?: string;
}

async function runSource(
  source: "betplay" | "wplay",
  scraper: () => Promise<Awaited<ReturnType<typeof scrapeBetplay>>>,
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

  const [betplay, wplay] = await Promise.all([
    runSource("betplay", scrapeBetplay),
    runSource("wplay", scrapeWplay),
  ]);

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    sources: [betplay, wplay],
  });
}
