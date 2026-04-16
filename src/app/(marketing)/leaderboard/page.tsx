import Image from "next/image";
import { Trophy, TrendingUp, Target, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/utils/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ranking de Tipsters — El Parley",
  description:
    "Los mejores tipsters de Colombia según ROI auditado. Ranking transparente basado en picks reales.",
};

export const revalidate = 3600; // 1 hora

const MINIMUM_USERS = 30;

type LeaderboardRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  roi_30d: number;
  total_picks: number;
  win_rate: number;
  rank: number;
};

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: rows } = await supabase
    .from("leaderboard")
    .select("*")
    .order("rank", { ascending: true });

  const entries = (rows ?? []) as LeaderboardRow[];

  return (
    <div className="container max-w-4xl py-8">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-value">
          <Trophy className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-widest">Ranking</span>
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Tipsters del mes
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Clasificación por ROI auditado a 30 días. Solo aparecen usuarios con al menos 10
          picks registrados.
        </p>
      </header>

      {entries.length < MINIMUM_USERS ? (
        <Card className="p-12 text-center">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <h3 className="font-display text-xl font-bold">Ranking próximamente</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            El ranking se activará cuando haya suficientes tipsters activos en la plataforma.
            Registra tus picks ahora para aparecer entre los primeros.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Podio top 3 */}
          {entries.length >= 3 && (
            <div className="mb-8 flex flex-col gap-4 sm:grid sm:grid-cols-3 sm:gap-3">
              {[entries[1], entries[0], entries[2]].map((entry, i) => {
                const podiumRank = i === 0 ? 2 : i === 1 ? 1 : 3;
                const isCenter = podiumRank === 1;
                return (
                  <PodiumCard
                    key={entry.id}
                    entry={entry}
                    podiumRank={podiumRank}
                    isCenter={isCenter}
                    isCurrentUser={entry.id === user?.id}
                  />
                );
              })}
            </div>
          )}

          {/* Tabla completa */}
          <Card className="overflow-hidden">
            <div className="divide-y divide-border/40">
              {entries.map((entry) => (
                <LeaderboardRow
                  key={entry.id}
                  entry={entry}
                  isCurrentUser={entry.id === user?.id}
                />
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Podio ────────────────────────────────────────────────────
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const PODIUM_HEIGHTS: Record<number, string> = {
  1: "pt-0",
  2: "pt-6",
  3: "pt-10",
};

function PodiumCard({
  entry,
  podiumRank,
  isCenter,
  isCurrentUser,
}: {
  entry: LeaderboardRow;
  podiumRank: number;
  isCenter: boolean;
  isCurrentUser: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center", PODIUM_HEIGHTS[podiumRank])}>
      <Card
        className={cn(
          "w-full p-4 text-center",
          isCenter && "ring-2 ring-value",
          isCurrentUser && "ring-2 ring-primary",
        )}
      >
        <div className="text-2xl">{MEDAL[podiumRank]}</div>
        <Avatar url={entry.avatar_url} username={entry.username} size={48} className="mx-auto mt-2" />
        <div className="mt-2 truncate text-sm font-bold">
          {entry.username ?? "Anónimo"}
        </div>
        <div
          className={cn(
            "mt-1 font-mono text-lg font-bold",
            entry.roi_30d >= 0 ? "text-value" : "text-destructive",
          )}
        >
          {entry.roi_30d >= 0 ? "+" : ""}
          {entry.roi_30d.toFixed(1)}%
        </div>
        <div className="text-xs text-muted-foreground">ROI 30d</div>
      </Card>
    </div>
  );
}

// ─── Fila de tabla ─────────────────────────────────────────────
function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardRow;
  isCurrentUser: boolean;
}) {
  const rankEmoji = MEDAL[entry.rank];

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-5 py-3.5 transition-colors",
        isCurrentUser && "bg-value/5 ring-1 ring-inset ring-value/20",
      )}
    >
      {/* Rank */}
      <div className="w-8 shrink-0 text-center">
        {rankEmoji ? (
          <span className="text-lg">{rankEmoji}</span>
        ) : (
          <span className="font-mono text-sm font-bold text-muted-foreground">
            {entry.rank}
          </span>
        )}
      </div>

      {/* Avatar + nombre */}
      <Avatar url={entry.avatar_url} username={entry.username} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">
            {entry.username ?? "Anónimo"}
          </span>
          {isCurrentUser && (
            <Badge variant="outline" className="text-[10px]">
              Tú
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {entry.total_picks} picks · {entry.win_rate.toFixed(0)}% win rate
        </div>
        {/* Stats extra en móvil */}
        <div className="mt-1 flex items-center gap-3 sm:hidden">
          <span className="font-mono text-xs font-bold tabular-nums">
            {entry.win_rate.toFixed(1)}% WR
          </span>
          <span className="text-xs text-muted-foreground">{entry.total_picks} picks</span>
        </div>
      </div>

      {/* Stats — visibles en sm+; en móvil se muestran bajo el nombre */}
      <div className="hidden items-center gap-6 sm:flex">
        <Stat
          icon={Target}
          label="Win rate"
          value={`${entry.win_rate.toFixed(1)}%`}
        />
        <Stat
          icon={Sparkles}
          label="Picks"
          value={String(entry.total_picks)}
        />
      </div>

      {/* ROI — siempre visible */}
      <div className="shrink-0 text-right">
        <div
          className={cn(
            "font-mono text-base font-bold tabular-nums",
            entry.roi_30d >= 0 ? "text-value" : "text-destructive",
          )}
        >
          {entry.roi_30d >= 0 ? "+" : ""}
          {entry.roi_30d.toFixed(1)}%
        </div>
        <div className="flex items-center justify-end gap-0.5 text-[10px] text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          ROI 30d
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────
function Avatar({
  url,
  username,
  size,
  className,
}: {
  url: string | null;
  username: string | null;
  size: number;
  className?: string;
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt={username ?? "Usuario"}
        width={size}
        height={size}
        sizes={`${size}px`}
        className={cn("rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted font-bold uppercase text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(username ?? "?")[0]}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="text-right">
      <div className="font-mono text-sm font-bold tabular-nums">{value}</div>
      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
    </div>
  );
}
