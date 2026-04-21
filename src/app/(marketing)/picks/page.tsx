import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Clock, Zap, Layers } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Picks del día — El Parley",
  description:
    "Apuestas seleccionadas por El Parley con análisis de valor. Combinadas y picks diarios con razonamiento estadístico.",
};

const RESULT_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  won:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  lost:    "bg-red-500/15 text-red-400 border-red-500/25",
  void:    "bg-muted/50 text-muted-foreground border-border/40",
  partial: "bg-blue-500/15 text-blue-400 border-blue-500/25",
};
const RESULT_LABELS: Record<string, string> = {
  pending: "Pendiente",
  won:     "Ganado",
  lost:    "Perdido",
  void:    "Nulo",
  partial: "Parcial",
};

const MARKET_LABELS: Record<string, string> = {
  "1x2":              "1X2",
  btts:               "Ambos anotan",
  over_under_2_5:     "+/- 2.5",
  over_under_1_5:     "+/- 1.5",
  double_chance:      "Doble oportunidad",
  correct_score:      "Resultado exacto",
  asian_handicap:     "Hándicap asiático",
  draw_no_bet:        "Empate no apuesta",
};

const SELECTION_LABELS: Record<string, string> = {
  home:      "Local",
  draw:      "Empate",
  away:      "Visitante",
  over:      "Más",
  under:     "Menos",
  yes:       "Sí",
  no:        "No",
  home_draw: "1X",
  home_away: "12",
  draw_away: "X2",
};

export default async function PicksPage() {
  const supabase = (await createClient()) as any;

  // Solo partidos futuros (kickoff >= ahora)
  const nowISO = new Date().toISOString();

  // Ventana: próximos 7 días
  const in7d = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const [
    { data: tipsterPicks },
    { data: suggestedBets },
    { data: upcomingParlays },
  ] = await Promise.all([
    // Solo picks pendientes con partido próximo
    supabase
      .from("tipster_picks")
      .select("*")
      .eq("result", "pending")
      .gte("kickoff", nowISO)
      .order("kickoff", { ascending: true })
      .limit(20),

    // Apuestas sugeridas: pending con partido en los próximos 7 días
    supabase
      .from("value_bets")
      .select(`
        id, market, selection, price, model_prob, edge, result, reasoning, detected_at,
        match:matches(
          kickoff,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          league:leagues(name)
        )
      `)
      .eq("is_suggested", true)
      .eq("result", "pending")
      .order("model_prob", { ascending: false })
      .limit(50),

    // Combinadas pendientes con partidos en los próximos 7 días
    supabase
      .from("parlays")
      .select(`
        id, title, description, total_odds, total_probability, status, created_at,
        parlay_legs(
          id, market, selection, price, model_prob, result, leg_order,
          match:matches(
            kickoff,
            home_team:teams!home_team_id(name),
            away_team:teams!away_team_id(name),
            league:leagues(name)
          )
        )
      `)
      .eq("tier", "free")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const allPicks = (tipsterPicks ?? []) as any[];
  const suggested = (suggestedBets ?? []) as any[];
  const rawParlays = (upcomingParlays ?? []) as any[];

  // Sort parlay legs by leg_order and filter out parlays with all legs in the past
  const parlays = rawParlays
    .map((p: any) => {
      if (Array.isArray(p.parlay_legs)) {
        p.parlay_legs.sort((a: any, b: any) => a.leg_order - b.leg_order);
      }
      return p;
    })
    .filter((p: any) => {
      const legs: any[] = p.parlay_legs ?? [];
      return legs.some((l) => l.match?.kickoff && l.match.kickoff >= nowISO);
    });

  // Solo picks pendientes con partido próximo (ya filtrado en la query)
  const pendingPicks = allPicks.slice(0, 3);

  // Apuestas sugeridas con partido próximo (kickoff >= ahora), máximo 3
  const pendingSuggested = suggested
    .filter((b) => {
      const kickoff = b.match?.kickoff;
      if (!kickoff) return false;
      return kickoff >= nowISO && kickoff <= in7d;
    })
    .slice(0, 3);

  return (
    <div className="container max-w-3xl py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Target className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Picks del día</h1>
        <p className="mt-2 text-muted-foreground">
          Apuestas sugeridas, combinadas y picks con análisis estadístico
        </p>
      </div>

      {/* ── Combinadas del día ──────────────────────────────────────── */}
      {parlays.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Layers className="h-4 w-4" />
            Combinadas del día
          </h2>
          <div className="space-y-3">
            {parlays.map((parlay) => (
              <ParlayCard key={parlay.id} parlay={parlay} />
            ))}
          </div>
        </section>
      )}

      {/* ── Apuestas Sugeridas ──────────────────────────────────────── */}
      {pendingSuggested.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Zap className="h-4 w-4" />
            Apuestas Sugeridas
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Próximos 7 días · probabilidad ≥ 65% · cuota mínima 1.40
          </p>

          <div className="space-y-2">
            {pendingSuggested.map((bet) => (
              <SuggestedBetCard key={bet.id} bet={bet} />
            ))}
          </div>
        </section>
      )}

      {/* ── Picks del Tipster ───────────────────────────────────────── */}
      {pendingPicks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-4 w-4" />
            Picks activos
          </h2>
          <div className="space-y-3">
            {pendingPicks.map((pick) => (
              <PickCard key={pick.id} pick={pick} />
            ))}
          </div>
        </section>
      )}

      {pendingPicks.length === 0 && pendingSuggested.length === 0 && parlays.length === 0 && (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Target className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-bold">Sin picks por ahora</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Vuelve pronto, actualizamos los picks a diario.
          </p>
        </Card>
      )}
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────────────────

function ParlayCard({ parlay }: { parlay: any }) {
  const legs: any[] = parlay.parlay_legs ?? [];
  const prob = Math.round((parlay.total_probability ?? 0) * 100);
  const resultStyle = RESULT_STYLES[parlay.status] ?? RESULT_STYLES.pending;
  const resultLabel = RESULT_LABELS[parlay.status] ?? "Pendiente";

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{parlay.title}</p>
          {parlay.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{parlay.description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${resultStyle}`}
          >
            {resultLabel}
          </span>
          <div className="text-right">
            <p className="font-mono text-lg font-bold tabular-nums">
              x{Number(parlay.total_odds).toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">{prob}% prob.</p>
          </div>
        </div>
      </div>

      {/* Legs */}
      <div className="space-y-1.5 border-t pt-3">
        {legs.map((leg, i) => {
          const match = leg.match as any;
          const home = match?.home_team?.name ?? "Local";
          const away = match?.away_team?.name ?? "Visitante";
          const league = match?.league?.name ?? "";
          const kickoff = match?.kickoff
            ? format(new Date(match.kickoff), "d MMM · HH:mm", { locale: es })
            : null;
          const marketLabel = MARKET_LABELS[leg.market] ?? leg.market;
          const selectionLabel = SELECTION_LABELS[leg.selection] ?? leg.selection;
          const legResult = RESULT_STYLES[leg.result] ?? RESULT_STYLES.pending;

          return (
            <div key={leg.id ?? i} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <span
                  className={`mr-1.5 inline-flex items-center rounded border px-1.5 py-px text-[10px] font-bold ${legResult}`}
                >
                  {RESULT_LABELS[leg.result] ?? "?"}
                </span>
                <span className="font-medium">{home} vs {away}</span>
                <span className="text-muted-foreground">
                  {" "}· {marketLabel}: <span className="font-medium text-foreground">{selectionLabel}</span>
                </span>
                {league && (
                  <span className="ml-1 text-xs text-muted-foreground">({league})</span>
                )}
                {kickoff && (
                  <span className="ml-1 text-xs text-muted-foreground">· {kickoff}</span>
                )}
              </div>
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                {Number(leg.price).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SuggestedBetCard({ bet, compact = false }: { bet: any; compact?: boolean }) {
  const match = bet.match as any;
  const home = match?.home_team?.name ?? "Local";
  const away = match?.away_team?.name ?? "Visitante";
  const league = match?.league?.name ?? "";
  const kickoff = match?.kickoff
    ? format(new Date(match.kickoff), "d MMM · HH:mm", { locale: es })
    : null;
  const marketLabel = MARKET_LABELS[bet.market] ?? bet.market;
  const selectionLabel = SELECTION_LABELS[bet.selection] ?? bet.selection;
  const resultStyle = RESULT_STYLES[bet.result] ?? RESULT_STYLES.pending;
  const prob = Math.round((bet.model_prob ?? 0) * 100);

  return (
    <Card className={compact ? "p-3" : "p-4"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${resultStyle}`}
            >
              {RESULT_LABELS[bet.result] ?? "Pendiente"}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {marketLabel}
            </Badge>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {prob}% prob.
            </span>
          </div>

          <p className={`font-semibold ${compact ? "text-sm" : "text-base"}`}>
            {home} vs {away}
          </p>
          <p className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
            <span className="font-medium text-foreground">{selectionLabel}</span>
            {league && ` · ${league}`}
            {kickoff && ` · ${kickoff}`}
          </p>

          {!compact && bet.reasoning && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{bet.reasoning}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <p className={`font-mono font-bold tabular-nums ${compact ? "text-base" : "text-2xl"}`}>
            {Number(bet.price).toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground">cuota</p>
        </div>
      </div>
    </Card>
  );
}

function PickCard({ pick, compact = false }: { pick: any; compact?: boolean }) {
  const matchName = pick.match_label ?? "Partido";
  const league = pick.league_label ?? "";
  const kickoff = pick.kickoff
    ? format(new Date(pick.kickoff), "d MMM · HH:mm", { locale: es })
    : null;
  const marketLabel = MARKET_LABELS[pick.market] ?? pick.market;
  const selectionLabel = SELECTION_LABELS[pick.selection] ?? pick.selection;
  const resultStyle = RESULT_STYLES[pick.result] ?? RESULT_STYLES.void;

  return (
    <Card className={compact ? "p-3" : "p-5"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Left */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${resultStyle}`}
            >
              {RESULT_LABELS[pick.result]}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {marketLabel}
            </Badge>
            {pick.stake_units > 1 && (
              <span className="text-[10px] font-semibold text-muted-foreground">
                {pick.stake_units}u
              </span>
            )}
          </div>

          <p className={`font-semibold ${compact ? "text-sm" : "text-base"}`}>{matchName}</p>
          <p className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
            <span className="font-medium text-foreground">{selectionLabel}</span>
            {league && ` · ${league}`}
            {kickoff && ` · ${kickoff}`}
          </p>

          {!compact && pick.reasoning && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{pick.reasoning}</p>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
          <p className={`font-mono font-bold tabular-nums ${compact ? "text-base" : "text-2xl"}`}>
            {Number(pick.odds).toFixed(2)}
          </p>
          {pick.profit_units != null && (
            <p
              className={`font-bold tabular-nums ${compact ? "text-xs" : "text-sm"} ${
                pick.profit_units >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {pick.profit_units >= 0 ? "+" : ""}
              {Number(pick.profit_units).toFixed(2)}u
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

