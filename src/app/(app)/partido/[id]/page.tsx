import { notFound } from "next/navigation";
import Image from "next/image";
import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, MapPin, Flag, Newspaper, Activity, Users, AlertTriangle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { OddsTable } from "@/components/match/odds-table";
import { ValueBetAlert } from "@/components/match/value-bet-alert";
import { cn } from "@/lib/utils/cn";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

// ─── Metadata SEO ──────────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select(
      "kickoff, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name), league:leagues(name)",
    )
    .eq("id", id)
    .single();

  if (!match) return { title: "Partido no encontrado · ApuestaValue" };

  const home = (match as any).home_team?.name ?? "";
  const away = (match as any).away_team?.name ?? "";
  const league = (match as any).league?.name ?? "";

  const title = `${home} vs ${away} — Cuotas, Pronóstico y Value Bets`;
  const description = `Compara cuotas de ${home} vs ${away} (${league}) entre Betplay, Wplay, Codere, Rivalo y más. Análisis estadístico, value bets y predicción matemática.`;

  return {
    title,
    description,
    keywords: [home, away, league, "cuotas", "pronóstico", "apuestas", "value bet", "Colombia"],
    alternates: { canonical: `/partido/${id}` },
    openGraph: {
      title,
      description,
      type: "article",
      locale: "es_CO",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

// ─── Página ────────────────────────────────────────────────────
export default async function MatchDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [matchRes, oddsRes, valueBetsRes, injuriesRes, newsRes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), league:leagues(*)",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("odds")
      .select("*, bookmaker:bookmakers(*)")
      .eq("match_id", id)
      .order("price", { ascending: false }),
    supabase
      .from("value_bets")
      .select("*, bookmaker:bookmakers(*)")
      .eq("match_id", id)
      .eq("result", "pending")
      .order("edge", { ascending: false })
      .limit(3),
    supabase.from("injuries").select("*").eq("match_id", id),
    supabase
      .from("news")
      .select("*")
      .eq("related_match_id", id)
      .order("published_at", { ascending: false })
      .limit(5),
  ]);

  const match = matchRes.data;
  if (!match) notFound();

  const odds = oddsRes.data ?? [];
  const valueBets = valueBetsRes.data ?? [];
  const injuries = injuriesRes.data ?? [];
  const news = newsRes.data ?? [];

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const kickoffDate = new Date(match.kickoff);
  const timeUntilKickoff = !isLive && !isFinished ? formatDistanceToNowStrict(kickoffDate, { locale: es, addSuffix: false }) : null;

  // Contar bookmakers únicos
  const uniqueBooks = new Set(odds.map((o: any) => o.bookmaker_id)).size;

  // JSON-LD SportsEvent para Google rich results
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${match.home_team.name} vs ${match.away_team.name}`,
    startDate: match.kickoff,
    sport: "Soccer",
    location: { "@type": "Place", name: match.venue ?? match.league.country },
    homeTeam: { "@type": "SportsTeam", name: match.home_team.name, logo: match.home_team.logo_url },
    awayTeam: { "@type": "SportsTeam", name: match.away_team.name, logo: match.away_team.logo_url },
    eventStatus:
      isLive ? "https://schema.org/EventScheduled" :
      isFinished ? "https://schema.org/EventCompleted" :
      "https://schema.org/EventScheduled",
  };

  // Determinar ganador para resaltar
  const homeWon = isFinished && (match.home_score ?? 0) > (match.away_score ?? 0);
  const awayWon = isFinished && (match.away_score ?? 0) > (match.home_score ?? 0);

  return (
    <div className="container max-w-6xl py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          {match.league.logo_url && (
            <Image
              src={match.league.logo_url}
              alt={match.league.name}
              width={20}
              height={20}
            />
          )}
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {match.league.name}
          </span>
          {match.round && (
            <span className="text-xs text-muted-foreground">· {match.round}</span>
          )}
          {isLive && (
            <Badge variant="live" className="ml-auto">
              EN VIVO · {match.minute ?? 0}&apos;
            </Badge>
          )}
        </div>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 p-6 md:gap-6 md:p-8">
            <TeamBlock
              name={match.home_team.name}
              logo={match.home_team.logo_url}
              align="right"
              dimmed={isFinished && !homeWon}
            />
            <div className="text-center">
              {match.status === "scheduled" ? (
                <>
                  <div className="font-display text-3xl font-bold tabular-nums md:text-4xl">
                    {format(kickoffDate, "HH:mm")}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {format(kickoffDate, "EEE d MMM", { locale: es })}
                  </div>
                  {timeUntilKickoff && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-value/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-value ring-1 ring-value/30">
                      <Clock className="h-3 w-3" />
                      en {timeUntilKickoff}
                    </div>
                  )}
                </>
              ) : (
                <div className="font-display text-4xl font-bold tabular-nums md:text-5xl">
                  <span className={cn(!homeWon && isFinished && "text-muted-foreground")}>
                    {match.home_score ?? 0}
                  </span>
                  <span className="mx-2 text-muted-foreground">-</span>
                  <span className={cn(!awayWon && isFinished && "text-muted-foreground")}>
                    {match.away_score ?? 0}
                  </span>
                </div>
              )}
            </div>
            <TeamBlock
              name={match.away_team.name}
              logo={match.away_team.logo_url}
              align="left"
              dimmed={isFinished && !awayWon}
            />
          </div>

          {(match.venue || match.referee) && (
            <div className="border-t border-border/40 bg-muted/20 px-5 py-3">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {match.venue && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {match.venue}
                  </span>
                )}
                {match.referee && (
                  <span className="flex items-center gap-1">
                    <Flag className="h-3 w-3" /> {match.referee}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(kickoffDate, "PPP", { locale: es })}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Value Bets — destacadas arriba */}
      {valueBets.length > 0 && (
        <div className="mb-6 space-y-3">
          {valueBets.map((vb: any) => (
            <ValueBetAlert key={vb.id} valueBet={vb} matchId={match.id} />
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="odds" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="odds" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Cuotas
            {uniqueBooks > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                {uniqueBooks}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Estadísticas
          </TabsTrigger>
          <TabsTrigger value="lineups" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Alineaciones
          </TabsTrigger>
          <TabsTrigger value="injuries" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Bajas
            {injuries.length > 0 && (
              <span className="ml-1 rounded-full bg-destructive/20 px-1.5 py-0.5 text-[10px] tabular-nums text-destructive">
                {injuries.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="news" className="gap-1.5">
            <Newspaper className="h-3.5 w-3.5" />
            Noticias
            {news.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                {news.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="odds" className="space-y-4">
          {odds.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8" />}
              title="Sin cuotas disponibles"
              desc="Las cuotas para este partido se publican normalmente 48 horas antes del kickoff."
            />
          ) : (
            <>
              <OddsTable
                matchId={match.id}
                market="1x2"
                marketLabel="Resultado final (1X2)"
                selections={[
                  { key: "home", label: "Local" },
                  { key: "draw", label: "Empate" },
                  { key: "away", label: "Visita" },
                ]}
                odds={odds as any}
              />
              <OddsTable
                matchId={match.id}
                market="over_under_2_5"
                marketLabel="Más / Menos 2.5 goles"
                selections={[
                  { key: "over", label: "Más 2.5" },
                  { key: "under", label: "Menos 2.5" },
                ]}
                odds={odds as any}
              />
              <OddsTable
                matchId={match.id}
                market="btts"
                marketLabel="Ambos equipos marcan (BTTS)"
                selections={[
                  { key: "yes", label: "Sí" },
                  { key: "no", label: "No" },
                ]}
                odds={odds as any}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="stats">
          <EmptyState
            icon={<Activity className="h-8 w-8" />}
            title="Estadísticas próximamente"
            desc="xG, posesión, tiros y mapas de calor disponibles tras el partido."
          />
        </TabsContent>

        <TabsContent value="lineups">
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Alineaciones por confirmar"
            desc="Los equipos titulares se publican aproximadamente 1 hora antes del kickoff."
          />
        </TabsContent>

        <TabsContent value="injuries">
          {injuries.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8" />}
              title="Sin bajas reportadas"
              desc="Ambos equipos llegan con plantilla completa, hasta donde sabemos."
            />
          ) : (
            <Card className="divide-y divide-border/40">
              {injuries.map((inj: any) => (
                <div key={inj.id} className="flex items-center gap-3 p-4">
                  <Badge
                    variant={inj.reason === "suspension" ? "destructive" : "outline"}
                  >
                    {inj.reason === "suspension" ? "Sancionado" : "Lesionado"}
                  </Badge>
                  <span className="font-semibold">{inj.player_name}</span>
                  {inj.detail && (
                    <span className="text-sm text-muted-foreground">— {inj.detail}</span>
                  )}
                </div>
              ))}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="news">
          {news.length === 0 ? (
            <EmptyState
              icon={<Newspaper className="h-8 w-8" />}
              title="Sin noticias relacionadas"
              desc="Cuando aparezcan noticias relevantes sobre este partido las verás aquí."
            />
          ) : (
            <div className="space-y-3">
              {news.map((n: any) => (
                <a
                  key={n.id}
                  href={n.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card className="p-4 transition-colors hover:bg-muted/30">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {n.source}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(n.published_at), "d MMM HH:mm", { locale: es })}
                      </span>
                    </div>
                    <h4 className="font-semibold leading-snug">{n.title}</h4>
                    {n.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {n.summary}
                      </p>
                    )}
                  </Card>
                </a>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Subcomponentes ────────────────────────────────────────────
function TeamBlock({
  name,
  logo,
  align,
  dimmed = false,
}: {
  name: string;
  logo?: string | null;
  align: "left" | "right";
  dimmed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 md:gap-4",
        align === "right" && "flex-row-reverse text-right",
        dimmed && "opacity-50",
      )}
    >
      {logo ? (
        <Image
          src={logo}
          alt={name}
          width={72}
          height={72}
          className="h-14 w-14 object-contain md:h-[72px] md:w-[72px]"
        />
      ) : (
        <div className="h-14 w-14 rounded-full bg-muted md:h-[72px] md:w-[72px]" />
      )}
      <h2 className="font-display text-lg font-bold leading-tight tracking-tight md:text-2xl">
        {name}
      </h2>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Card className="p-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{desc}</p>
    </Card>
  );
}