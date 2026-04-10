// supabase/functions/generate-parlays/index.ts
//
// Genera 3-5 parlays sugeridos por día combinando value bets de alta confianza.
// Schedule: 07:00 COT diario.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MIN_LEGS = 2;
const MAX_LEGS = 4;
const MIN_COMBINED_PROB = 0.55;
const TARGET_PARLAYS = 5;

Deno.serve(async (req) => {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Value bets de hoy con confianza media o alta
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 36 * 3600 * 1000);

  const { data: candidates } = await supabase
    .from("value_bets")
    .select(
      "id, match_id, bookmaker_id, market, selection, price, model_prob, edge, confidence, matches!inner(kickoff)",
    )
    .in("confidence", ["medium", "high"])
    .eq("result", "pending")
    .gte("matches.kickoff", today.toISOString())
    .lte("matches.kickoff", tomorrow.toISOString())
    .order("edge", { ascending: false })
    .limit(40);

  if (!candidates?.length) {
    return new Response(JSON.stringify({ ok: true, generated: 0 }));
  }

  // Greedy combinar legs evitando dos del mismo partido
  const parlays: any[] = [];
  const used = new Set<number>();

  for (let p = 0; p < TARGET_PARLAYS; p++) {
    const legs: typeof candidates = [];
    const legMatches = new Set<number>();

    for (const c of candidates) {
      if (used.has(c.id)) continue;
      if (legMatches.has(c.match_id)) continue;
      legs.push(c);
      legMatches.add(c.match_id);
      if (legs.length >= MAX_LEGS) break;
    }

    if (legs.length < MIN_LEGS) break;

    const totalOdds = legs.reduce((acc, l) => acc * Number(l.price), 1);
    const totalProb = legs.reduce((acc, l) => acc * Number(l.model_prob), 1);
    if (totalProb < MIN_COMBINED_PROB / Math.pow(0.85, legs.length - 1)) continue;

    const ev = totalProb * totalOdds - 1;
    if (ev < 0.05) continue;

    legs.forEach((l) => used.add(l.id));

    const conf = ev > 0.2 ? "high" : ev > 0.1 ? "medium" : "low";
    const isFree = p === 0; // Solo el primer parlay es free (hook)

    parlays.push({
      title: `Combinada del día — ${legs.length} selecciones`,
      description: `EV +${(ev * 100).toFixed(1)}% según modelo`,
      total_odds: totalOdds,
      total_probability: totalProb,
      expected_value: ev,
      confidence: conf,
      tier: isFree ? "free" : "premium",
      is_featured: p === 0,
      valid_until: tomorrow.toISOString(),
      legs,
    });
  }

  // Insertar parlays + legs
  let inserted = 0;
  for (const parlay of parlays) {
    const { legs, ...parlayData } = parlay;
    const { data: parlayRow, error } = await supabase
      .from("parlays")
      .insert(parlayData)
      .select("id")
      .single();
    if (error || !parlayRow) continue;

    const legRows = legs.map((leg: any, idx: number) => ({
      parlay_id: parlayRow.id,
      match_id: leg.match_id,
      bookmaker_id: leg.bookmaker_id,
      market: leg.market,
      selection: leg.selection,
      price: leg.price,
      model_prob: leg.model_prob,
      leg_order: idx + 1,
    }));
    await supabase.from("parlay_legs").insert(legRows);
    inserted++;
  }

  return new Response(
    JSON.stringify({ ok: true, generated: inserted }),
    { headers: { "content-type": "application/json" } },
  );
});
