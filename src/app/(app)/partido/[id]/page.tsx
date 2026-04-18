import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ExternalLink, Lock, Sparkles, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isPremiumUser } from "@/lib/utils/auth";
import { Badge } from "@/components/ui/badge";
import { buildAffiliateUrl } from "@/config/bookmakers";
import { cn } from "@/lib/utils/cn";
import type { Metadata } from "next";

export const revalidate = 300; // 5 min — sincronizado con sync-live-odds

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
    description: `Value bets y cuotas comparadas para ${home} vs ${away}.`,
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
      id, kickoff, status, minute, home_score, away_score,
      model_expected_goals_home, model_expected_goals_away,
      home_team:teams!home_team_id(id, name, short_name, logo_url),
      away_team:teams!away_team_id(id, name, short_name, logo_url),
      league:leagues(id, name, country, logo_url)
      `,
    )
    .eq("id", matchId)
    .single();

  if (!match) notFound();

  // Value bets + cuotas + parlays en paralelo
  const [{ data: valueBets }, { data: odds }, { data: parlayLegs }] = await Promise.all([
    supabase
      .from("value_bets")
      .select("*, bookmaker:bookmakers(id, slug, name, logo_url, affiliate_url)")
      .eq("match_id", matchId)
      .eq("result", "pending")
      .order("edge", { ascending: false }),

    supabase
      .from("odds")
      .select("*, bookmaker:bookmakers(id, slug, name, logo_url, affiliate_url)")
      .eq("match_id", matchId)
      .in("market", ["1x2"])
      .order("bookmaker_id"),

    supabase
      .from("parlay_legs")
      .select(
        `
        id, market, selection, price,
        parlay:parlays(id, title, total_odds, total_probability, tier, status)
        `,
      )
      .eq("match_id", matchId),
  ]);

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const homeTeam = match.home_team as { id: number; name: string; short_name?: string; logo_url?: string } | null;
  const awayTeam = match.away_team as { id: number; name: string; short_name?: string; logo_url?: string } | null;
  const league = match.league as { id: number; name: string; country: string; logo_url?: string } | null;

  const freeValueBets = (valueBets ?? []).filter((v) => !v.is_premium);
  const premiumValueBets = (valueBets ?? []).filter((v) => v.is_premium);
  const visibleValueBets = isPremium
    ? (valueBets ?? [])
    : freeValueBets;

  // Agrupar cuotas por casa
  const oddsByBookmaker: Record<
    string,
    { slug: string; name: string; logo?: string; affUrl: string; home?: number; draw?: number; away?: number }
  > = {};
  for (const o of odds ?? []) {
    const bm = o.bookmaker as { id: number; slug: string; name: string; logo_url?: string } | null;
    if (!bm) continue;
    if (!oddsByBookmaker[bm.slug]) {
      oddsByBookmaker[bm.slug] = {
        slug: bm.slug,
        name: bm.name,
        logo: bm.logo_url ?? undefined,
        affUrl: buildAffiliateUrl(bm.slug),
      };
    }
    if (o.selection === "home") oddsByBookmaker[bm.slug].home = o.price;
    if (o.selection === "draw") oddsByBookmaker[bm.slug].draw = o.price;
    if (o.selection === "away") oddsByBookmaker[bm.slug].away = o.price;
  }
  const bookmakerRows = Object.values(oddsByBookmaker);

  // Parlays que incluyen este partido
  const relatedParlays = (parlayLegs ?? [])
    .map((leg) => leg.parlay as { id: string; title: string; total_odds: number; total_probability: number; tier: string; status: string } | null)
    .filter(Boolean)
    .filter((p, i, arr) => arr.findIndex((x) => x!.id === p!.id) === i);

  return (
    <div className="container max-w-4xl py-8">
      {/* Back */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>

      {/* Header del partido */}
      <div className="mb-8 rounded-2xl border border-border/60 bg-card p-6">
        {/* Liga */}
        <div className="mb-4 flex items-center gap-2">
          {league?.logo_url && (
            <Image src={league.logo_url} alt={league.name} width={18} height={18} className="object-contain" />
          )}
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {league?.name}
          </span>
          {isLive && <Badge variant="live">EN VIVO · {match.minute}&apos;</Badge>}
        </div>

        {/* Equipos y marcador */}
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

        {/* xG del modelo */}
        {match.model_expected_goals_home != null && match.model_expected_goals_away != null && (
          <div className="mt-4 border-t border-border/40 pt-4">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Probabilidades del modelo (Poisson)
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <ProbCell
                label={homeTeam?.short_name ?? homeTeam?.name ?? "Local"}
                xg={match.model_expected_goals_home}
              />
              <ProbCell label="Empate" />
              <ProbCell
                label={awayTeam?.short_name ?? awayTeam?.name ?? "Visitante"}
                xg={match.model_expected_goals_away}
              />
            </div>
          </div>
        )}
      </div>

      {/* Value Bets */}
      {((valueBets?.length ?? 0) > 0 || premiumValueBets.length > 0) && (
        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-primary" />
            Value bets detectadas
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {valueBets?.length ?? 0}
            </span>
          </h2>

          {visibleValueBets.length === 0 && !isPremium && premiumValueBets.length > 0 && (
            <PremiumGate count={premiumValueBets.length} />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {visibleValueBets.map((vb) => {
              const bm = vb.bookmaker as { slug: string; name: string; logo_url?: string } | null;
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

            {!isPremium && premiumValueBets.length > 0 &&
              premiumValueBets.map((vb) => (
                <LockedValueBetCard key={vb.id} />
              ))}
          </div>
        </section>
      )}

      {/* Comparador de cuotas */}
      {bookmakerRows.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <TrendingUp className="h-5 w-5 text-primary" />
            Comparador de cuotas — 1X2
          </h2>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Casa</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    {homeTeam?.short_name ?? "1"}
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">X</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    {awayTeam?.short_name ?? "2"}
                  </th>
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
                    <td className="px-4 py-3">
                      <span className="font-medium">{row.name}</span>
                    </td>
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

      {/* Parlays relacionados */}
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
      {!valueBets?.length && !bookmakerRows.length && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-muted/10 py-20 text-center">
          <Sparkles className="mb-4 h-10 w-10 text-muted-foreground/30" />
          <h3 className="font-semibold">Sin datos disponibles aún</h3>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Las cuotas y value bets se actualizan automáticamente cada 5 minutos.
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
      {xg != null && (
        <p className="mt-0.5 font-mono text-sm font-bold">{xg.toFixed(2)} xG</p>
      )}
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

function ValueBetCard({
  market,
  selection,
  price,
  edge,
  modelProb,
  confidence,
  reasoning,
  bookmakerName,
  bookmakerSlug,
}: {
  market: string;
  selection: string;
  price: number;
  edge: number;
  modelProb: number;
  confidence: string;
  reasoning: string;
  bookmakerName: string;
  bookmakerSlug: string;
}) {
  const affUrl = buildAffiliateUrl(bookmakerSlug);
  const confidenceColor =
    confidence === "high"
      ? "text-green-500"
      : confidence === "medium"
        ? "text-yellow-500"
        : "text-muted-foreground";

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
        <span>
          Edge <strong className="text-green-500">+{(edge * 100).toFixed(1)}%</strong>
        </span>
        <span>
          Prob. modelo <strong>{(modelProb * 100).toFixed(0)}%</strong>
        </span>
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
      <p className="mt-1 text-xs text-muted-foreground">Edge &gt;6%</p>
    </div>
  );
}

function PremiumGate({ count }: { count: number }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-primary" />
        <p className="text-sm">
          <strong>{count}</strong> value bets premium bloqueadas
        </p>
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
