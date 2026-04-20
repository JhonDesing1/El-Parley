import Link from "next/link";
import Image from "next/image";
import { Lock, TrendingUp, Target, Zap, ChevronRight, AlertTriangle, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isPremiumUser } from "@/lib/utils/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recomendados del día — El Parley",
  description:
    "Partidos destacados con apuestas de alta probabilidad seleccionadas por el modelo matemático.",
};

export const revalidate = 300;

const MARKET_LABELS: Record<string, string> = {
  "1x2": "1X2",
  btts: "Ambos anotan",
  over_under_2_5: "+/- 2.5 goles",
  over_under_1_5: "+/- 1.5 goles",
  double_chance: "Doble oportunidad",
  draw_no_bet: "Empate anula",
  asian_handicap: "Handicap asiático",
};

const SELECTION_LABELS: Record<string, string> = {
  home: "Local gana",
  draw: "Empate",
  away: "Visitante gana",
  over: "Más de",
  under: "Menos de",
  yes: "Sí marcan",
  no: "No marcan",
};

const CONF_STYLES = {
  high:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  medium: "bg-amber-500/15   text-amber-400   border-amber-500/25",
  low:    "bg-muted/50       text-muted-foreground border-border/40",
};

const CONF_LABELS = { high: "Alta", medium: "Media", low: "Baja" };

function formatKickoff(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default async function RecomendadosPage() {
  const [supabase, isPremium] = await Promise.all([createClient(), isPremiumUser()]);

  const now   = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

  let query = supabase
    .from("value_bets")
    .select(
      `id, market, selection, price, edge, model_prob, confidence, is_premium, reasoning,
       bookmaker:bookmakers(id, slug, name),
       match:matches(
         id, kickoff, status,
         home_team:teams!home_team_id(id, name, short_name, logo_url),
         away_team:teams!away_team_id(id, name, short_name, logo_url),
         league:leagues(name, country, logo_url)
       )`,
    )
    .eq("result", "pending")
    .gte("match.kickoff" as never, now.toISOString())
    .lte("match.kickoff" as never, in48h.toISOString())
    .in("confidence", ["high", "medium"])
    .gte("model_prob", isPremium ? 0.85 : 0)
    .order("model_prob", { ascending: false });

  if (!isPremium) query = query.eq("is_premium", false);

  const { data: rawBets } = await query;
  const bets = (rawBets ?? []).filter((b) => b.match != null);

  // Group by match — best bet per match (highest model_prob)
  const matchMap = new Map<
    number,
    { match: any; bets: typeof bets; injuries: number }
  >();
  for (const bet of bets) {
    const mid = (bet.match as any).id;
    if (!matchMap.has(mid)) matchMap.set(mid, { match: bet.match, bets: [], injuries: 0 });
    matchMap.get(mid)!.bets.push(bet);
  }
  const matchGroups = [...matchMap.values()].slice(0, isPremium ? 6 : matchMap.size);

  // Fetch injury counts for these matches
  const matchIds = matchGroups.map((g) => g.match.id);
  if (matchIds.length) {
    const { data: injuryRows } = await supabase
      .from("injuries")
      .select("match_id")
      .in("match_id", matchIds);
    const injCounts = new Map<number, number>();
    for (const row of injuryRows ?? []) {
      const mid = row.match_id as number;
    injCounts.set(mid, (injCounts.get(mid) ?? 0) + 1);
    }
    matchGroups.forEach((g) => { g.injuries = injCounts.get(g.match.id as number) ?? 0; });
  }

  const total     = matchGroups.length;
  const highConf  = matchGroups.filter((g) => g.bets[0]?.confidence === "high").length;
  const avgProb   =
    total > 0
      ? (matchGroups.reduce((s, g) => s + Number(g.bets[0]?.model_prob ?? 0), 0) / total * 100).toFixed(0)
      : "0";

  return (
    <div className="container max-w-5xl py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Star className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Recomendados del día</h1>
            <p className="text-sm text-muted-foreground">
              Partidos con mayor probabilidad de acierto · próximas 48h
            </p>
          </div>
        </div>
        {!isPremium && (
          <Link
            href="/premium"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-400/20"
          >
            <Lock className="h-4 w-4" />
            Desbloquear todo (Premium)
          </Link>
        )}
      </div>

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            Partidos destacados
          </div>
          <div className="font-mono text-2xl font-bold">{total}</div>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            Alta confianza
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-400">{highConf}</div>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Prob. promedio
          </div>
          <div className="font-mono text-2xl font-bold text-primary">{avgProb}%</div>
        </div>
      </div>

      {/* Cards grid */}
      {total === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Star className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Sin partidos recomendados disponibles ahora mismo.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              El modelo detecta nuevas oportunidades cada 10 minutos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {matchGroups.map(({ match, bets: groupBets, injuries }) => {
            const m      = match as any;
            const topBet = groupBets[0];
            const kof    = m?.kickoff ? formatKickoff(m.kickoff) : null;
            const home   = m?.home_team;
            const away   = m?.away_team;
            const conf   = (topBet?.confidence ?? "low") as "high" | "medium" | "low";
            const prob   = Number(topBet?.model_prob ?? 0) * 100;
            const isHigh = conf === "high";

            return (
              <Link
                key={m.id}
                href={`/partido/${m.id}`}
                className="group block rounded-2xl border border-border/50 bg-card/60 p-5 transition-all hover:border-primary/40 hover:bg-card hover:shadow-md"
              >
                {/* Liga */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {m?.league?.logo_url && (
                      <Image
                        src={m.league.logo_url}
                        alt={m.league.name ?? ""}
                        width={14}
                        height={14}
                        className="object-contain"
                      />
                    )}
                    <span>{m?.league?.name ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {injuries > 0 && (
                      <span
                        className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400"
                        title={`${injuries} jugadores en duda/baja`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {injuries} baja{injuries !== 1 ? "s" : ""}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </div>

                {/* Equipos */}
                <div className="mb-4 flex items-center justify-between gap-3">
                  <TeamBlock team={home} />
                  <div className="text-center">
                    {kof && (
                      <>
                        <div className="text-xs font-semibold text-muted-foreground">
                          {kof.date}
                        </div>
                        <div className="font-mono text-lg font-bold">{kof.time}</div>
                      </>
                    )}
                  </div>
                  <TeamBlock team={away} reverse />
                </div>

                {/* Apuesta top */}
                <div
                  className={cn(
                    "rounded-xl border p-3",
                    isHigh
                      ? "border-emerald-500/25 bg-emerald-500/8"
                      : "border-amber-500/20 bg-amber-500/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] shrink-0", CONF_STYLES[conf])}
                        >
                          {CONF_LABELS[conf]} confianza
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {MARKET_LABELS[topBet?.market ?? ""] ?? topBet?.market} ·{" "}
                          {SELECTION_LABELS[topBet?.selection ?? ""] ?? topBet?.selection}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground/80 italic line-clamp-2">
                        {topBet?.reasoning}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={cn(
                          "font-mono text-2xl font-black tabular-nums",
                          isHigh ? "text-emerald-400" : "text-amber-400",
                        )}
                      >
                        {prob.toFixed(0)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">prob.</div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Cuota{" "}
                      <strong className="font-mono font-bold text-foreground">
                        {Number(topBet?.price ?? 0).toFixed(2)}
                      </strong>
                    </span>
                    <span
                      className={cn(
                        "font-mono font-bold",
                        isHigh ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      Edge +{(Number(topBet?.edge ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>

                  {groupBets.length > 1 && (
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      +{groupBets.length - 1} apuesta{groupBets.length > 2 ? "s" : ""} más en este partido
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Premium upsell */}
      {!isPremium && total > 0 && (
        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center">
          <Lock className="mx-auto mb-2 h-5 w-5 text-amber-400" />
          <p className="text-sm font-semibold text-amber-300">
            Accede a todos los partidos recomendados con Premium
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Los usuarios premium ven todas las oportunidades de confianza media y alta con el análisis completo.
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

function TeamBlock({
  team,
  reverse = false,
}: {
  team: { name: string; short_name?: string; logo_url?: string } | null;
  reverse?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center gap-2",
        reverse ? "flex-row-reverse text-right" : "text-left",
      )}
    >
      {team?.logo_url ? (
        <Image
          src={team.logo_url}
          alt={team.name}
          width={36}
          height={36}
          className="shrink-0 object-contain"
        />
      ) : (
        <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
      )}
      <span className="text-sm font-semibold leading-tight">
        {team?.short_name ?? team?.name ?? "—"}
      </span>
    </div>
  );
}
