import { redirect } from "next/navigation";
import Link from "next/link";
import { subDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ClipboardList,
  TrendingUp,
  Target,
  Trophy,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoidPickButton } from "@/components/picks/void-pick-button";
import { RoiChart } from "@/components/picks/roi-chart";
import { ManualPickModal } from "@/components/picks/manual-pick-modal";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mis Apuestas — El Parley" };

const RESULT_LABELS: Record<string, string> = {
  pending: "Pendiente",
  won: "Ganado",
  lost: "Perdido",
  void: "Nulo",
};

const RESULT_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  won: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  lost: "bg-red-500/15 text-red-400 border-red-500/25",
  void: "bg-muted/50 text-muted-foreground border-border/40",
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
  home_draw: "Local o Empate",
  home_away: "Local o Visitante",
  draw_away: "Empate o Visitante",
};

const FILTER_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "won", label: "Ganados" },
  { value: "lost", label: "Perdidos" },
  { value: "void", label: "Nulos" },
];

const VALID_RESULTS = new Set(["pending", "won", "lost", "void"]);
const PAGE_SIZE = 20;

export default async function MisPicksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; result?: string }>;
}) {
  const { page: pageParam, result: resultParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const resultFilter = VALID_RESULTS.has(resultParam ?? "") ? (resultParam as string) : "";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mis-picks");

  // Profile stats
  const { data: profile } = await supabase
    .from("profiles")
    .select("total_picks, win_rate, roi_7d, roi_30d")
    .eq("id", user.id)
    .single();

  // Chart: resolved picks (last 90 days, no pagination)
  const { data: chartPicks } = await supabase
    .from("user_picks")
    .select("created_at, profit_loss, result")
    .eq("user_id", user.id)
    .in("result", ["won", "lost"])
    .not("profit_loss", "is", null)
    .gte("created_at", subDays(new Date(), 90).toISOString())
    .order("created_at", { ascending: true });

  // Paginated + filtered picks
  let query = supabase
    .from("user_picks")
    .select(
      `
      id, market, selection, odds, stake, result, profit_loss, notes, created_at, resolved_at,
      match:matches(
        id, kickoff, status,
        home_team:teams!home_team_id(name),
        away_team:teams!away_team_id(name),
        league:leagues(name)
      ),
      bookmaker:bookmakers(name)
    `,
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (resultFilter) {
    query = query.eq("result", resultFilter as any);
  }

  const { data: picks, count } = await query;

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const resolvedPicks = (picks ?? []).filter((p) => p.result !== "pending");
  const totalStaked = resolvedPicks.reduce((s, p) => s + (p.stake ?? 0), 0);
  const totalPnl = resolvedPicks.reduce((s, p) => s + (p.profit_loss ?? 0), 0);

  function paginationHref(p: number) {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (resultFilter) params.set("result", resultFilter);
    return `/mis-picks?${params.toString()}`;
  }

  function filterHref(r: string) {
    const params = new URLSearchParams();
    if (r) params.set("result", r);
    params.set("page", "1");
    return `/mis-picks?${params.toString()}`;
  }

  return (
    <div className="container max-w-4xl py-8">
      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Mis Apuestas</h1>
            <p className="text-sm text-muted-foreground">Historial de tus apuestas registradas</p>
          </div>
        </div>
        <ManualPickModal />
      </div>

      {/* ── Stats ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="Total apuestas"
          value={String(profile?.total_picks ?? 0)}
        />
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label="Cuotas acertadas"
          value={((profile?.win_rate ?? 0) / 100).toFixed(2)}
          valueClass={
            (profile?.win_rate ?? 0) >= 55
              ? "text-emerald-400"
              : (profile?.win_rate ?? 0) >= 45
                ? "text-foreground"
                : "text-red-400"
          }
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="ROI 7d"
          value={`${profile?.roi_7d ?? 0}%`}
          valueClass={(profile?.roi_7d ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="ROI 30d"
          value={`${profile?.roi_30d ?? 0}%`}
          valueClass={(profile?.roi_30d ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
        />
      </div>

      {/* ── ROI Chart ── */}
      {chartPicks && chartPicks.length >= 2 && (
        <Card className="mb-6 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            P&L acumulado — últimos 90 días
          </p>
          <RoiChart picks={chartPicks as any} />
        </Card>
      )}

      {/* ── P&L summary ── */}
      {totalStaked > 0 && (
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Total apostado:{" "}
              <span className="font-semibold text-foreground">
                ${totalStaked.toLocaleString("es-CO")}
              </span>
              {resultFilter && (
                <span className="ml-1 text-[11px]">
                  ({RESULT_LABELS[resultFilter]?.toLowerCase()}s)
                </span>
              )}
            </span>
            <span className="text-muted-foreground">
              P&L:{" "}
              <span
                className={`font-bold tabular-nums ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString("es-CO")}
              </span>
            </span>
          </div>
        </Card>
      )}

      {/* ── Filter tabs ── */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {FILTER_OPTIONS.map((opt) => {
          const active = opt.value === resultFilter;
          return (
            <Link
              key={opt.value}
              href={filterHref(opt.value)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold transition-all ${
                active
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* ── Picks list ── */}
      {!picks || picks.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-bold">
            {resultFilter
              ? `Sin apuestas ${RESULT_LABELS[resultFilter]?.toLowerCase()}s`
              : "Sin apuestas aún"}
          </h3>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {resultFilter
              ? "No tienes picks con este estado todavía."
              : "Registra tu primera apuesta desde la ficha de un partido, una apuesta sugerida, o con el botón «Registrar apuesta»."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {picks.map((pick: any) => {
            const match = pick.match;
            const homeName = match?.home_team?.name ?? "?";
            const awayName = match?.away_team?.name ?? "?";
            const leagueName = match?.league?.name ?? "";
            const selectionLabel = SELECTION_LABELS[pick.selection] ?? pick.selection;
            const marketLabel = MARKET_LABELS[pick.market] ?? pick.market;
            const resultStyle = RESULT_STYLES[pick.result] ?? RESULT_STYLES.void;

            return (
              <Card key={pick.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${resultStyle}`}
                      >
                        {RESULT_LABELS[pick.result]}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {marketLabel}
                      </Badge>
                      {pick.bookmaker && (
                        <span className="text-[10px] text-muted-foreground">
                          {pick.bookmaker.name}
                        </span>
                      )}
                    </div>

                    <p className="truncate font-semibold">
                      {homeName} vs {awayName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{selectionLabel}</span>
                      {leagueName && ` · ${leagueName}`}
                    </p>

                    {pick.notes && (
                      <p className="mt-1 line-clamp-1 text-xs italic text-muted-foreground">
                        {pick.notes}
                      </p>
                    )}
                  </div>

                  {/* Right */}
                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-start">
                    <div className="text-right">
                      <p className="font-mono text-lg font-bold tabular-nums">
                        {pick.odds.toFixed(2)}
                      </p>
                      {pick.stake && (
                        <p className="text-xs text-muted-foreground">
                          Stake: ${Number(pick.stake).toLocaleString("es-CO")}
                        </p>
                      )}
                      {pick.profit_loss != null && (
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            Number(pick.profit_loss) >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {Number(pick.profit_loss) >= 0 ? "+" : ""}$
                          {Math.abs(Number(pick.profit_loss)).toLocaleString("es-CO")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground sm:justify-end">
                      <Clock className="h-3 w-3" />
                      {format(new Date(pick.created_at), "d MMM HH:mm", { locale: es })}
                    </div>
                    {pick.result === "pending" && (
                      <VoidPickButton
                        pickId={pick.id}
                        matchLabel={`${homeName} vs ${awayName}`}
                      />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={page <= 1} className="gap-1">
            <Link href={paginationHref(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Link>
          </Button>

          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>

          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            className="gap-1"
          >
            <Link href={paginationHref(page + 1)}>
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
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
