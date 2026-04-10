import { cn } from "@/lib/utils/cn";

interface TickerMatch {
  match_id: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  league_name: string;
}

export function LiveTicker({ matches = [] }: { matches?: TickerMatch[] }) {
  if (!matches || matches.length === 0) return null;

  // Duplicamos para loop infinito sin saltos
  const items = [...matches, ...matches];

  return (
    <div className="border-y border-border bg-card/50 py-3 overflow-hidden">
      <div className="flex items-center gap-3 container mb-2">
        <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-live">
          <span className="h-2 w-2 animate-live-pulse rounded-full bg-live" />
          En vivo
        </span>
      </div>
      <div className="relative flex overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {items.map((m, i) => (
            <div
              key={`${m.match_id}-${i}`}
              className="mx-8 flex items-center gap-3 font-mono text-sm"
            >
              <span className="text-muted-foreground">{m.league_name}</span>
              <span className="font-semibold">{m.home_team}</span>
              <span className={cn("rounded bg-live/20 px-2 py-0.5 font-bold tabular-nums text-live")}>
                {m.home_score ?? 0} – {m.away_score ?? 0}
              </span>
              <span className="font-semibold">{m.away_team}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
