import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { buildAffiliateUrl, BOOKMAKERS } from "@/config/bookmakers";

/**
 * GET /api/track/affiliate?book=betplay&match=123&source=match_detail
 *
 * Registra el click de forma anónima (IP hasheada) y redirige al operador
 * con el tag de afiliado correspondiente. Importante para atribución CPA.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const book = searchParams.get("book");
  const matchId = searchParams.get("match");
  const source = searchParams.get("source") ?? "unknown";

  if (!book || !BOOKMAKERS[book]) {
    return NextResponse.json({ error: "Invalid bookmaker" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Resolver bookmaker_id
  const { data: bookmakerRow } = await supabase
    .from("bookmakers")
    .select("id")
    .eq("slug", book)
    .single();

  // IP hasheada para no almacenar PII
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const ipHash = createHash("sha256")
    .update(ip + (process.env.CRON_SECRET ?? ""))
    .digest("hex");

  // Fire-and-forget: no bloqueamos el redirect
  void supabase.from("affiliate_clicks").insert({
    bookmaker_id: bookmakerRow?.id ?? null,
    match_id: matchId ? Number(matchId) : null,
    source,
    ip_hash: ipHash,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    country: req.headers.get("x-vercel-ip-country") ?? "CO",
  });

  const target = buildAffiliateUrl(book);
  return NextResponse.redirect(target, 302);
}
