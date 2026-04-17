import { Hero } from "@/components/home/hero";
import { LiveTicker } from "@/components/home/live-ticker";
import { MatchCard } from "@/components/match/match-card";
import { ValueBetAlert, LockedValueBetCard } from "@/components/match/value-bet-alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, TrendingUp, Trophy, Lock, ArrowRight, Target, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

export const revalidate = 900;

export default async function HomePage() {
  const supabase = await createClient();

  const now = new Date().toISOString();
  const in48h = new Date(new Date().getTime() + 48 * 3600 * 1000).toISOString();

  const betSelect = `
    id, match_id, market, selection, price, edge, model_prob,
    kelly_fraction, confidence, reasoning, is_premium,
    bookmaker:bookmakers(id, slug, name, logo_url, affiliate_url),
    match:matches(kickoff, home_team:teams!home_team_id(id,name,short_name,logo_url), away_team:teams!away_team_id(id,name,short_name,logo_url), league:leagues(id,name,slug,country,logo_url,flag_url))
  `;

  // Próximos partidos + bets gratuitas (media/baja confianza) + teasers premium (alta confianza)
  const [{ data: matchesRaw }, { data: freeBetsRaw }, { data: premiumBetsRaw }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        `
        *,
        home_team:teams!home_team_id(*),
        away_team:teams!away_team_id(*),
        league:leagues(*)
        `,
      )
      .gte("kickoff", now)
      .lte("kickoff", in48h)
      .order("kickoff", { ascending: true })
      .limit(12),

    // Bets gratuitas: confianza media/baja — las muestra la plataforma gratis (55% acierto)
    supabase
      .from("value_bets")
      .select(betSelect)
      .eq("result", "pending")
      .in("confidence", ["medium", "low"])
      .order("edge", { ascending: false })
      .limit(3),

    // Bets premium: alta confianza (edge ≥ 8% + modelProb ≥ 40%) — bloqueadas (60% acierto)
    supabase
      .from("value_bets")
      .select(betSelect)
      .eq("result", "pending")
      .eq("confidence", "high")
      .order("edge", { ascending: false })
      .limit(3),
  ]);

  const allBets = [...(freeBetsRaw ?? []), ...(premiumBetsRaw ?? [])];
  const matchIdsWithValue = new Set(allBets.map((vb: any) => vb.match_id));

  const matches = (matchesRaw ?? []).map((m: any) => ({
    id: m.id,
    league: m.league,
    home_team: m.home_team,
    away_team: m.away_team,
    kickoff: m.kickoff,
    status: m.status,
    minute: m.minute,
    home_score: m.home_score,
    away_score: m.away_score,
    has_value_bet: matchIdsWithValue.has(m.id),
  }));

  const freeValueBets = freeBetsRaw ?? [];
  const premiumTeasers = premiumBetsRaw ?? [];
  const hasAnyBets = freeValueBets.length > 0 || premiumTeasers.length > 0;

  return (
    <>
      <Hero />
      <LiveTicker />

      {hasAnyBets && (
        <section className="container py-12">
          <header className="mb-8">
            <Badge variant="value" className="mb-2">
              <Sparkles className="mr-1 h-3 w-3" />
              VALUE BETS DETECTADAS HOY
            </Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Apuestas con valor matemático
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nuestro modelo Poisson + xG detecta cuotas mal valoradas por las casas. Sin corazonadas, solo estadística.
            </p>
          </header>

          {/* ── BETS GRATUITAS ── */}
          {freeValueBets.length > 0 && (
            <div className="mb-10">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Picks gratuitos</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                  <Target className="h-3 w-3 text-amber-400" />
                  0.55 cuotas acertadas
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {freeValueBets.map((vb: any) => (
                  <ValueBetAlert
                    key={vb.id}
                    valueBet={vb}
                    matchId={vb.match_id}
                    match={vb.match}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── BANNER PREMIUM ── */}
          {premiumTeasers.length > 0 && (
            <>
              <div className="relative mb-6 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-8">
                {/* Glow de fondo */}
                <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-8 left-1/3 h-40 w-40 rounded-full bg-value/15 blur-2xl" />

                <div className="relative grid gap-6 md:grid-cols-2 md:items-center">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                      <Zap className="h-3 w-3" />
                      Premium — Alta confianza
                    </div>
                    <h3 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                      Los picks que{" "}
                      <span className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
                        realmente mueven la aguja
                      </span>
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Los apostadores que van en serio no apuestan a lo que todo el mundo ve.
                      Nuestras selecciones de alta confianza tienen edge ≥8% — las casas no las ven venir.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="font-bold text-emerald-400">0.60</span>
                        <span className="text-muted-foreground">cuotas acertadas</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-xs">
                        <Target className="h-3.5 w-3.5 text-primary" />
                        <span className="font-bold text-primary">Edge ≥8%</span>
                        <span className="text-muted-foreground">por selección</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-muted-foreground">Alertas Telegram en tiempo real</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 md:items-end">
                    <div className="w-full rounded-xl border border-primary/20 bg-background/60 p-4 backdrop-blur-sm md:max-w-xs">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Diferencia real</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center">
                          <div className="font-mono text-2xl font-bold text-muted-foreground">0.55</div>
                          <div className="text-[10px] text-muted-foreground">Plan Gratis</div>
                        </div>
                        <div className="text-center">
                          <div className="font-mono text-2xl font-bold text-emerald-400">0.60</div>
                          <div className="text-[10px] font-semibold text-primary">Premium</div>
                        </div>
                      </div>
                      <div className="mt-2 text-center text-[10px] text-muted-foreground">
                        0.05 extra en cuotas acertadas = ROI hasta 3× mayor a largo plazo
                      </div>
                    </div>
                    <Button asChild size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 md:max-w-xs">
                      <Link href="/premium">
                        Ver planes Premium
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <p className="text-center text-[10px] text-muted-foreground md:text-right">
                      Desde $10.000 COP/mes · Cancela cuando quieras
                    </p>
                  </div>
                </div>
              </div>

              {/* Cards premium bloqueadas */}
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Picks premium</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                  <ShieldCheck className="h-3 w-3" />
                  0.60 cuotas acertadas · Alta confianza
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Solo para suscriptores
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {premiumTeasers.map((vb: any) => (
                  <LockedValueBetCard key={vb.id} match={vb.match} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <section className="container py-12">
        <header className="mb-6 flex items-end justify-between">
          <div>
            <Badge variant="value" className="mb-2">
              <Sparkles className="mr-1 h-3 w-3" />
              PRÓXIMOS PARTIDOS
            </Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Hoy y mañana
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Análisis matemático y comparador de cuotas en tiempo real
            </p>
          </div>
        </header>

        {matches.length === 0 ? (
          <Card className="p-12 text-center">
            <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-display text-xl font-bold">Sin partidos cargados</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Configura tu API key de API-Football y corre el cron de sincronización
              para poblar la base de datos con fixtures reales.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match as any} />
            ))}
          </div>
        )}
      </section>

      <section className="container py-12">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<Sparkles className="h-6 w-6" />}
            title="Value Bets de alta confianza"
            desc="Solo selecciones con edge ≥8% validadas por modelo Poisson + xG. Sin tipsters, solo estadística."
            color="gold"
          />
          <FeatureCard
            icon={<TrendingUp className="h-6 w-6" />}
            title="Comparador multi-casa"
            desc="Las mejores cuotas de Betplay, Wplay, Codere, Rivalo y más en una sola vista."
            color="emerald"
          />
          <FeatureCard
            icon={<Trophy className="h-6 w-6" />}
            title="Parlays de alta probabilidad"
            desc="Combinadas seleccionadas algorítmicamente con EV positivo y stake óptimo (Kelly)."
            color="gold"
          />
        </div>
      </section>
    </>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  color = "gold",
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color?: "gold" | "emerald";
}) {
  const isGold = color === "gold";
  return (
    <Card className="group relative overflow-hidden p-6 transition-all hover:border-primary/30">
      {/* Glow sutil al hover */}
      <div
        className={`absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${
          isGold ? "bg-money-gradient" : ""
        }`}
      />
      <div
        className={`relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${
          isGold
            ? "bg-primary/10 text-primary ring-primary/25"
            : "bg-value/10 text-value ring-value/25"
        }`}
      >
        {icon}
      </div>
      <h3 className="relative font-display text-lg font-bold">{title}</h3>
      <p className="relative mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </Card>
  );
}