/**
 * Envía las cuotas scrapeadas al endpoint /api/admin/ingest-odds
 * y loguea el resultado.
 */

import { IngestPayload } from "./types.js";

const APP_URL    = process.env.APP_URL    ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function ingestOdds(payload: IngestPayload): Promise<void> {
  if (!payload.odds.length) {
    console.log(`[ingest][${payload.source}] Sin cuotas — nada que enviar.`);
    return;
  }

  const url = `${APP_URL}/api/admin/ingest-odds`;

  let res: Response;
  try {
    res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error(`[ingest][${payload.source}] Error de red:`, e);
    return;
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    console.error(`[ingest][${payload.source}] HTTP ${res.status}:`, json);
    return;
  }

  console.log(
    `[ingest][${payload.source}] ✓ recibidas=${json.received} upserted=${json.upserted} unresolved=${json.unresolved}`,
  );
  if (json.unresolvedMatches?.length) {
    console.warn(`[ingest][${payload.source}] Partidos sin resolver:`, json.unresolvedMatches);
  }
}
