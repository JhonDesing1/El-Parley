import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Match } from "@/types";
import { cn } from "@/lib/utils/cn";

interface MatchCardProps {
  match: Match;
  className?: string;
}

export function MatchCard({ match, className }: MatchCardProps) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  return (
    <Link
      href={`/partido/${match.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-[0_0_32px_-10px_hsl(var(--primary)/0.5)]",
        className,
      )}
    >
      {/* League header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {match.league.logo_url && (
            <Image
              src={match.league.logo_url}
              alt={match.league.name}
              width={16}
              height={16}
              sizes="16px"
              className="object-contain"
            />
          )}
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {match.league.name}
          </span>
        </div>
        {isLive && <Badge variant="live">EN VIVO · {match.minute}&apos;</Badge>}
        {match.has_value_bet && !isFinished && (
          <Badge variant="value" className="gap-1">
            <Sparkles className="h-3 w-3" />
            VALUE
          </Badge>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-2">
        <TeamRow
          name={match.home_team.name}
          logo={match.home_team.logo_url}
          score={match.home_score}
          showScore={isLive || isFinished}
        />
        <TeamRow
          name={match.away_team.name}
          logo={match.away_team.logo_url}
          score={match.away_score}
          showScore={isLive || isFinished}
        />
      </div>

      {/* Footer: kickoff or odds */}
      <div className="mt-4 border-t border-border/40 pt-3">
        {!isLive && !isFinished ? (
          match.best_odds ? (
            <OddsRow odds={match.best_odds} />
          ) : (
            <div className="text-center text-xs text-muted-foreground">
              {format(new Date(match.kickoff), "EEE d MMM · HH:mm", { locale: es })}
            </div>
          )
        ) : (
          <div className="text-center text-xs font-medium text-muted-foreground">
            {isFinished ? "Finalizado" : "En curso"}
          </div>
        )}
      </div>
    </Link>
  );
}

function TeamRow({
  name,
  logo,
  score,
  showScore,
}: {
  name: string;
  logo?: string;
  score?: number;
  showScore: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {logo ? (
          <Image src={logo} alt={name} width={24} height={24} sizes="24px" className="object-contain" />
        ) : (
          <div className="h-6 w-6 rounded-full bg-muted" />
        )}
        <span className="truncate text-sm font-medium">{name}</span>
      </div>
      {showScore && (
        <span className="font-mono text-base font-bold tabular-nums">{score ?? "-"}</span>
      )}
    </div>
  );
}

function OddsRow({ odds }: { odds: { home?: number; draw?: number; away?: number } }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <OddCell label="1" value={odds.home} />
      <OddCell label="X" value={odds.draw} />
      <OddCell label="2" value={odds.away} />
    </div>
  );
}

function OddCell({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center transition-colors group-hover:bg-primary/8 group-hover:ring-1 group-hover:ring-primary/20">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-bold tabular-nums">
        {value?.toFixed(2) ?? "-"}
      </div>
    </div>
  );
}
