import Link from "next/link";
import { Lock, Star, TrendingUp, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Parlay } from "@/types";

const MARKET_LABELS: Record<string, string> = {
  "1x2": "1X2",
  btts: "Ambos anotan",
  over_under_2_5: "Más/Menos 2.5",
  over_under_1_5: "Más/Menos 1.5",
  double_chance: "Doble oportunidad",
  draw_no_bet: "Empate anula apuesta",
  asian_handicap: "Handicap asiático",
};

const SELECTION_LABELS: Record<string, Record<string, string>> = {
  "1x2": { home: "Local", draw: "Empate", away: "Visitante" },
  btts: { yes: "Sí", no: "No" },
  over_under_2_5: { over: "Más 2.5", under: "Menos 2.5" },
  over_under_1_5: { over: "Más 1.5", under: "Menos 1.5" },
};

const LEG_STATUS_ICON = {
  won: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-400" />,
  lost: <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />,
  void: <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
  pending: <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-amber-500/40" />,
};

function formatValidUntil(dateStr: string): string {
  const d = new Date(dateStr);
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return "Expirado";
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Combinada90CardProps {
  parlay: Parlay;
  isLocked?: boolean;
}

export function Combinada90Card({ parlay, isLocked = false }: Combinada90CardProps) {
  const probPct = (parlay.total_probability * 100).toFixed(0);
  const validUntil = (parlay as any).valid_until
    ? formatValidUntil((parlay as any).valid_until)
    : null;

  // Extraer número de la combinada del título (#1, #2…)
  const numMatch = (parlay.title as string).match(/#(\d+)/);
  const num = numMatch ? numMatch[1] : null;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-amber-500/40 bg-gradient-to-br from-amber-500/8 via-card to-card",
        isLocked && "select-none",
      )}
    >
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl" />

      <div className={cn("relative p-5", isLocked && "blur-sm")}>
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30">
              <Star className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold uppercase tracking-tight">
                  Combinada 90%{num ? ` #${num}` : ""}
                </span>
                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  {probPct}% prob.
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Probabilidad combinada ≥ 90% · ganancia ≥ 0.60
              </p>
            </div>
          </div>

          {/* Cuota */}
          <div className="text-right">
            <div className="font-mono text-3xl font-bold tabular-nums text-amber-400">
              x{parlay.total_odds.toFixed(2)}
            </div>
            <div className="text-[10px] text-muted-foreground">cuota total</div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-amber-500/20 bg-background/50 p-3">
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Prob. modelo
            </div>
            <div className="font-mono text-xl font-bold tabular-nums text-amber-400">
              {parlay.total_probability.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Selecciones
            </div>
            <div className="font-mono text-xl font-bold tabular-nums">{parlay.legs.length}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Válido
            </div>
            <div className="flex items-center justify-center gap-1 font-mono text-sm font-bold tabular-nums">
              {validUntil ? (
                <>
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {validUntil}
                </>
              ) : "—"}
            </div>
          </div>
        </div>

        {/* Legs */}
        <div className="space-y-2">
          {parlay.legs.map((leg, idx) => {
            const legResult = (leg.result ?? "pending") as keyof typeof LEG_STATUS_ICON;
            const selLabel =
              SELECTION_LABELS[leg.market]?.[leg.selection] ?? leg.selection;
            const modelProb = (leg as any).model_prob as number | null;
            return (
              <div
                key={leg.id}
                className="flex items-center gap-3 rounded-md border border-amber-500/15 bg-card/70 px-3 py-2"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-400">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {leg.match.home_team.name} vs {leg.match.away_team.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {MARKET_LABELS[leg.market] ?? leg.market} · {selLabel}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {modelProb != null && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-400">
                      {(modelProb * 100).toFixed(0)}%
                    </span>
                  )}
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {leg.price.toFixed(2)}
                  </span>
                  {LEG_STATUS_ICON[legResult] ?? LEG_STATUS_ICON.pending}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CardFooter className="gap-2 pt-0">
        {isLocked ? (
          <Button asChild variant="value" size="lg" className="w-full">
            <Link href="/premium">
              <Lock className="h-4 w-4" />
              Desbloquear con Premium
            </Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/parlays/${parlay.id}`}>Ver detalle</Link>
            </Button>
            <Button
              asChild
              className="flex-1 border-amber-500/30 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
            >
              <Link href={`/parlays/builder?from=${parlay.id}`}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Apostar · x{parlay.total_odds.toFixed(2)}
              </Link>
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
