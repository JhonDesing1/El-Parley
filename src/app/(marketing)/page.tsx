import { Hero } from "@/components/home/hero";
import { LiveTicker } from "@/components/home/live-ticker";
import { MatchCard } from "@/components/match/match-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, TrendingUp, Trophy } from "lucide-react";

export const revalidate = 300;

export default async function HomePage() {
  const supabase = await createClient();

  // Próximos partidos
  const { data: matchesRaw } = await supabase
    .from("matches")
    .select(
      `
      *,
      home_team:teams!home_team_id(*),
      away_team:teams!away_team_id(*),
      league:leagues(*)
      `,
    )
    .gte("kickoff", new Date().toISOString())
    .lte("kickoff", new Date(Date.now() + 48 * 3600 * 1000).toISOString())
    .order("kickoff", { ascending: true })
    .limit(12);

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
    has_value_bet: false,
  }));

  return (
    <>
      <Hero />
      <LiveTicker />

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
          />
          <FeatureCard
            icon={<TrendingUp className="h-6 w-6" />}
            title="Comparador multi-casa"
            desc="Las mejores cuotas de Betplay, Wplay, Codere, Rivalo y más en una sola vista."
          />
          <FeatureCard
            icon={<Trophy className="h-6 w-6" />}
            title="Parlays de alta probabilidad"
            desc="Combinadas seleccionadas algorítmicamente con EV positivo y stake óptimo (Kelly)."
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
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Card className="p-6">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-value/10 text-value ring-1 ring-value/20">
        {icon}
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Card>
  );
}