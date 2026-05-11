/**
 * GET /api/cron/snapshot-clv
 *
 * Captura el "precio de cierre" de Pinnacle para cada value_bet pendiente
 * cuyo partido arranca en los próximos minutos. CLV = bet_price × closing_fair_prob − 1.
 *
 * Por qué importa: CLV es el único KPI con correlación demostrada con la
 * rentabilidad a largo plazo de un apostador. Si nuestras bets vencen
 * sistemáticamente a la línea de cierre de Pinnacle (CLV > 0), el modelo
 * es genuinamente +EV — independientemente de si los partidos individuales
 * se ganan o pierden por varianza.
 *
 * Cómo funciona:
 *   1. Selecciona value_bets pendientes con kickoff en [now, now+10min].
 *   2. Excluye las que ya tienen snapshot (UNIQUE en value_bet_id).
 *   3. Lee las últimas cuotas de Pinnacle en DB para esos matches
 *      (refrescadas por scrape-odds cada 15 min).
 *   4. De-viga por (market, line) y calcula closing_fair_prob.
 *   5. Inserta una fila en clv_snapshots por cada bet con dato disponible.
 *
 * Frecuencia recomendada: cada 5 minutos en vercel.json — así el snapshot
 * cae a ≤10 min del kickoff, que es el horizonte estándar de "closing line".
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  pinnacleFairProbs,
  pinnacleFairKey,
  type PinnacleOdd,
} from "@/lib/betting/pinnacle-fair-odds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Ventana en minutos antes del kickoff para tomar el snapshot. */
const CLOSING_WINDOW_MIN = 10;

interface ClvSnapshotInsert {
  value_bet_id: number;
  match_id: number;
  market: string;
  selection: string;
  line: number | null;
  bet_price: number;
  bet_fair_prob: number | null;
  closing_fair_prob: number;
  clv: number;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + CLOSING_WINDOW_MIN * 60 * 1000);

  const { data: pinBookmaker } = await supabase
    .from("bookmakers")
    .select("id")
    .eq("slug", "pinnacle")
    .maybeSingle();
  if (!pinBookmaker) {
    return NextResponse.json({ ok: true, reason: "pinnacle bookmaker not seeded", snapshotted: 0 });
  }
  const pinnacleBookmakerId = pinBookmaker.id;

  // Matches que arrancan dentro de la ventana de cierre.
  const { data: hotMatches } = await supabase
    .from("matches")
    .select("id")
    .gte("kickoff", now.toISOString())
    .lte("kickoff", horizon.toISOString())
    .eq("status", "scheduled");

  const matchIds = (hotMatches ?? []).map((m) => m.id);
  if (matchIds.length === 0) {
    return NextResponse.json({ ok: true, snapshotted: 0, reason: "no matches in window" });
  }

  // value_bets pendientes para esos matches. Excluimos las apostadas en
  // Pinnacle mismo (no tendría sentido comparar contra sí misma).
  const { data: bets, error: betsErr } = await supabase
    .from("value_bets")
    .select("id, match_id, market, selection, line, price, pinnacle_fair_prob")
    .in("match_id", matchIds)
    .eq("result", "pending")
    .neq("bookmaker_id", pinnacleBookmakerId);

  if (betsErr) {
    return NextResponse.json({ error: betsErr.message }, { status: 500 });
  }
  if (!bets?.length) {
    return NextResponse.json({ ok: true, snapshotted: 0, reason: "no pending bets" });
  }

  // Filtrar las que ya tienen snapshot (UNIQUE constraint evitaría el insert
  // pero igual hacemos el check para no procesar de más).
  const { data: existing } = await supabase
    .from("clv_snapshots")
    .select("value_bet_id")
    .in("value_bet_id", bets.map((b) => b.id));
  const alreadySnapshotted = new Set((existing ?? []).map((e) => e.value_bet_id));
  const todo = bets.filter((b) => !alreadySnapshotted.has(b.id));
  if (!todo.length) {
    return NextResponse.json({ ok: true, snapshotted: 0, reason: "all already snapshotted" });
  }

  // Cuotas de Pinnacle (latest) por match.
  const todoMatchIds = [...new Set(todo.map((b) => b.match_id))];
  const { data: pinOdds, error: oddsErr } = await supabase
    .from("odds")
    .select("match_id, market, selection, line, price")
    .in("match_id", todoMatchIds)
    .eq("bookmaker_id", pinnacleBookmakerId);

  if (oddsErr) {
    return NextResponse.json({ error: oddsErr.message }, { status: 500 });
  }

  const oddsByMatch = new Map<number, PinnacleOdd[]>();
  for (const o of pinOdds ?? []) {
    const bucket = oddsByMatch.get(o.match_id);
    const item: PinnacleOdd = {
      market: o.market,
      selection: o.selection,
      line: o.line,
      price: o.price,
    };
    if (bucket) bucket.push(item);
    else oddsByMatch.set(o.match_id, [item]);
  }

  const snapshots: ClvSnapshotInsert[] = [];
  let missingFair = 0;

  for (const bet of todo) {
    const matchOdds = oddsByMatch.get(bet.match_id);
    if (!matchOdds?.length) {
      missingFair += 1;
      continue;
    }
    const fairMap = pinnacleFairProbs(matchOdds);
    const fair = fairMap.get(pinnacleFairKey(bet.market, bet.selection, bet.line));
    if (fair == null) {
      missingFair += 1;
      continue;
    }
    const clv = bet.price * fair - 1;
    snapshots.push({
      value_bet_id: bet.id,
      match_id: bet.match_id,
      market: bet.market,
      selection: bet.selection,
      line: bet.line,
      bet_price: bet.price,
      bet_fair_prob: bet.pinnacle_fair_prob,
      closing_fair_prob: fair,
      clv,
    });
  }

  let inserted = 0;
  if (snapshots.length) {
    const { error: insErr } = await supabase.from("clv_snapshots").insert(snapshots);
    if (insErr) {
      return NextResponse.json(
        { error: insErr.message, attempted: snapshots.length },
        { status: 500 },
      );
    }
    inserted = snapshots.length;
  }

  return NextResponse.json({
    ok: true,
    matchesInWindow: matchIds.length,
    betsConsidered: todo.length,
    snapshotted: inserted,
    skippedNoPinnacleLine: missingFair,
    timestamp: now.toISOString(),
  });
}
