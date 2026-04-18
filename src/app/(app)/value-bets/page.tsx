import Link from "next/link";
import { Lock, TrendingUp, Target, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isPremiumUser } from "@/lib/utils/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buildAffiliateUrl } from "@/config/bookmakers";
import { cn } from "@/lib/utils/cn";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Value Bets — El Parley",
  description:
    "Apuestas con valor matemático detectadas por el modelo Poisson. Edge mínimo 3% sobre la cuota implícita.",
};

export const revalidate = 300; // 5 min — sincronizado con sync-live-odds

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  low: "bg-muted/50 text-muted-foreground border-border/40",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const MARKET_LABELS: Record<string, string> = {
  "1x2": "1X2",
  btts: "Ambos anotan",
  over_under_2_5: "+/- 2.5",
  over_under_1_5: "+/- 1.5",
};

const SELECTION_LABELS: Record<string, string> = {
  home: "Local",
  draw: "Empate",
  away: "Visitante",
  over: "Más",
  under: "Menos",
  yes: "Sí",
  no: "No",
};

export default async function ValueBetsPage() {
  const [supabase, isPremium] = await Promise.all([createClient(), isPremiumUser()]);

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

  // Free users only see bets with edge ≥ 6% (is_premium = false)
  // Premium/Pro see everything
  let query = supabase
    .from("value_bets")
    .select(
      `id, market, selection, price, edge, kelly_fraction, confidence, is_premium, reasoning,
       bookmaker:bookmakers(id, slug, name, affiliate_url),
       match:matches(
         id, kickoff, status,
         home_team:teams!home_team_id(name, short_name, logo_url),
         away_team:teams!away_team_id(name, short_name, logo_url),
         league:leagues(name, country)
       )`,
    )
    .eq("result", "pending")
    .gte("match.kickoff" as never, now.toISOString())
    .lte("match.kickoff" as never, in48h.toISOString())
    .order("edge", { ascending: false });

  if (!isPremium) {
    query = query.eq("is_premium", false);
  }

  const { data: bets } = await query;

  // Filter out bets whose match join returned null (match outside 48h window)
  const valueBets = (bets ?? []).filter((b) => b.match != null);

  const total = valueBets.length;
  const highConf = valueBets.filter((b) => b.confidence === "high").length;
  const avgEdge =
    total > 0
      ? ((valueBets.reduce((s, b) => s + Number(b.edge), 0) / total) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="container max-w-5xl py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <TrendingUp className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Value Bets</h1>
            <p className="text-sm text-muted-foreground">
              Próximas 48 horas · Edge mínimo 3%
            </p>
          </div>
        </div>

        {!isPremium && (
          <Link
            href="/premium"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
          >
            <Lock className="h-4 w-4" />
            Desbloquear todas (Premium)
          </Link>
        )}
      </div>

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            Value bets
          </div>
          <div className="font-mono text-2xl font-bold">{total}</div>
          {!isPremium && (
            <div className="mt-1 text-xs text-muted-foreground">
              Solo edge ≥6% · <Link href="/premium" className="text-amber-400 hover:underline">Ver todas</Link>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            Alta confianza
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-400">{highConf}</div>
          <div className="mt-1 text-xs text-muted-foreground">Edge ≥8%</div>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Edge promedio
          </div>
          <div className="font-mono text-2xl font-bold text-amber-400">+{avgEdge}%</div>
        </div>
      </div>

      {/* Lista */}
      {total === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <TrendingUp className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No hay value bets disponibles en las próximas 48 horas.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              El modelo detecta nuevas oportunidades cada 10 minutos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {valueBets.map((bet) => {
            const match = bet.match as any;
            const bookmaker = bet.bookmaker as any;
            const home = match?.home_team?.short_name ?? match?.home_team?.name ?? "Local";
            const away = match?.away_team?.short_name ?? match?.away_team?.name ?? "Visitante";
            const kickoff = match?.kickoff ? new Date(match.kickoff) : null;
            const marketLabel = MARKET_LABELS[bet.market] ?? bet.market;
            const selectionLabel = SELECTION_LABELS[bet.selection] ?? bet.selection;
            const affiliateUrl = bookmaker?.slug
              ? buildAffiliateUrl(bookmaker.slug)
              : null;

            return (
              <div
                key={bet.id}
                className="group rounded-xl border border-border/50 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/partido/${match?.id}`}
                        className="font-semibold text-sm hover:text-amber-400 transition-colors truncate"
                      >
                        {home} vs {away}
                      </Link>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] shrink-0",
                          CONFIDENCE_STYLES[bet.confidence ?? "low"],
                        )}
                      >
                        {CONFIDENCE_LABELS[bet.confidence ?? "low"]}
                      </Badge>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{match?.league?.name ?? "—"}</span>
                      {kickoff && (
                        <span>
                          {kickoff.toLocaleDateString("es-CO", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          {kickoff.toLocaleTimeString("es-CO", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      {bookmaker?.name && <span>{bookmaker.name}</span>}
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground/80 italic leading-relaxed">
                      {bet.reasoning}
                    </div>
                  </div>

                  {/* Stats + CTA */}
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                    <div className="flex items-center gap-4">
                      {/* Mercado */}
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Mercado
                        </div>
                        <div className="font-mono text-sm font-semibold">
                          {marketLabel} · {selectionLabel}
                        </div>
                      </div>

                      {/* Cuota */}
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Cuota
                        </div>
                        <div className="font-mono text-lg font-bold">
                          {Number(bet.price).toFixed(2)}
                        </div>
                      </div>

                      {/* Edge */}
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Edge
                        </div>
                        <div className="font-mono text-lg font-bold text-emerald-400">
                          +{(Number(bet.edge) * 100).toFixed(1)}%
                        </div>
                      </div>

                      {/* Kelly */}
                      <div className="hidden text-center sm:block">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Kelly ¼
                        </div>
                        <div className="font-mono text-sm text-amber-400">
                          {((Number(bet.kelly_fraction) / 4) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Botón apostar */}
                    {affiliateUrl ? (
                      <a
                        href={affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-amber-400 shrink-0"
                      >
                        Apostar en {bookmaker.name}
                      </a>
                    ) : (
                      <Link
                        href={`/partido/${match?.id}`}
                        className="inline-flex items-center rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted shrink-0"
                      >
                        Ver partido
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Premium upsell (free users) */}
      {!isPremium && total > 0 && (
        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center">
          <Lock className="mx-auto mb-2 h-5 w-5 text-amber-400" />
          <p className="text-sm font-semibold text-amber-300">
            ¿Quieres ver todas las value bets con edge desde 3%?
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            El plan Premium desbloquea las oportunidades de confianza media con los mejores edges.
          </p>
          <Link
            href="/premium"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            Ver planes Premium
          </Link>
        </div>
      )}
    </div>
  );
}
