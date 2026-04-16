import Link from "next/link";
import { Lock, TrendingUp, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Parlay } from "@/types";

interface ParlayCardProps {
  parlay: Parlay;
  isLocked?: boolean;
}

const MARKET_LABELS: Record<string, string> = {
  "1x2": "1X2",
  btts: "Ambos anotan",
  over_under_2_5: "Más/Menos 2.5",
  over_under_1_5: "Más/Menos 1.5",
  double_chance: "Doble oportunidad",
  draw_no_bet: "Empate anula apuesta",
  asian_handicap: "Handicap asiático",
  correct_score: "Marcador exacto",
};

const SELECTION_LABELS: Record<string, Record<string, string>> = {
  "1x2": { home: "Local", draw: "Empate", away: "Visitante" },
  btts: { yes: "Sí", no: "No" },
  over_under_2_5: { over: "Más 2.5", under: "Menos 2.5" },
  over_under_1_5: { over: "Más 1.5", under: "Menos 1.5" },
};

function legLabel(market: string, selection: string): string {
  return SELECTION_LABELS[market]?.[selection] ?? selection;
}

function formatValidUntil(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "Expirado";
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor((diffMs % 3600000) / 60000);
  if (diffH > 0) return `Válido ${diffH}h ${diffM}m`;
  return `Válido ${diffM}m`;
}

const STATUS_CONFIG = {
  pending: { label: "Pendiente", class: "text-muted-foreground" },
  won: { label: "Ganado", class: "text-value" },
  lost: { label: "Perdido", class: "text-destructive" },
  void: { label: "Anulado", class: "text-muted-foreground" },
  partial: { label: "Parcial", class: "text-amber-500" },
} as const;

const LEG_STATUS_ICON = {
  won: <CheckCircle2 className="h-3.5 w-3.5 text-value shrink-0" />,
  lost: <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />,
  void: <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
  pending: <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-muted-foreground/40" />,
};

export function ParlayCard({ parlay, isLocked = false }: ParlayCardProps) {
  const probPct = (parlay.total_probability * 100).toFixed(1);
  const isPremium = parlay.tier !== "free";
  const status = STATUS_CONFIG[parlay.status] ?? STATUS_CONFIG.pending;
  const validUntilLabel = (parlay as any).valid_until ? formatValidUntil((parlay as any).valid_until) : null;

  const ev = (parlay as any).expected_value as number | null | undefined;
  const evPct = ev != null ? (ev * 100).toFixed(1) : null;

  return (
    <Card className={cn("relative overflow-hidden", isLocked && "select-none")}>
      {/* Tier badge */}
      {isPremium && (
        <div className="absolute right-3 top-3 z-10">
          <Badge variant="premium" className="gap-1">
            <Lock className="h-3 w-3" />
            PREMIUM
          </Badge>
        </div>
      )}

      <CardHeader>
        <CardTitle className="pr-20">{parlay.title}</CardTitle>
        {parlay.description && (
          <p className="text-sm text-muted-foreground">{parlay.description}</p>
        )}
        {/* Status + valid until row */}
        <div className="flex items-center gap-3 text-xs">
          <span className={status.class}>{status.label}</span>
          {validUntilLabel && parlay.status === "pending" && (
            <span className="flex items-center gap-1 text-muted-foreground/70">
              <Clock className="h-3 w-3" />
              {validUntilLabel}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn("space-y-3", isLocked && "blur-sm")}>
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 rounded-lg bg-muted/40 p-3">
          <Stat label="Cuota total" value={`x${parlay.total_odds.toFixed(2)}`} highlight />
          <Stat label="Prob. modelo" value={`${probPct}%`} />
          <Stat
            label="Confianza"
            value={
              parlay.confidence === "high"
                ? "Alta"
                : parlay.confidence === "medium"
                  ? "Media"
                  : "Baja"
            }
          />
          {evPct != null ? (
            <Stat
              label="EV"
              value={`${Number(evPct) >= 0 ? "+" : ""}${evPct}%`}
              positive={Number(evPct) >= 0}
            />
          ) : (
            <Stat label="Piernas" value={String(parlay.legs.length)} />
          )}
        </div>

        {/* Legs */}
        <div className="space-y-2">
          {parlay.legs.map((leg, idx) => {
            const legResult = (leg.result ?? "pending") as keyof typeof LEG_STATUS_ICON;
            return (
              <div
                key={leg.id}
                className="flex items-center gap-3 rounded-md border border-border/40 bg-card px-3 py-2"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {leg.match.home_team.name} vs {leg.match.away_team.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {MARKET_LABELS[leg.market] ?? leg.market} · {legLabel(leg.market, leg.selection)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {leg.price.toFixed(2)}
                  </span>
                  {LEG_STATUS_ICON[legResult] ?? LEG_STATUS_ICON.pending}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        {isLocked ? (
          <Button asChild variant="value" size="lg" className="w-full">
            <Link href="/premium">
              <Lock className="h-4 w-4" />
              Desbloquear con Premium
            </Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="default" className="flex-1">
              <Link href={`/parlays/${parlay.id}`}>Ver detalle</Link>
            </Button>
            <Button asChild variant="value" className="flex-1">
              <Link href={`/parlays/builder?from=${parlay.id}`}>
                <TrendingUp className="h-4 w-4" />
                Apostar
              </Link>
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  positive,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-base font-bold tabular-nums",
          highlight && "text-value",
          positive === true && "text-value",
          positive === false && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}
