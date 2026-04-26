import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Search,
  Info,
  CalendarClock,
  MapPin,
  TrendingUp,
  Target,
  Trophy,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { calculateMatchProbabilities } from "@/lib/betting/poisson";
import {
  fetchNextFixtureForTeam,
  fetchPredictionsForFixture,
  fetchTeamByName,
} from "@/lib/api/api-football";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Análisis por equipo — El Parley",
  description:
    "Busca un equipo y obtén el análisis completo de su próximo partido: probabilidades, cuotas y apuesta sugerida.",
};

export const revalidate = 0;

type RawTeam = {
  id: number;
  name: string;
  short_name: string | null;
  country: string | null;
  logo_url: string | null;
};

type RawMatchRow = {
  id: number;
  kickoff: string;
  status: string;
  venue: string | null;
  model_expected_goals_home: number | null;
  model_expected_goals_away: number | null;
  home_team: RawTeam | RawTeam[] | null;
  away_team: RawTeam | RawTeam[] | null;
  league: {
    id: number;
    name: string;
    country: string | null;
    logo_url: string | null;
  } | null;
};

function normTeam(t: RawTeam | RawTeam[] | null | undefined): RawTeam | null {
  if (!t) return null;
  return Array.isArray(t) ? t[0] ?? null : t;
}

function formatPct(p: number) {
  // Nunca mostrar 100% — el fútbol siempre tiene varianza (rojas, lesiones, penales).
  const clamped = Math.min(0.99, Math.max(0.01, p));
  return `${Math.round(clamped * 100)}%`;
}

export default async function AnalisisPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; team?: string }>;
}) {
  const { q, team: teamParam } = await searchParams;
  const supabase = await createClient();
  const teamId = teamParam ? Number(teamParam) : NaN;
  const hasTeam = !isNaN(teamId);
  const query = (q ?? "").trim();

  // ── 1. Búsqueda por nombre ─────────────────────────────────────────────────
  // Dedup por (name+country): si hay dos filas con mismo nombre y país (legacy),
  // preferimos la que tiene partidos programados — ese es el ID correcto de API-Football.
  let searchResults: RawTeam[] = [];
  if (!hasTeam && query.length >= 2) {
    const { data } = await supabase
      .from("teams")
      .select("id, name, short_name, country, logo_url")
      .ilike("name", `%${query}%`)
      .order("name", { ascending: true })
      .limit(30);
    const rows = (data ?? []) as RawTeam[];

    // Conteo de matches futuros por team_id para priorizar duplicados buenos
    const ids = rows.map((r) => r.id);
    const matchCount = new Map<number, number>();
    if (ids.length) {
      const nowIso = new Date(new Date().getTime() - 3 * 3600 * 1000).toISOString();
      const { data: mRows } = await supabase
        .from("matches")
        .select("home_team_id, away_team_id")
        .gte("kickoff", nowIso)
        .in("status", ["scheduled", "live"])
        .or(
          `home_team_id.in.(${ids.join(",")}),away_team_id.in.(${ids.join(",")})`,
        );
      for (const m of mRows ?? []) {
        const h = (m as { home_team_id: number }).home_team_id;
        const a = (m as { away_team_id: number }).away_team_id;
        if (ids.includes(h)) matchCount.set(h, (matchCount.get(h) ?? 0) + 1);
        if (ids.includes(a)) matchCount.set(a, (matchCount.get(a) ?? 0) + 1);
      }
    }

    // Dedup: para cada (name lowercase, country) quedarnos con el row de más partidos
    const bestByKey = new Map<string, RawTeam>();
    for (const r of rows) {
      const key = `${r.name.toLowerCase()}::${r.country ?? ""}`;
      const cur = bestByKey.get(key);
      if (!cur) {
        bestByKey.set(key, r);
      } else {
        const curCount = matchCount.get(cur.id) ?? 0;
        const newCount = matchCount.get(r.id) ?? 0;
        if (newCount > curCount) bestByKey.set(key, r);
      }
    }

    // Orden final: primero los que tienen partidos, luego alfabético
    searchResults = [...bestByKey.values()]
      .sort((a, b) => {
        const ca = matchCount.get(a.id) ?? 0;
        const cb = matchCount.get(b.id) ?? 0;
        if (ca !== cb) return cb - ca;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  }

  // ── 2. Equipo seleccionado ──────────────────────────────────────────────────
  let selectedTeam: RawTeam | null = null;
  let nextMatch: RawMatchRow | null = null;
  // true si el fixture viene sólo de API-Football (aún no está en nuestra BD):
  // en ese caso no podemos linkear a /partido/:id porque devolvería 404
  let matchInDb = false;
  // Motivo por el que no hay próximo partido — diferenciamos entre
  // "API dice que no hay fixture" y "fallo de red / config".
  let noMatchReason: "empty" | "error" | null = null;
  let noMatchError: string | null = null;
  if (hasTeam) {
    const { data: teamRow } = await supabase
      .from("teams")
      .select("id, name, short_name, country, logo_url")
      .eq("id", teamId)
      .single();
    selectedTeam = (teamRow ?? null) as RawTeam | null;

    if (selectedTeam) {
      const { data: matchRow } = await supabase
        .from("matches")
        .select(
          `id, kickoff, status, venue,
           model_expected_goals_home, model_expected_goals_away,
           home_team:teams!home_team_id(id, name, short_name, logo_url),
           away_team:teams!away_team_id(id, name, short_name, logo_url),
           league:leagues(id, name, country, logo_url)`,
        )
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .in("status", ["scheduled", "live"])
        .gte("kickoff", new Date(new Date().getTime() - 3 * 3600 * 1000).toISOString())
        .order("kickoff", { ascending: true })
        .limit(1)
        .maybeSingle();
      nextMatch = (matchRow ?? null) as RawMatchRow | null;
      matchInDb = nextMatch != null;

      // Fallback: si la BD aún no tiene el fixture (liga fuera del cron),
      // lo pedimos a API-Football. Si el team_id de nuestra BD no coincide con
      // el de API-Football (filas legacy), hacemos búsqueda por nombre como
      // segundo intento — usa el ID correcto devuelto por API-Football.
      if (!nextMatch) {
        let result = await fetchNextFixtureForTeam(teamId);
        if (result.kind !== "ok" && selectedTeam) {
          const byName = await fetchTeamByName(
            selectedTeam.name,
            selectedTeam.country ?? undefined,
          );
          if (byName && byName.id !== teamId) {
            result = await fetchNextFixtureForTeam(byName.id);
          }
        }
        if (result.kind === "ok") {
          const af = result.fixture;
          matchInDb = false;
          const preds = await fetchPredictionsForFixture(af.id, af.leagueId);
          nextMatch = {
            id: af.id,
            kickoff: af.kickoff,
            status: af.status,
            venue: af.venue,
            model_expected_goals_home: preds?.homeXg ?? null,
            model_expected_goals_away: preds?.awayXg ?? null,
            home_team: {
              id: af.home.id,
              name: af.home.name,
              short_name: null,
              country: null,
              logo_url: af.home.logo,
            },
            away_team: {
              id: af.away.id,
              name: af.away.name,
              short_name: null,
              country: null,
              logo_url: af.away.logo,
            },
            league: {
              id: af.leagueId,
              name: af.leagueName,
              country: af.leagueCountry,
              logo_url: af.leagueLogo,
            },
          };
        } else if (result.kind === "empty") {
          noMatchReason = "empty";
        } else {
          noMatchReason = "error";
          noMatchError = result.reason;
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      {/* ── Header + formulario de búsqueda ──────────────────────────────── */}
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Análisis por equipo
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Busca tu equipo favorito y obtén el análisis completo de su próximo
          partido: probabilidades, cuotas destacadas y apuesta sugerida.
        </p>
      </div>

      <form
        method="get"
        action="/analisis"
        className="mx-auto mb-8 flex max-w-xl items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="text"
            autoFocus={!hasTeam}
            defaultValue={query}
            placeholder="Ej: Real Madrid, Nacional, Liverpool..."
            className="w-full rounded-md border border-input bg-background py-2.5 pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <Button type="submit" size="sm">
          Buscar
        </Button>
      </form>

      {/* ── Resultados de búsqueda ────────────────────────────────────────── */}
      {!hasTeam && query.length >= 2 && (
        <SearchResults query={query} results={searchResults} />
      )}

      {/* ── Dashboard del equipo seleccionado ─────────────────────────────── */}
      {hasTeam && selectedTeam && (
        <TeamDashboard
          team={selectedTeam}
          nextMatch={nextMatch}
          matchInDb={matchInDb}
          noMatchReason={noMatchReason}
          noMatchError={noMatchError}
        />
      )}

      {hasTeam && !selectedTeam && <NotCoveredFallback />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Componentes auxiliares
// ══════════════════════════════════════════════════════════════════════════════

function SearchResults({ query, results }: { query: string; results: RawTeam[] }) {
  if (results.length === 0) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Info className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">Sin resultados</p>
            <p className="mt-1 text-sm text-muted-foreground">
              En este momento no tenemos información de la liga en la que
              participa <span className="font-medium">{query}</span>. Prueba
              con otro equipo.
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cubrimos las principales ligas del mundo: Premier League, La Liga,
            Serie A, Bundesliga, Ligue 1, Champions/Europa League, Copa
            Libertadores y Liga BetPlay.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {results.length} {results.length === 1 ? "equipo" : "equipos"}{" "}
        encontrado{results.length === 1 ? "" : "s"}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {results.map((t) => (
          <Link
            key={t.id}
            href={`/analisis?team=${t.id}`}
            className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5 transition-all hover:border-primary/50 hover:bg-muted/40"
          >
            {t.logo_url ? (
              <Image
                src={t.logo_url}
                alt={t.name}
                width={32}
                height={32}
                sizes="32px"
                className="shrink-0 rounded"
              />
            ) : (
              <div className="h-8 w-8 shrink-0 rounded bg-muted" />
            )}
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{t.name}</span>
              {t.country && (
                <span className="truncate text-[11px] text-muted-foreground">
                  {t.country}
                </span>
              )}
            </div>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function NotCoveredFallback() {
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Info className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-semibold">Equipo no disponible</p>
        <p className="text-sm text-muted-foreground">
          En este momento no tenemos información de la liga en la que participa
          tu equipo. Prueba con otro.
        </p>
      </CardContent>
    </Card>
  );
}

function TeamDashboard({
  team,
  nextMatch,
  matchInDb,
  noMatchReason,
  noMatchError,
}: {
  team: RawTeam;
  nextMatch: RawMatchRow | null;
  matchInDb: boolean;
  noMatchReason: "empty" | "error" | null;
  noMatchError: string | null;
}) {
  return (
    <div className="space-y-6">
      {/* Team header */}
      <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-card px-5 py-4">
        {team.logo_url ? (
          <Image
            src={team.logo_url}
            alt={team.name}
            width={56}
            height={56}
            sizes="56px"
            className="shrink-0 rounded"
          />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded bg-muted" />
        )}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Análisis
          </p>
          <h2 className="font-display text-2xl font-bold">{team.name}</h2>
        </div>
        <div className="ml-auto">
          <Button asChild variant="outline" size="sm">
            <Link href="/analisis">Cambiar equipo</Link>
          </Button>
        </div>
      </div>

      {nextMatch ? (
        <NextMatchAnalysis match={nextMatch} teamId={team.id} matchInDb={matchInDb} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground" />
            {noMatchReason === "error" ? (
              <>
                <p className="font-semibold">
                  {(() => {
                    const e = (noMatchError ?? "").toLowerCase();
                    if (e.includes("api_football_key") || e.includes("no configurada")) {
                      return "API-Football no está configurada";
                    }
                    if (e.includes("daily limit") || e.includes("requests") || e.includes("429")) {
                      return "Cupo diario de API-Football agotado";
                    }
                    if (e.includes("timeout") || e.includes("aborterror")) {
                      return "API-Football tardó demasiado en responder";
                    }
                    return "No pudimos consultar API-Football";
                  })()}
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {(() => {
                    const e = (noMatchError ?? "").toLowerCase();
                    if (e.includes("api_football_key") || e.includes("no configurada")) {
                      return "Falta la variable de entorno en Vercel. Una vez configurada, el análisis funcionará automáticamente.";
                    }
                    if (e.includes("daily limit") || e.includes("requests") || e.includes("429")) {
                      return "Hemos alcanzado el límite de consultas diarias del plan gratuito. Se restablecerá mañana.";
                    }
                    return "Intenta de nuevo en unos minutos. El servicio de datos responde lento temporalmente.";
                  })()}
                </p>
                {noMatchError && (
                  <p className="mt-1 max-w-md text-[11px] text-muted-foreground/70">
                    Detalle: {noMatchError}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold">Sin partidos programados</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  API-Football no tiene un próximo fixture confirmado para{" "}
                  {team.name} en este momento. Las ligas publican el calendario
                  semanas antes, vuelve a intentarlo en unos días.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NextMatchAnalysis({
  match,
  teamId,
  matchInDb,
}: {
  match: RawMatchRow;
  teamId: number;
  matchInDb: boolean;
}) {
  const home = normTeam(match.home_team);
  const away = normTeam(match.away_team);
  const league = match.league;
  const homeXg = match.model_expected_goals_home;
  const awayXg = match.model_expected_goals_away;
  const isHome = home?.id === teamId;
  const ourTeam = isHome ? home : away;
  const rival = isHome ? away : home;

  const probs =
    homeXg != null && awayXg != null
      ? calculateMatchProbabilities(homeXg, awayXg)
      : null;

  // Highlight de las apuestas más probables
  type Highlight = {
    market: string;
    selection: string;
    probability: number;
    reasoning: string;
  };
  const highlights: Highlight[] = [];
  if (probs) {
    const outcomes: Highlight[] = [
      {
        market: "Resultado",
        selection: `${home?.name ?? "Local"} gana`,
        probability: probs.home,
        reasoning: `xG modelado: ${homeXg?.toFixed(2)} vs ${awayXg?.toFixed(2)}`,
      },
      {
        market: "Resultado",
        selection: "Empate",
        probability: probs.draw,
        reasoning: "Fuerzas parejas según el modelo Poisson",
      },
      {
        market: "Resultado",
        selection: `${away?.name ?? "Visitante"} gana`,
        probability: probs.away,
        reasoning: `xG modelado: ${homeXg?.toFixed(2)} vs ${awayXg?.toFixed(2)}`,
      },
      {
        market: "Goles 2.5",
        selection: probs.over25 >= 0.5 ? "Más de 2.5 goles" : "Menos de 2.5 goles",
        probability: Math.max(probs.over25, probs.under25),
        reasoning: `Goles esperados totales: ${((homeXg ?? 0) + (awayXg ?? 0)).toFixed(2)}`,
      },
      {
        market: "Ambos anotan",
        selection: probs.btts >= 0.5 ? "Sí marcan ambos" : "No marcan ambos",
        probability: Math.max(probs.btts, probs.noBtts),
        reasoning: "Basado en la distribución de marcadores Poisson",
      },
      {
        market: "Doble oportunidad",
        selection:
          probs.dc1x >= probs.dcx2 && probs.dc1x >= probs.dc12
            ? `${home?.name ?? "Local"} o Empate`
            : probs.dcx2 >= probs.dc12
              ? `${away?.name ?? "Visitante"} o Empate`
              : `${home?.name ?? "Local"} o ${away?.name ?? "Visitante"}`,
        probability: Math.max(probs.dc1x, probs.dc12, probs.dcx2),
        reasoning: "Cobertura de dos resultados con mayor probabilidad",
      },
    ];
    highlights.push(
      ...outcomes.sort((a, b) => b.probability - a.probability).slice(0, 3),
    );
  }

  return (
    <div className="space-y-5">
      {/* Match card */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/40 bg-muted/20 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {league?.logo_url && (
                <Image
                  src={league.logo_url}
                  alt={league.name}
                  width={18}
                  height={18}
                  sizes="18px"
                  className="rounded"
                />
              )}
              <CardTitle className="text-sm font-semibold">
                {league?.name ?? "Liga"}
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              Próximo partido
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="py-5">
          <div className="grid grid-cols-3 items-center gap-4">
            <TeamCell team={home} highlight={isHome} />
            <div className="text-center">
              <p className="font-mono text-xl font-bold text-muted-foreground">
                VS
              </p>
              <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                {format(new Date(match.kickoff), "d MMM · HH:mm", { locale: es })}
              </p>
              {match.venue && (
                <p className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{match.venue}</span>
                </p>
              )}
            </div>
            <TeamCell team={away} highlight={!isHome} />
          </div>
          {matchInDb && (
            <div className="mt-5 flex justify-center">
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link href={`/partido/${match.id}`}>
                  Ver análisis completo
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Probabilidades del modelo */}
      {probs ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                Probabilidades del modelo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <ProbRow
                label={`${home?.name ?? "Local"} gana`}
                value={probs.home}
              />
              <ProbRow label="Empate" value={probs.draw} />
              <ProbRow
                label={`${away?.name ?? "Visitante"} gana`}
                value={probs.away}
              />
              <div className="my-2 border-t border-border/40" />
              <ProbRow label="Más de 2.5 goles" value={probs.over25} />
              <ProbRow label="Ambos marcan" value={probs.btts} />
              <div className="mt-4 rounded-md bg-muted/40 p-3 text-xs">
                <span className="font-semibold">Marcador más probable: </span>
                <span className="font-mono">
                  {probs.mostLikelyScore.home}-{probs.mostLikelyScore.away}
                </span>{" "}
                <span className="text-muted-foreground">
                  ({formatPct(probs.mostLikelyScore.probability)})
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Apuestas destacadas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-value" />
                Resultados más probables
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {highlights.map((h, i) => (
                <div
                  key={`${h.market}-${h.selection}`}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    i === 0
                      ? "border-value/40 bg-value/5"
                      : "border-border/40 bg-muted/20"
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold ring-1 ring-border/50">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {h.market}
                      </Badge>
                      {i === 0 && (
                        <Badge variant="value" className="text-[10px]">
                          <Trophy className="mr-0.5 h-2.5 w-2.5" />
                          Top
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 font-semibold">{h.selection}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {h.reasoning}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-lg font-bold tabular-nums">
                      {formatPct(h.probability)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Probabilidad
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <Info className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-semibold">Modelo aún no disponible</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Estamos calculando los xG de este partido. Las probabilidades y
              apuestas sugeridas aparecerán en unos minutos.
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        Los análisis son estimaciones probabilísticas basadas en el modelo
        Poisson + xG. No garantizan resultados. 18+ Juega responsablemente.
      </p>
      {rival && <span className="hidden">{rival.name}</span>}
    </div>
  );
}

function TeamCell({
  team,
  highlight,
}: {
  team: RawTeam | null;
  highlight: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {team?.logo_url ? (
        <Image
          src={team.logo_url}
          alt={team.name}
          width={56}
          height={56}
          sizes="56px"
          className="rounded"
        />
      ) : (
        <div className="h-14 w-14 rounded bg-muted" />
      )}
      <p
        className={`text-sm font-semibold leading-tight ${
          highlight ? "text-primary" : ""
        }`}
      >
        {team?.name ?? "—"}
      </p>
    </div>
  );
}

function ProbRow({ label, value }: { label: string; value: number }) {
  const clamped = Math.min(0.99, Math.max(0.01, value));
  const pct = Math.round(clamped * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="font-mono font-bold tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
