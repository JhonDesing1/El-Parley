import { Sparkles, TrendingUp, Target, Lock, Gauge } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ValueBet } from "@/types";

interface MatchContext {
  kickoff: string;
  home_team: { name: string; logo_url?: string | null };
  away_team: { name: string; logo_url?: string | null };
  league?: { name: string } | null;
}

interface ValueBetAlertProps {
  valueBet: ValueBet;
  matchId: number;
  match?: MatchContext | null;
  /** Slot para acciones adicionales (ej: botón de registro de pick) */
  actions?: React.ReactNode;
}

function edgeBadgeClass(edge: number) {
  if (edge >= 0.08) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (edge >= 0.05) return "bg-green-500/15 text-green-400 border-green-500/25";
  return "bg-amber-500/15 text-amber-400 border-amber-500/25";
}

export function probabilityBucket(modelProb: number): { label: "Alta" | "Media" | "Baja"; className: string } {
  if (modelProb >= 0.75) return { label: "Alta", className: "text-emerald-400" };
  if (modelProb >= 0.6) return { label: "Media", className: "text-amber-400" };
  return { label: "Baja", className: "text-red-400" };
}

/**
 * Confianza 0-100 derivada del modelo. Combina probabilidad y edge
 * para reflejar qué tan fuerte es la apuesta. Cap a 99 para evitar 100% absolutos.
 */
export function confidenceScore(modelProb: number, edge: number): number {
  const base = modelProb * 85;
  const bonus = Math.min(Math.max(edge, 0), 0.15) * 100;
  return Math.min(99, Math.round(base + bonus));
}

function formatKickoff(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  });
}

export function ValueBetAlert({ valueBet, matchId, match, actions }: ValueBetAlertProps) {
  const edgePct = (valueBet.edge * 100).toFixed(1);
  const confidence = confidenceScore(valueBet.model_prob, valueBet.edge);
  const probability = probabilityBucket(valueBet.model_prob);

  return (
    <Card className="relative overflow-hidden border-value/40 bg-gradient-to-br from-value/[0.08] via-card to-card">
      {/* Decorative gradient blob */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-value/20 blur-3xl" />

      <div className="relative p-6">
        {/* Match context header */}
        {match && (
          <div className="mb-3 rounded-md bg-background/50 px-3 py-2 ring-1 ring-border/30">
            <p className="truncate text-center text-sm font-semibold">
              {match.home_team.name}{" "}
              <span className="text-muted-foreground font-normal">vs</span>{" "}
              {match.away_team.name}
            </p>
            <p className="text-center text-[11px] text-muted-foreground">
              {match.league?.name && `${match.league.name} · `}
              {formatKickoff(match.kickoff)}
            </p>
          </div>
        )}

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-value/15 ring-1 ring-value/30">
              <Sparkles className="h-5 w-5 text-value" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-bold uppercase tracking-tight">
                  Apuesta Sugerida
                </h3>
                {probability.label === "Alta" && (
                  <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    ⭐ Probabilidad alta
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Datos reales de API-Football · Modelo Poisson + xG
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold tabular-nums ${edgeBadgeClass(valueBet.edge)}`}
          >
            +{edgePct}% EDGE
          </span>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <Stat
            icon={<Gauge className="h-4 w-4" />}
            label="Confianza"
            value={`${confidence}%`}
            sub="0–100"
          />
          <Stat
            icon={<TrendingUp className="h-4 w-4" />}
            label="Cuota"
            value={valueBet.price.toFixed(2)}
            sub={valueBet.bookmaker.name}
          />
          <Stat
            icon={<Target className="h-4 w-4" />}
            label="Probabilidad"
            value={probability.label}
            sub="Modelo"
            valueClass={probability.className}
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

        {actions && <div className="mt-2">{actions}</div>}

        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Análisis informativo — no garantiza ganancias. Verifica la disponibilidad del operador en tu país. +18. Juega responsablemente.
        </p>
      </div>
    </Card>
  );
}

export function LockedValueBetCard({ match }: { match?: MatchContext | null }) {
  return (
    <Card className="relative overflow-hidden border-border/40">
      {/* Blurred content */}
      <div className="pointer-events-none select-none p-6 blur-sm" aria-hidden>
        <div className="mb-3 h-10 w-full rounded-md bg-muted/60" />
        <div className="mb-4 flex justify-between">
          <div className="h-8 w-32 rounded bg-muted/60" />
          <div className="h-6 w-20 rounded bg-muted/60" />
        </div>
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/50" />
          ))}
        </div>
        <div className="h-24 rounded-lg bg-muted/50" />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-[2px]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted ring-1 ring-border">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        {match && (
          <p className="text-sm font-semibold">
            {match.home_team.name} vs {match.away_team.name}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Value bet premium detectada</p>
        <Button asChild size="sm" variant="default">
          <a href="/premium">Ver con Premium</a>
        </Button>
      </div>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  valueClass = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg bg-background/60 p-3 ring-1 ring-border/40">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`font-mono text-lg font-bold tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
