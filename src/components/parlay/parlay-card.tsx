import Link from "next/link";
import { Lock, TrendingUp, Trophy } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Parlay } from "@/types";

interface ParlayCardProps {
  parlay: Parlay;
  isLocked?: boolean;
}

export function ParlayCard({ parlay, isLocked = false }: ParlayCardProps) {
  const probPct = (parlay.total_probability * 100).toFixed(1);
  const isPremium = parlay.tier !== "free";

  return (
    <Card className={cn("relative overflow-hidden", isLocked && "select-none")}>
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
      </CardHeader>

      <CardContent className={cn("space-y-3", isLocked && "blur-sm")}>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3">
          <Stat label="Cuota total" value={`x${parlay.total_odds.toFixed(2)}`} highlight />
          <Stat label="Probabilidad" value={`${probPct}%`} />
          <Stat
            label="Confianza"
            value={parlay.confidence === "high" ? "Alta" : parlay.confidence === "medium" ? "Media" : "Baja"}
          />
        </div>

        {/* Legs */}
        <div className="space-y-2">
          {parlay.legs.map((leg, idx) => (
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
                  {leg.market} · {leg.selection}
                </div>
              </div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {leg.price.toFixed(2)}
              </div>
            </div>
          ))}
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
}: {
  label: string;
  value: string;
  highlight?: boolean;
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
        )}
      >
        {value}
      </div>
    </div>
  );
}
