import Link from "next/link";
import { Flame, Clock, CheckCircle2, XCircle, Zap } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { marketLabel, selectionLabel } from "@/lib/utils/market-label";
import type { Parlay } from "@/types";

const LEG_STATUS_ICON = {
  won: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />,
  lost: <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />,
  void: <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
  pending: <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-muted-foreground/40" />,
};

function formatValidUntil(dateStr: string): string {
  const d = new Date(dateStr);
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return "Expirado";
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function FunBetCard({ parlay }: { parlay: Parlay }) {
  const validUntil = (parlay as any).valid_until
    ? formatValidUntil((parlay as any).valid_until)
    : null;

  return (
    <Card className="relative overflow-hidden border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card to-card">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 left-1/4 h-28 w-28 rounded-full bg-orange-500/15 blur-2xl" />

      <div className="relative p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 ring-1 ring-amber-500/40">
              <Flame className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold uppercase tracking-tight text-amber-400">
                  FunBet
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                  <Zap className="h-2.5 w-2.5" />
                  Diario
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Alto riesgo · máxima emoción
              </p>
            </div>
          </div>

          {/* Cuota grande */}
          <div className="text-right">
            <div className="font-mono text-3xl font-bold tabular-nums text-amber-400">
              x{parlay.total_odds.toFixed(1)}
            </div>
            <div className="text-[10px] text-muted-foreground">cuota total</div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-amber-500/20 bg-background/50 p-3">
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Selecciones
            </div>
            <div className="font-mono text-xl font-bold tabular-nums">{parlay.legs.length}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Si apostás
            </div>
            <div className="font-mono text-xl font-bold tabular-nums text-amber-400">x{parlay.total_odds.toFixed(0)}</div>
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

        {/* Disclaimer fun */}
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-amber-400/80">
            ⚠️ Esta combinada es para disfrutar, no para gestión de bankroll.
            Apostá solo lo que estés dispuesto a perder. Puede ser tu día de suerte.
          </p>
        </div>

        {/* Legs */}
        <div className="space-y-2">
          {parlay.legs.map((leg, idx) => {
            const legResult = (leg.result ?? "pending") as keyof typeof LEG_STATUS_ICON;
            return (
              <div
                key={leg.id}
                className="flex items-center gap-3 rounded-md border border-amber-500/15 bg-card/70 px-3 py-2"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {leg.match.home_team.name} vs {leg.match.away_team.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {marketLabel(leg.market)} ·{" "}
                    {selectionLabel(leg.market, leg.selection, {
                      home: leg.match.home_team.name,
                      away: leg.match.away_team.name,
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm font-bold tabular-nums text-amber-400">
                    {leg.price.toFixed(2)}
                  </span>
                  {LEG_STATUS_ICON[legResult] ?? LEG_STATUS_ICON.pending}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CardFooter className="pt-0">
        <Button asChild className="w-full bg-amber-500 text-black hover:bg-amber-400">
          <Link href={`/parlays/builder?from=${parlay.id}`}>
            <Flame className="mr-2 h-4 w-4" />
            Apostar FunBet · x{parlay.total_odds.toFixed(1)}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
