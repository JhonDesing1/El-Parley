/**
 * POST /api/admin/ingest-odds
 *
 * Recibe cuotas scrapeadas (Betplay, Wplay, etc.) y las inserta en `odds`
 * resolviendo el match_id por nombre de equipo + fecha (fuzzy match).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 *
 * La lógica vive en src/lib/odds/ingest.ts y es reutilizada por el cron
 * /api/cron/scrape-odds.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestScrapedOdds, IngestError } from "@/lib/odds/ingest";

const MARKETS = [
  "1x2",
  "double_chance",
  "over_under_2_5",
  "over_under_1_5",
  "btts",
  "asian_handicap",
  "draw_no_bet",
] as const;

const OddSchema = z.object({
  home_team: z.string().min(1),
  away_team: z.string().min(1),
  kickoff_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "formato YYYY-MM-DD"),
  market: z.enum(MARKETS),
  selection: z.string().min(1),
  price: z.number().gt(1),
  line: z.number().nullable().default(null),
  is_live: z.boolean().default(false),
});

const BodySchema = z.object({
  source: z.string().min(1),
  odds: z.array(OddSchema).min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "invalid body", details: String(e) }, { status: 400 });
  }

  try {
    const result = await ingestScrapedOdds(body.source, body.odds);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof IngestError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
