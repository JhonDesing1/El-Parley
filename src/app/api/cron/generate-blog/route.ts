import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron — corre cada día a las 12:00 UTC.
 * Genera posts de análisis automáticos para los partidos con value bets
 * del día siguiente. El contenido se construye a partir de los datos
 * del modelo (xG, edge, cuotas comparadas) sin necesitar una API de IA.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

  // Partidos de las próximas 48h que tienen al menos un value bet
  const { data: valueBets, error } = await supabase
    .from("value_bets")
    .select(
      `
      id, market, selection, price, edge, model_prob, confidence, reasoning,
      bookmaker:bookmakers(name, slug),
      match:matches(
        id, kickoff, round,
        home_team:teams!home_team_id(name),
        away_team:teams!away_team_id(name),
        league:leagues(name, country)
      )
      `,
    )
    .eq("result", "pending")
    .gte("edge", 0.03)
    .gte("match.kickoff", now.toISOString())
    .lte("match.kickoff", in48h.toISOString())
    .order("edge", { ascending: false });

  if (error) {
    console.error("[generate-blog] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!valueBets?.length) {
    return NextResponse.json({ ok: true, generated: 0, reason: "no value bets found" });
  }

  // Agrupar por partido
  const byMatch = new Map<number, typeof valueBets>();
  for (const vb of valueBets) {
    const match = vb.match as any;
    if (!match?.id) continue;
    const list = byMatch.get(match.id) ?? [];
    list.push(vb);
    byMatch.set(match.id, list);
  }

  let generated = 0;
  const slugsCreated: string[] = [];

  for (const [, bets] of byMatch) {
    const match = bets[0].match as any;
    if (!match) continue;

    const home = match.home_team?.name ?? "Local";
    const away = match.away_team?.name ?? "Visitante";
    const league = match.league?.name ?? "Liga";
    const kickoff = new Date(match.kickoff);
    const dateStr = kickoff.toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Bogota",
    });

    const slug = `${home}-vs-${away}-${kickoff.toISOString().slice(0, 10)}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);

    // Evitar duplicados
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) continue;

    // Construir contenido en markdown
    const bestBet = bets[0] as any;
    const edgePct = (bestBet.edge * 100).toFixed(1);
    const modelPct = (bestBet.model_prob * 100).toFixed(0);

    const betLines = bets
      .slice(0, 5)
      .map((vb: any) => {
        const book = vb.bookmaker?.name ?? "Bookmaker";
        const ePct = (vb.edge * 100).toFixed(1);
        const mPct = (vb.model_prob * 100).toFixed(0);
        return `- **${vb.market} / ${vb.selection}** — Cuota ${vb.price.toFixed(2)} en ${book} · Edge +${ePct}% · Modelo estima ${mPct}%`;
      })
      .join("\n");

    const content = `# Pronóstico ${home} vs ${away} — ${league}

**Fecha:** ${dateStr}
**Competición:** ${league}${match.round ? ` · ${match.round}` : ""}

## Análisis de value bets

Nuestro modelo matemático (Poisson + xG + Dixon-Coles) ha detectado **${bets.length} oportunidad${bets.length > 1 ? "es" : ""} de valor** para este partido con un edge mínimo del 3% sobre las probabilidades implícitas del mercado.

La oportunidad más atractiva es **${bestBet.selection}** en el mercado ${bestBet.market} con una cuota de ${bestBet.price.toFixed(2)}: el modelo asigna una probabilidad real del ${modelPct}% frente al ${(100 / bestBet.price).toFixed(0)}% implícito de la cuota. El edge resultante es de **+${edgePct}%**.

${bestBet.reasoning ? `> ${bestBet.reasoning}` : ""}

## Resumen de apuestas de valor detectadas

${betLines}

---

*Análisis generado automáticamente por el modelo estadístico de El Parley. Una value bet representa una ventaja matemática esperada, no una garantía de ganancias. Apuesta solo lo que puedas perder. +18.*
`;

    const title = `Pronóstico ${home} vs ${away}: ${bets.length} value bet${bets.length > 1 ? "s" : ""} detectada${bets.length > 1 ? "s" : ""} (edge +${edgePct}%)`;
    const excerpt = `El modelo de El Parley detecta ${bets.length} oportunidad${bets.length > 1 ? "es" : ""} de valor en ${home} vs ${away} (${league}). Edge máximo: +${edgePct}%.`;

    const { error: insertErr } = await supabase.from("blog_posts").insert({
      slug,
      title,
      excerpt,
      content,
      category: match.league?.country?.toLowerCase() ?? "general",
      tags: [home, away, league, "value-bet", "pronostico"],
      related_match_id: match.id,
      is_published: true,
      published_at: now.toISOString(),
      seo_title: title,
      seo_description: excerpt,
    });

    if (insertErr) {
      console.error(`[generate-blog] Insert error for ${slug}:`, insertErr);
    } else {
      generated++;
      slugsCreated.push(slug);
    }
  }

  return NextResponse.json({
    ok: true,
    generated,
    slugs: slugsCreated,
    timestamp: now.toISOString(),
  });
}
