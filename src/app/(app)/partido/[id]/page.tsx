import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft, ExternalLink, Lock, Sparkles, TrendingUp,
  Users, Newspaper, AlertTriangle, ShieldOff, Star,
  CheckCircle2, Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isPremiumUser } from "@/lib/utils/auth";
import { Badge } from "@/components/ui/badge";
import { buildAffiliateUrl } from "@/config/bookmakers";
import { cn } from "@/lib/utils/cn";
import type { Metadata } from "next";
import type { MatchLineups, LineupPlayer } from "@/lib/api/api-football";

export const revalidate = 300;

// ─── Metadata dinámica ──────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)")
    .eq("id", Number(id))
    .single();

  if (!match) return { title: "Partido — El Parley" };

  const home = (match.home_team as { name: string } | null)?.name ?? "";
  const away = (match.away_team as { name: string } | null)?.name ?? "";
  return {
    title: `${home} vs ${away} — El Parley`,
    description: `Alineaciones, lesiones, noticias y apuesta recomendada para ${home} vs ${away}.`,
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = Number(id);
  if (isNaN(matchId)) notFound();

  const [supabase, isPremium] = await Promise.all([createClient(), isPremiumUser()]);

  // Match principal
  const { data: match } = await supabase
    .from("matches")
    .select(
      `
      id, kickoff, status, minute, home_score, away_score, venue, referee,
      model_expected_goals_home, model_expected_goals_away, stats,
      home_team:teams!home_team_id(id, name, short_name, logo_url),
      away_team:teams!away_team_id(id, name, short_name, logo_url),
      league:leagues(id, name, country, logo_url)
      `,
    )
    .eq("id", matchId)
    .single();

  if (!match) notFound();

  // Parallel data fetch
  const [
    { data: valueBets },
    { data: odds },
    { data: parlayLegs },
    { data: injuries },
    { data: news },
  ] = await Promise.all([
    supabase
      .from("value_bets")
      .select("*, bookmaker:bookmakers(id, slug, name, logo_url, affiliate_url)")
      .eq("match_id", matchId)
      .eq("result", "pending")
      .order("model_prob", { ascending: false }),

    supabase
      .from("odds")
      .select("*, bookmaker:bookmakers(id, slug, name, logo_url, affiliate_url)")
      .eq("match_id", matchId)
      .in("market", ["1x2"])
      .order("bookmaker_id"),

    supabase
      .from("parlay_legs")
      .select(
        `id, market, selection, price,
         parlay:parlays(id, title, total_odds, total_probability, tier, status)`,
      )
      .eq("match_id", matchId),

    supabase
      .from("injuries")
      .select("id, player_name, player_photo, reason, type, detail, team_id, team:teams(id, name, logo_url)")
      .eq("match_id", matchId)
      .order("reason"),

    supabase
      .from("news")
      .select("id, title, summary, source_url, source, image_url, published_at")
      .eq("related_match_id", matchId)
      .order("published_at", { ascending: false })
      .limit(5),
  ]);

  const isLive     = match.status === "live";
  const isFinished = match.status === "finished";
  const homeTeam   = match.home_team as { id: number; name: string; short_name?: string; logo_url?: string } | null;
  const awayTeam   = match.away_team as { id: number; name: string; short_name?: string; logo_url?: string } | null;
  const league     = match.league  as { id: number; name: string; country: string; logo_url?: string } | null;

  // Lineups from matches.stats
  const stats    = (match.stats as { lineups?: MatchLineups } | null);
  const lineups  = stats?.lineups ?? null;

  const allBets = valueBets ?? [];
  const freeValueBets   = allBets.filter((v) => !v.is_premium);
  const premiumValueBets = allBets.filter((v) => v.is_premium);
  const visibleValueBets = isPremium ? allBets : freeValueBets;

  // Best bet = highest model_prob visible to this user
  const recommendedBet  = visibleValueBets[0] ?? null;

  // Injuries grouped by team
  const homeInjuries = (injuries ?? []).filter((i) => i.team_id === (homeTeam as any)?.id).map((i) => ({ ...i, reason: i.reason ?? "other" }));
  const awayInjuries = (injuries ?? []).filter((i) => i.team_id === (awayTeam as any)?.id).map((i) => ({ ...i, reason: i.reason ?? "other" }));
  const hasInjuries  = (injuries ?? []).length > 0;

  // Odds comparison
  const oddsByBookmaker: Record<
    string,
    { slug: string; name: string; affUrl: string; home?: number; draw?: number; away?: number }
  > = {};
  for (const o of odds ?? []) {
    const bm = o.bookmaker as { id: number; slug: string; name: string } | null;
    if (!bm) continue;
    if (!oddsByBookmaker[bm.slug]) {
      oddsByBookmaker[bm.slug] = { slug: bm.slug, name: bm.name, affUrl: buildAffiliateUrl(bm.slug) };
    }
    if (o.selection === "home") oddsByBookmaker[bm.slug].home = o.price;
    if (o.selection === "draw") oddsByBookmaker[bm.slug].draw = o.price;
    if (o.selection === "away") oddsByBookmaker[bm.slug].away = o.price;
  }
  const bookmakerRows = Object.values(oddsByBookmaker);

  // Parlays relacionados
  const relatedParlays = (parlayLegs ?? [])
    .map((leg) => leg.parlay as { id: string; title: string; total_odds: number; total_probability: number; tier: string; status: string } | null)
    .filter(Boolean)
    .filter((p, i, arr) => arr.findIndex((x) => x!.id === p!.id) === i);

  return (
    <div className="container max-w-4xl py-8">
      {/* Back */}
      <Link
        href="/value-bets"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Recomendados del día
      </Link>

      {/* ── 1. Header del partido ─────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-border/60 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          {league?.logo_url && (
            <Image src={league.logo_url} alt={league.name} width={18} height={18} className="object-contain" />
          )}
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {league?.name}
          </span>
          {isLive && <Badge variant="live">EN VIVO · {match.minute}&apos;</Badge>}
        </div>

        <div className="grid grid-cols-3 items-center gap-4">
          <TeamBlock team={homeTeam} align="left" />
          <div className="text-center">
            {isLive || isFinished ? (
              <div className="font-mono text-4xl font-black tabular-nums">
                {match.home_score ?? 0} <span className="text-muted-foreground">—</span> {match.away_score ?? 0}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="font-mono text-2xl font-bold text-muted-foreground">vs</div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(match.kickoff), "EEE d MMM · HH:mm", { locale: es })}
                </div>
              </div>
            )}
          </div>
          <TeamBlock team={awayTeam} align="right" />
        </div>

        {/* Meta */}
        {(match.venue || match.referee) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 pt-4 text-xs text-muted-foreground">
            {match.venue    && <span>🏟 {match.venue}</span>}
            {match.referee  && <span>🟨 Árbitro: {match.referee}</span>}
          </div>
        )}

        {/* xG del modelo */}
        {match.model_expected_goals_home != null && match.model_expected_goals_away != null && (
          <div className="mt-4 border-t border-border/40 pt-4">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Probabilidades del modelo (Poisson)
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <ProbCell label={homeTeam?.short_name ?? homeTeam?.name ?? "Local"}   xg={match.model_expected_goals_home} />
              <ProbCell label="Empate" />
              <ProbCell label={awayTeam?.short_name ?? awayTeam?.name ?? "Visitante"} xg={match.model_expected_goals_away} />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Apuesta recomendada ────────────────────────────────── */}
      {recommendedBet ? (
        <RecommendedBet bet={recommendedBet} homeTeam={homeTeam} awayTeam={awayTeam} />
      ) : !isPremium && premiumValueBets.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
          <Lock className="mx-auto mb-2 h-6 w-6 text-primary" />
          <p className="font-semibold">Apuesta recomendada — Premium</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hay {premiumValueBets.length} apuesta{premiumValueBets.length > 1 ? "s" : ""} de alta probabilidad disponible{premiumValueBets.length > 1 ? "s" : ""} para este partido.
          </p>
          <Link
            href="/premium"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Desbloquear con Premium
          </Link>
        </div>
      ) : null}

      {/* ── 3. Alineación probable ───────────────────────────────── */}
      <section className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Users className="h-5 w-5 text-primary" />
          Alineación probable
        </h2>

        {lineups ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <LineupCard team={homeTeam} lineup={lineups.home} />
            <LineupCard team={awayTeam} lineup={lineups.away} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 px-4 py-8 text-center">
            <Clock className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm font-semibold">Alineaciones pendientes de confirmación</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Los equipos publican sus titulares ~1 hora antes del pitazo inicial.
            </p>
          </div>
        )}
      </section>

      {/* ── 4. Bajas y suspensiones ──────────────────────────────── */}
      {hasInjuries && (
        <section className="mb-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Bajas, lesiones y suspensiones
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <InjuryColumn team={homeTeam} injuries={homeInjuries} />
            <InjuryColumn team={awayTeam} injuries={awayInjuries} />
          </div>
        </section>
      )}

      {/* ── 5. Noticias ──────────────────────────────────────────── */}
      {(news ?? []).length > 0 && (
        <section className="mb-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Newspaper className="h-5 w-5 text-primary" />
            Noticias recientes
          </h2>
          <div className="space-y-3">
            {(news ?? []).map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}

      {/* ── 6. Todas las value bets ──────────────────────────────── */}
      {allBets.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-primary" />
            Value bets detectadas
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {allBets.length}
            </span>
          </h2>

          {visibleValueBets.length === 0 && !isPremium && premiumValueBets.length > 0 && (
            <PremiumGate count={premiumValueBets.length} />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {visibleValueBets.map((vb) => {
              const bm = vb.bookmaker as { slug: string; name: string } | null;
              return (
                <ValueBetCard
                  key={vb.id}
                  market={vb.market}
                  selection={vb.selection}
                  price={vb.price}
                  edge={vb.edge}
                  modelProb={vb.model_prob}
                  confidence={vb.confidence ?? "low"}
                  reasoning={vb.reasoning ?? ""}
                  bookmakerName={bm?.name ?? ""}
                  bookmakerSlug={bm?.slug ?? ""}
                />
              );
            })}
            {!isPremium && premiumValueBets.map((vb) => (
              <LockedValueBetCard key={vb.id} />
            ))}
          </div>
        </section>
      )}

      {/* ── 7. Comparador de cuotas ──────────────────────────────── */}
      {bookmakerRows.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <TrendingUp className="h-5 w-5 text-primary" />
            Comparador de cuotas — 1X2
          </h2>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Casa</th>
                  <th className="px-4 py-3 text-center font-semibold">{homeTeam?.short_name ?? "1"}</th>
                  <th className="px-4 py-3 text-center font-semibold">X</th>
                  <th className="px-4 py-3 text-center font-semibold">{awayTeam?.short_name ?? "2"}</th>
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody>
                {bookmakerRows.map((row, i) => (
                  <tr
                    key={row.slug}
                    className={cn(
                      "border-b border-border/30 transition-colors hover:bg-muted/20 last:border-0",
                      i % 2 === 0 && "bg-background",
                    )}
                  >
                    <td className="px-4 py-3"><span className="font-medium">{row.name}</span></td>
                    <OddCell value={row.home} />
                    <OddCell value={row.draw} />
                    <OddCell value={row.away} />
                    <td className="px-4 py-3 text-right">
                      <a
                        href={row.affUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                      >
                        Apostar
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 8. Parlays relacionados ───────────────────────────────── */}
      {relatedParlays.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold">Este partido aparece en</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {relatedParlays.map((p) => (
              <Link
                key={p!.id}
                href="/parlays"
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div>
                  <p className="font-medium">{p!.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Prob. combinada {(p!.total_probability * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-bold text-primary">x{p!.total_odds.toFixed(2)}</p>
                  <Badge variant={p!.tier === "free" ? "secondary" : "default"} className="text-[10px]">
                    {p!.tier === "free" ? "Gratis" : "Premium"}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sin datos */}
      {!allBets.length && !bookmakerRows.length && !lineups && !hasInjuries && !(news ?? []).length && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-muted/10 py-20 text-center">
          <Sparkles className="mb-4 h-10 w-10 text-muted-foreground/30" />
          <h3 className="font-semibold">Sin datos disponibles aún</h3>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Las cuotas y análisis se actualizan cada 5 minutos. Las alineaciones aparecen ~1 hora antes del partido.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function TeamBlock({
  team,
  align,
}: {
  team: { name: string; logo_url?: string } | null;
  align: "left" | "right";
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2", align === "right" && "")}>
      {team?.logo_url ? (
        <Image src={team.logo_url} alt={team.name} width={56} height={56} className="object-contain" />
      ) : (
        <div className="h-14 w-14 rounded-full bg-muted" />
      )}
      <span className="text-center text-sm font-semibold leading-tight">{team?.name ?? "—"}</span>
    </div>
  );
}

function ProbCell({ label, xg }: { label: string; xg?: number }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {xg != null && <p className="mt-0.5 font-mono text-sm font-bold">{xg.toFixed(2)} xG</p>}
    </div>
  );
}

function OddCell({ value }: { value?: number }) {
  return (
    <td className="px-4 py-3 text-center">
      <span className="font-mono font-bold tabular-nums">
        {value != null ? value.toFixed(2) : <span className="text-muted-foreground">—</span>}
      </span>
    </td>
  );
}

// ─── Apuesta recomendada ─────────────────────────────────────────────────────

const MARKET_LABELS: Record<string, string> = {
  "1x2": "1X2",
  over_under_2_5: "Más/Menos 2.5",
  over_under_1_5: "Más/Menos 1.5",
  btts: "Ambos marcan",
  double_chance: "Doble oportunidad",
  asian_handicap: "Handicap asiático",
  draw_no_bet: "Empate no apuesta",
};

const SELECTION_LABELS: Record<string, string> = {
  home: "Local gana",
  draw: "Empate",
  away: "Visitante gana",
  over: "Más de",
  under: "Menos de",
  yes: "Sí",
  no: "No",
};

function RecommendedBet({
  bet,
  homeTeam,
  awayTeam,
}: {
  bet: any;
  homeTeam: { name: string } | null;
  awayTeam: { name: string } | null;
}) {
  const bm        = bet.bookmaker as { slug: string; name: string } | null;
  const prob      = Math.min(0.99, Math.max(0.01, Number(bet.model_prob ?? 0)));
  const probPct   = (prob * 100).toFixed(0);
  const isHighProb = prob >= 0.85;
  const affUrl    = bm?.slug ? buildAffiliateUrl(bm.slug) : null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 via-card to-card">
      <div className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <Star className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-bold">Apuesta recomendada</h2>
            <p className="text-xs text-muted-foreground">
              {homeTeam?.name} vs {awayTeam?.name} · Selección del modelo
            </p>
          </div>
          {isHighProb && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="h-3 w-3" />
              Alta confianza
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Lado izquierdo: mercado y selección */}
          <div className="rounded-xl border border-primary/20 bg-background/60 p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Mercado
            </div>
            <div className="text-lg font-bold">
              {MARKET_LABELS[bet.market] ?? bet.market}
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {SELECTION_LABELS[bet.selection] ?? bet.selection}
            </div>
            {bm?.name && (
              <div className="mt-2 text-xs text-muted-foreground">
                Disponible en <span className="font-semibold text-foreground">{bm.name}</span>
              </div>
            )}
          </div>

          {/* Lado derecho: stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatBox
              label="Probabilidad"
              value={`${probPct}%`}
              highlight={isHighProb}
            />
            <StatBox
              label="Cuota"
              value={Number(bet.price).toFixed(2)}
            />
            <StatBox
              label="Edge"
              value={`+${(Number(bet.edge) * 100).toFixed(1)}%`}
              highlight
            />
            <StatBox
              label="Confianza"
              value={bet.confidence === "high" ? "Alta" : bet.confidence === "medium" ? "Media" : "Baja"}
            />
          </div>
        </div>

        {bet.reasoning && (
          <div className="mt-4 rounded-lg bg-muted/30 px-4 py-3 text-sm italic text-muted-foreground">
            {bet.reasoning}
          </div>
        )}

        {affUrl ? (
          <a
            href={affUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Apostar en {bm?.name ?? "la casa"}
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : (
          <div className="mt-4 rounded-xl bg-muted/30 py-3 text-center text-sm text-muted-foreground">
            Busca esta apuesta en tu casa de apuestas favorita
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 p-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-0.5 font-mono text-lg font-black tabular-nums", highlight && "text-primary")}>
        {value}
      </div>
    </div>
  );
}

// ─── Alineación ──────────────────────────────────────────────────────────────

const POS_LABELS: Record<string, string> = {
  G: "Portero", D: "Defensa", M: "Medio", F: "Delantero",
};

const POS_COLORS: Record<string, string> = {
  G: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  D: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  M: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  F: "bg-red-500/20 text-red-400 border-red-500/30",
};

function LineupCard({
  team,
  lineup,
}: {
  team: { name: string; short_name?: string; logo_url?: string } | null;
  lineup: { formation: string; startXI: LineupPlayer[] };
}) {
  // Group by position row order
  const grouped: Record<string, LineupPlayer[]> = {};
  for (const p of lineup.startXI) {
    grouped[p.pos] = grouped[p.pos] ?? [];
    grouped[p.pos].push(p);
  }
  const posOrder = ["G", "D", "M", "F"];

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      {/* Team header */}
      <div className="mb-3 flex items-center gap-2">
        {team?.logo_url && (
          <Image src={team.logo_url} alt={team.name ?? ""} width={24} height={24} className="object-contain" />
        )}
        <span className="font-semibold">{team?.short_name ?? team?.name ?? "—"}</span>
        {lineup.formation && (
          <span className="ml-auto rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {lineup.formation}
          </span>
        )}
      </div>

      {/* Players by position */}
      <div className="space-y-3">
        {posOrder.map((pos) => {
          const players = grouped[pos];
          if (!players?.length) return null;
          return (
            <div key={pos}>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {POS_LABELS[pos] ?? pos}
              </div>
              <div className="space-y-1">
                {players.map((player, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-border/30 bg-muted/20 px-2.5 py-1.5"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold tabular-nums">
                      {player.number}
                    </span>
                    <span className="flex-1 truncate text-sm">{player.name}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold",
                        POS_COLORS[pos] ?? "bg-muted/50 text-muted-foreground border-border/40",
                      )}
                    >
                      {pos}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Lesiones ────────────────────────────────────────────────────────────────

function InjuryColumn({
  team,
  injuries,
}: {
  team: { name: string; short_name?: string; logo_url?: string } | null;
  injuries: Array<{ player_name: string; player_photo?: string | null; reason: string; type?: string | null; detail?: string | null }>;
}) {
  if (!injuries.length) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
        <TeamHeader team={team} />
        <p className="mt-3 text-center text-xs text-muted-foreground">Sin bajas confirmadas</p>
      </div>
    );
  }

  const injured    = injuries.filter((i) => i.reason === "injury");
  const suspended  = injuries.filter((i) => i.reason === "suspension");
  const other      = injuries.filter((i) => i.reason === "other");

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <TeamHeader team={team} />
      <div className="mt-3 space-y-3">
        {injured.length > 0 && (
          <InjuryGroup
            label="Lesionados"
            icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
            players={injured}
          />
        )}
        {suspended.length > 0 && (
          <InjuryGroup
            label="Suspendidos"
            icon={<ShieldOff className="h-3.5 w-3.5 text-red-400" />}
            players={suspended}
          />
        )}
        {other.length > 0 && (
          <InjuryGroup
            label="Dudas"
            icon={<AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />}
            players={other}
          />
        )}
      </div>
    </div>
  );
}

function TeamHeader({ team }: { team: { name: string; logo_url?: string } | null }) {
  return (
    <div className="flex items-center gap-2">
      {team?.logo_url && (
        <Image src={team.logo_url} alt={team.name ?? ""} width={20} height={20} className="object-contain" />
      )}
      <span className="text-sm font-semibold">{team?.name ?? "—"}</span>
    </div>
  );
}

function InjuryGroup({
  label,
  icon,
  players,
}: {
  label: string;
  icon: React.ReactNode;
  players: Array<{ player_name: string; player_photo?: string | null; type?: string | null; detail?: string | null }>;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="space-y-1">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5">
            {p.player_photo ? (
              <Image src={p.player_photo} alt={p.player_name} width={24} height={24} className="rounded-full object-cover" />
            ) : (
              <div className="h-6 w-6 rounded-full bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{p.player_name}</div>
              {(p.type ?? p.detail) && (
                <div className="truncate text-[11px] text-muted-foreground">{p.type ?? p.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Noticias ────────────────────────────────────────────────────────────────

function NewsCard({ article }: { article: any }) {
  const publishedAt = article.published_at
    ? new Date(article.published_at).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const content = (
    <div className="flex gap-3 rounded-xl border border-border/50 bg-card/60 p-3 transition-colors hover:bg-card">
      {article.image_url && (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
          <Image src={article.image_url} alt="" fill className="object-cover" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight line-clamp-2">{article.title}</h3>
        </div>
        {article.summary && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{article.summary}</p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          {article.source && <span className="font-semibold">{article.source}</span>}
          {publishedAt && <span>{publishedAt}</span>}
        </div>
      </div>
    </div>
  );

  return article.source_url ? (
    <a href={article.source_url} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <div>{content}</div>
  );
}

// ─── Value bet cards ──────────────────────────────────────────────────────────

function ValueBetCard({
  market, selection, price, edge, modelProb, confidence, reasoning, bookmakerName, bookmakerSlug,
}: {
  market: string; selection: string; price: number; edge: number; modelProb: number;
  confidence: string; reasoning: string; bookmakerName: string; bookmakerSlug: string;
}) {
  const affUrl = buildAffiliateUrl(bookmakerSlug);
  const confidenceColor =
    confidence === "high" ? "text-emerald-500" : confidence === "medium" ? "text-amber-500" : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {MARKET_LABELS[market] ?? market}
          </p>
          <p className="mt-0.5 font-bold">{SELECTION_LABELS[selection] ?? selection}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xl font-black text-primary">{price.toFixed(2)}</p>
          <p className={cn("text-xs font-semibold", confidenceColor)}>
            {confidence === "high" ? "Alta" : confidence === "medium" ? "Media" : "Baja"} confianza
          </p>
        </div>
      </div>
      <div className="mb-3 flex gap-3 text-xs text-muted-foreground">
        <span>Edge <strong className="text-emerald-500">+{(edge * 100).toFixed(1)}%</strong></span>
        <span>Prob. <strong>{(Math.min(0.99, Math.max(0.01, modelProb)) * 100).toFixed(0)}%</strong></span>
        <span>{bookmakerName}</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{reasoning}</p>
      <a
        href={affUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Apostar en {bookmakerName}
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function LockedValueBetCard() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/10 p-6 text-center">
      <Lock className="mb-2 h-6 w-6 text-muted-foreground/40" />
      <p className="text-sm font-semibold">Value bet Premium</p>
      <p className="mt-1 text-xs text-muted-foreground">Edge &gt;3%</p>
    </div>
  );
}

function PremiumGate({ count }: { count: number }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-primary" />
        <p className="text-sm"><strong>{count}</strong> value bets premium bloqueadas</p>
      </div>
      <Link
        href="/premium"
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Ver Premium
      </Link>
    </div>
  );
}
