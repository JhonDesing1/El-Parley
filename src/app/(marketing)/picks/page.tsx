import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Trophy, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Picks del día — El Parley",
  description:
    "Apuestas seleccionadas por El Parley con análisis de valor. Picks diarios con razonamiento estadístico.",
};

const RESULT_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  won:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  lost:    "bg-red-500/15 text-red-400 border-red-500/25",
  void:    "bg-muted/50 text-muted-foreground border-border/40",
};
const RESULT_LABELS: Record<string, string> = {
  pending: "Pendiente",
  won: "Ganado",
  lost: "Perdido",
  void: "Nulo",
};

const MARKET_LABELS: Record<string, string> = {
  "1x2": "1X2",
  btts: "Ambos anotan",
  over_under_2_5: "+/- 2.5",
  over_under_1_5: "+/- 1.5",
  double_chance: "Doble oportunidad",
  correct_score: "Resultado exacto",
  asian_handicap: "Hándicap asiático",
  draw_no_bet: "Empate no apuesta",
};

const SELECTION_LABELS: Record<string, string> = {
  home: "Local",
  draw: "Empate",
  away: "Visitante",
  over: "Más",
  under: "Menos",
  yes: "Sí",
  no: "No",
  home_draw: "1X",
  home_away: "12",
  draw_away: "X2",
};

export default async function PicksPage() {
  const supabase = (await createClient()) as any;

  // Public picks (RLS only returns published=true)
  const { data: picks } = await supabase
    .from("tipster_picks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (picks ?? []) as any[];

  // Global stats
  const resolved = rows.filter((p) => p.result !== "pending" && p.result !== "void");
  const won = resolved.filter((p) => p.result === "won").length;
  const winRate = resolved.length > 0 ? Math.round((won / resolved.length) * 100) : null;
  const totalUnits = rows.reduce((s, p) => s + (Number(p.profit_units) || 0), 0);
  const pending = rows.filter((p) => p.result === "pending");
  const historical = rows.filter((p) => p.result !== "pending");

  return (
    <div className="container max-w-3xl py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Target className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Picks del día</h1>
        <p className="mt-2 text-muted-foreground">
          Apuestas seleccionadas con análisis estadístico de valor
        </p>
      </div>

      {/* Stats */}
      {resolved.length > 0 && (
        <div className="mb-8 grid grid-cols-3 gap-3">
          <StatCard
            icon={<Trophy className="h-4 w-4" />}
            label="Acierto histórico"
            value={winRate !== null ? `${winRate}%` : "—"}
            valueClass={
              winRate === null
                ? "text-muted-foreground"
                : winRate >= 55
                  ? "text-emerald-400"
                  : winRate >= 45
                    ? "text-foreground"
                    : "text-red-400"
            }
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Unidades totales"
            value={`${totalUnits > 0 ? "+" : ""}${totalUnits.toFixed(2)}u`}
            valueClass={totalUnits >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <StatCard
            icon={<Target className="h-4 w-4" />}
            label="Picks resueltos"
            value={String(resolved.length)}
          />
        </div>
      )}

      {/* Pending picks */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-4 w-4" />
            Activos
          </h2>
          <div className="space-y-3">
            {pending.map((pick) => (
              <PickCard key={pick.id} pick={pick} />
            ))}
          </div>
        </section>
      )}

      {/* Historical picks */}
      {historical.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Historial
          </h2>
          <div className="space-y-2">
            {historical.map((pick) => (
              <PickCard key={pick.id} pick={pick} compact />
            ))}
          </div>
        </section>
      )}

      {rows.length === 0 && (
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
    <Card className={`${compact ? "p-3" : "p-5"}`}>
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

function StatCard({
  icon,
  label,
  value,
  valueClass = "text-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`font-mono text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
    </Card>
  );
}
