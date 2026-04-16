import { Hero } from "@/components/home/hero";
import { LiveTicker } from "@/components/home/live-ticker";
import { MatchCard } from "@/components/match/match-card";
import { ValueBetAlert, LockedValueBetCard } from "@/components/match/value-bet-alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, TrendingUp, Trophy } from "lucide-react";

export const revalidate = 900;

export default async function HomePage() {
  const supabase = await createClient();

  const now = new Date().toISOString();
  const in48h = new Date(new Date().getTime() + 48 * 3600 * 1000).toISOString();

  // Próximos partidos + flag has_value_bet desde la tabla value_bets
  const [{ data: matchesRaw }, { data: valueBetsRaw }] = await Promise.all([
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

    supabase
      .from("value_bets")
      .select(
        `
        id, match_id, market, selection, price, edge, model_prob,
        kelly_fraction, confidence, reasoning, is_premium,
        bookmaker:bookmakers(id, slug, name, logo_url, affiliate_url),
        match:matches(kickoff, home_team:teams!home_team_id(id,name,short_name,logo_url), away_team:teams!away_team_id(id,name,short_name,logo_url), league:leagues(id,name,slug,country,logo_url,flag_url))
        `,
      )
      .eq("result", "pending")
      .gte("edge", 0.03)
      .order("edge", { ascending: false })
      .limit(20),
  ]);

  // Conjunto de match_ids con al menos un value bet
  const matchIdsWithValue = new Set(
    (valueBetsRaw ?? []).map((vb: any) => vb.match_id),
  );

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

  const allValueBets = valueBetsRaw ?? [];
  // Free bets: visibles para todos (máx 6)
  const freeValueBets = allValueBets.filter((vb: any) => !vb.is_premium).slice(0, 6);
  // Premium teasers: hasta 3 cards bloqueadas para incentivar conversión
  const premiumTeasers = allValueBets.filter((vb: any) => vb.is_premium).slice(0, 3);

  return (
    <>
      <Hero />
      <LiveTicker />

      {(freeValueBets.length > 0 || premiumTeasers.length > 0) && (
        <section className="container py-12">
          <header className="mb-6">
            <Badge variant="value" className="mb-2">
              <Sparkles className="mr-1 h-3 w-3" />
              VALUE BETS DETECTADAS
            </Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Apuestas de valor ahora
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Edge ≥3% detectado por modelo Poisson. Actualizado cada 15 min.
            </p>
          </header>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {freeValueBets.map((vb: any) => (
              <ValueBetAlert
                key={vb.id}
                valueBet={vb}
                matchId={vb.match_id}
                match={vb.match}
              />
            ))}
            {premiumTeasers.map((vb: any) => (
              <LockedValueBetCard key={vb.id} match={vb.match} />
            ))}
          </div>
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
            title="Value Bets matemáticas"
            desc="Edge ≥3% detectado por modelo Poisson + xG. Sin tipsters, solo estadística."
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