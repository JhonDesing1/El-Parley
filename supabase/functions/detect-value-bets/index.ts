// supabase/functions/detect-value-bets/index.ts
//
// Edge Function de Supabase (Deno).
// Schedule: cada 15 minutos via pg_cron o Supabase Scheduled Functions.
//
// Para cada partido próximo (siguientes 48h):
//  1. Lee xG estimado del modelo (precomputado o desde stats recientes)
//  2. Calcula probabilidades 1X2 / Over-Under / BTTS con Poisson + Dixon-Coles
//  3. Compara con cada cuota disponible
//  4. Si edge >= 3% inserta una fila en value_bets

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ─── Implementación inline de Poisson + value bet detection ──────
// (duplicada del lado Next.js para que la edge function sea autocontenida)

function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

interface MatchProbs {
  home: number;
  draw: number;
  away: number;
  over25: number;
  under25: number;
  btts: number;
  noBtts: number;
}

function calculateProbs(homeXg: number, awayXg: number, maxGoals = 8): MatchProbs {
  let home = 0, draw = 0, away = 0;
  let over25 = 0, btts = 0;
  const rho = -0.1;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      let p = poissonPMF(h, homeXg) * poissonPMF(a, awayXg);
      // Dixon-Coles para marcadores bajos
      if (h === 0 && a === 0) p *= 1 - homeXg * awayXg * rho;
      else if (h === 0 && a === 1) p *= 1 + homeXg * rho;
      else if (h === 1 && a === 0) p *= 1 + awayXg * rho;
      else if (h === 1 && a === 1) p *= 1 - rho;

      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;

      if (h + a > 2) over25 += p;
      if (h > 0 && a > 0) btts += p;
    }
  }

  const total = home + draw + away;
  return {
    home: home / total,
    draw: draw / total,
    away: away / total,
    over25,
    under25: 1 - over25,
    btts,
    noBtts: 1 - btts,
  };
}

function detectValue(modelProb: number, decimalOdds: number, minEdge = 0.03) {
  const edge = modelProb * decimalOdds - 1;
  const b = decimalOdds - 1;
  const fullKelly = (b * modelProb - (1 - modelProb)) / b;
  const kelly = Math.max(0, Math.min(0.05, fullKelly * 0.25));

  let confidence: "low" | "medium" | "high" = "low";
  if (edge >= 0.08 && modelProb >= 0.4) confidence = "high";
  else if (edge >= 0.05) confidence = "medium";

  return { isValue: edge >= minEdge, edge, kelly, confidence };
}

const MARKET_SELECTION_MAP: Record<string, (p: MatchProbs) => number> = {
  "1x2:home": (p) => p.home,
  "1x2:draw": (p) => p.draw,
  "1x2:away": (p) => p.away,
  "over_under_2_5:over": (p) => p.over25,
  "over_under_2_5:under": (p) => p.under25,
  "btts:yes": (p) => p.btts,
  "btts:no": (p) => p.noBtts,
};

Deno.serve(async (req) => {
  // Auth simple
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

  // 1. Próximos partidos con xG estimado
  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      "id, model_expected_goals_home, model_expected_goals_away, model_home_prob",
    )
    .gte("kickoff", now.toISOString())
    .lte("kickoff", in48h.toISOString())
    .eq("status", "scheduled")
    .not("model_expected_goals_home", "is", null);

  if (error) return new Response(JSON.stringify({ error }), { status: 500 });
  if (!matches?.length) return new Response(JSON.stringify({ ok: true, scanned: 0 }));

  let detected = 0;

  for (const match of matches) {
    const probs = calculateProbs(
      match.model_expected_goals_home!,
      match.model_expected_goals_away!,
    );

    // 2. Cuotas actuales del partido
    const { data: odds } = await supabase
      .from("odds")
      .select("id, bookmaker_id, market, selection, price")
      .eq("match_id", match.id);

    if (!odds) continue;

    const bets = [];
    for (const o of odds) {
      const key = `${o.market}:${o.selection}`;
      const probGetter = MARKET_SELECTION_MAP[key];
      if (!probGetter) continue;

      const modelProb = probGetter(probs);
      const result = detectValue(modelProb, o.price);
      if (!result.isValue) continue;

      bets.push({
        match_id: match.id,
        bookmaker_id: o.bookmaker_id,
        market: o.market,
        selection: o.selection,
        price: o.price,
        implied_prob: 1 / o.price,
        model_prob: modelProb,
        edge: result.edge,
        kelly_fraction: result.kelly,
        confidence: result.confidence,
        is_premium: result.edge < 0.06, // las muy buenas (>6%) son free como hook
        reasoning: `Modelo estima ${(modelProb * 100).toFixed(0)}% vs ${((1 / o.price) * 100).toFixed(0)}% implícita. Edge +${(result.edge * 100).toFixed(1)}%.`,
      });
    }

    if (bets.length) {
      // Borrar value bets pendientes anteriores de este partido para no duplicar
      await supabase
        .from("value_bets")
        .delete()
        .eq("match_id", match.id)
        .eq("result", "pending");

      const { error: insErr } = await supabase.from("value_bets").insert(bets);
      if (!insErr) detected += bets.length;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      matchesScanned: matches.length,
      valueBetsDetected: detected,
      timestamp: now.toISOString(),
    }),
    { headers: { "content-type": "application/json" } },
  );
});
