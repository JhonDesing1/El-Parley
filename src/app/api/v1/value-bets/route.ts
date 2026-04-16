import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/value-bets
 *
 * API REST personal para suscriptores Pro.
 * Autenticación: Bearer <api_key> en el header Authorization.
 *
 * Query params:
 *   limit  — número de resultados (máx. 100, por defecto 20)
 *   result — filtrar por resultado: 'pending' | 'won' | 'lost'
 *   market — filtrar por mercado: '1x2' | 'btts' | etc.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const apiKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Use: Authorization: Bearer <api_key>" },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", profile.id)
    .eq("tier", "pro")
    .in("status", ["active", "trialing"])
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json(
      { error: "Active Pro subscription required" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const result = searchParams.get("result");
  const market = searchParams.get("market");

  let query = supabase
    .from("value_bets")
    .select(
      `id, market, selection, price, implied_prob, model_prob,
       edge, kelly_fraction, confidence, result, detected_at,
       match:matches(
         id, kickoff, status,
         home_team:teams!home_team_id(name),
         away_team:teams!away_team_id(name),
         league:leagues(name, country)
       ),
       bookmaker:bookmakers(name, slug)`,
    )
    .order("detected_at", { ascending: false })
    .limit(limit);

  if (result) query = query.eq("result", result);
  if (market) query = query.eq("market", market as "1x2" | "btts" | "over_under_2_5" | "over_under_1_5" | "double_chance" | "correct_score" | "asian_handicap" | "draw_no_bet");

  const { data, error } = await query;

  if (error) {
    console.error("[api/v1/value-bets]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ data, count: data?.length ?? 0 });
}
