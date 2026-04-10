import { Sparkles, TrendingUp, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ValueBet } from "@/types";

interface ValueBetAlertProps {
  valueBet: ValueBet;
  matchId: number;
}

export function ValueBetAlert({ valueBet, matchId }: ValueBetAlertProps) {
  const edgePct = (valueBet.edge * 100).toFixed(1);
  const modelPct = (valueBet.model_prob * 100).toFixed(0);
  const stakePct = (valueBet.kelly_fraction * 100).toFixed(1);

  return (
    <Card className="relative overflow-hidden border-value/40 bg-gradient-to-br from-value/[0.08] via-card to-card">
      {/* Decorative gradient blob */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-value/20 blur-3xl" />

      <div className="relative p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-value/15 ring-1 ring-value/30">
              <Sparkles className="h-5 w-5 text-value" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold uppercase tracking-tight">
                Value Bet Detectado
              </h3>
              <p className="text-xs text-muted-foreground">
                Análisis algorítmico — Modelo Poisson + xG
              </p>
            </div>
          </div>
          <Badge variant="value">+{edgePct}% EDGE</Badge>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <Stat
            icon={<Target className="h-4 w-4" />}
            label="Modelo"
            value={`${modelPct}%`}
            sub="Prob. real"
          />
          <Stat
            icon={<TrendingUp className="h-4 w-4" />}
            label="Cuota"
            value={valueBet.price.toFixed(2)}
            sub={valueBet.bookmaker.name}
          />
          <Stat
            icon={<Sparkles className="h-4 w-4" />}
            label="Stake"
            value={`${stakePct}%`}
            sub="Kelly ¼"
          />
        </div>

        <div className="mb-5 rounded-lg bg-background/60 p-4 ring-1 ring-border/40">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Selección
            </span>
            <Badge variant="outline" className="text-xs">
              {valueBet.market}
            </Badge>
          </div>
          <p className="font-display text-xl font-bold">{valueBet.selection}</p>
          {valueBet.reasoning && (
            <p className="mt-3 text-sm text-muted-foreground">{valueBet.reasoning}</p>
          )}
        </div>

        <Button asChild variant="value" size="lg" className="w-full">
          <a
            href={`/api/track/affiliate?book=${valueBet.bookmaker.slug}&match=${matchId}&source=value_bet`}
            target="_blank"
            rel="noopener nofollow sponsored"
          >
            Apostar en {valueBet.bookmaker.name} · Cuota {valueBet.price.toFixed(2)}
          </a>
        </Button>

        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Una value bet no garantiza ganancias. Apuesta solo lo que puedas perder. 18+
        </p>
      </div>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg bg-background/60 p-3 ring-1 ring-border/40">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-mono text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
