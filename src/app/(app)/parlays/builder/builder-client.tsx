"use client";

import Image from "next/image";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Plus,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Calculator,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatKickoff, formatCOP } from "@/lib/utils/format";
import { calculateParlay } from "@/lib/betting/parlay-calculator";
import { saveParlayAction } from "./actions";

// ─── Tipos ────────────────────────────────────────────────────

interface MatchData {
  id: number;
  kickoff: string;
  status: string;
  home_team: { id: number; name: string; short_name?: string; logo_url?: string };
  away_team: { id: number; name: string; short_name?: string; logo_url?: string };
  league: { id: number; name: string; country: string; logo_url?: string };
}

interface OddsEntry {
  price: number;
  bookmaker: { id: number; slug: string; name: string };
}

interface BuiltLeg {
  matchId: number;
  matchLabel: string;
  market: string;
  selection: string;
  selectionLabel: string;
  price: number;
  bookmakerId?: number;
  bookmakerSlug?: string;
  bookmakerName?: string;
}

const MARKET_LABELS: Record<string, string> = {
  "1x2": "1X2",
  btts: "Ambos anotan",
  over_under_2_5: "Más/Menos 2.5",
};

const SELECTION_LABELS: Record<string, Record<string, string>> = {
  "1x2": { home: "1 Local", draw: "X Empate", away: "2 Visitante" },
  btts: { yes: "Sí", no: "No" },
  over_under_2_5: { over: "Más 2.5", under: "Menos 2.5" },
};

const MARKET_SELECTIONS: Record<string, string[]> = {
  "1x2": ["home", "draw", "away"],
  btts: ["yes", "no"],
  over_under_2_5: ["over", "under"],
};

// ─── Componente principal ──────────────────────────────────────

export function ParlayBuilderClient({
  matches,
  bestOdds,
  seedLegs,
  userId,
}: {
  matches: MatchData[];
  bestOdds: Record<string, OddsEntry>;
  seedLegs: any[];
  userId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [legs, setLegs] = useState<BuiltLeg[]>(() => {
    // Hidratar desde seedLegs si vienen de ?from=
    return seedLegs.map((sl: any) => ({
      matchId: sl.match_id,
      matchLabel: sl.match
        ? `${sl.match.home_team?.name} vs ${sl.match.away_team?.name}`
        : `Partido #${sl.match_id}`,
      market: sl.market,
      selection: sl.selection,
      selectionLabel:
        SELECTION_LABELS[sl.market]?.[sl.selection] ?? sl.selection,
      price: sl.price,
      bookmakerId: sl.bookmaker?.id,
      bookmakerSlug: sl.bookmaker?.slug,
      bookmakerName: sl.bookmaker?.name,
    }));
  });
  const [stake, setStake] = useState<string>("");
  const [parlayName, setParlayName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Mobile: mostrar slip (true) o lista (false)
  const [showSlip, setShowSlip] = useState(false);

  // Filtrar partidos por búsqueda
  const filtered = useMemo(() => {
    if (!query.trim()) return matches;
    const q = query.toLowerCase();
    return matches.filter(
      (m) =>
        m.home_team.name.toLowerCase().includes(q) ||
        m.away_team.name.toLowerCase().includes(q) ||
        m.league.name.toLowerCase().includes(q),
    );
  }, [matches, query]);

  // Resultado del calculador
  const parlayResult = useMemo(() => {
    if (legs.length < 2) return null;
    try {
      return calculateParlay(
        legs.map((l) => ({
          matchId: l.matchId,
          market: l.market,
          selection: l.selection,
          decimalOdds: l.price,
        })),
      );
    } catch {
      return null;
    }
  }, [legs]);

  const stakeNum = parseFloat(stake.replace(/\./g, "").replace(",", ".")) || 0;
  const potentialReturn = parlayResult && stakeNum > 0
    ? stakeNum * parlayResult.totalOdds
    : null;

  function getOdd(matchId: number, market: string, selection: string): OddsEntry | undefined {
    return bestOdds[`${matchId}__${market}__${selection}`];
  }

  function addLeg(match: MatchData, market: string, selection: string) {
    const odd = getOdd(match.id, market, selection);
    if (!odd) return;
    // Evitar duplicado exacto
    const exists = legs.some(
      (l) => l.matchId === match.id && l.market === market && l.selection === selection,
    );
    if (exists) return;
    setLegs((prev) => [
      ...prev,
      {
        matchId: match.id,
        matchLabel: `${match.home_team.name} vs ${match.away_team.name}`,
        market,
        selection,
        selectionLabel: SELECTION_LABELS[market]?.[selection] ?? selection,
        price: odd.price,
        bookmakerId: odd.bookmaker.id,
        bookmakerSlug: odd.bookmaker.slug,
        bookmakerName: odd.bookmaker.name,
      },
    ]);
    setSaved(false);
    setSaveError(null);
    if (window.innerWidth < 768) setShowSlip(true);
  }

  function removeLeg(idx: number) {
    setLegs((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  function handleSave() {
    if (legs.length < 2 || !parlayResult) return;
    startTransition(async () => {
      const result = await saveParlayAction(
        parlayName,
        stakeNum > 0 ? stakeNum : null,
        parlayResult.totalOdds,
        legs.map((l) => ({
          matchId: l.matchId,
          matchLabel: l.matchLabel,
          market: l.market,
          selection: l.selection,
          price: l.price,
          bookmakerSlug: l.bookmakerSlug,
          bookmakerId: l.bookmakerId,
        })),
      );
      if (result.ok) {
        setSaved(true);
        setSaveError(null);
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        setSaveError(result.error ?? "Error al guardar");
      }
    });
  }

  const isLegActive = (matchId: number, market: string, selection: string) =>
    legs.some(
      (l) => l.matchId === matchId && l.market === market && l.selection === selection,
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* ── LISTA DE PARTIDOS ── */}
      <div className={cn("space-y-4", showSlip && "hidden lg:block")}>
        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar equipo o liga…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-4 text-sm outline-none ring-0 transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-muted-foreground">
              {matches.length === 0
                ? "No hay partidos disponibles en las próximas 48 horas."
                : "Sin resultados para esa búsqueda."}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((match) => {
              const open = expandedMatch === match.id;
              const legsInMatch = legs.filter((l) => l.matchId === match.id).length;
              return (
                <Card key={match.id} className="overflow-hidden">
                  {/* Header del partido */}
                  <button
                    onClick={() => setExpandedMatch(open ? null : match.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                  >
                    {match.league.logo_url && (
                      <Image
                        src={match.league.logo_url}
                        alt={match.league.name}
                        width={16}
                        height={16}
                        sizes="16px"
                        className="shrink-0 object-contain"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {match.home_team.name} vs {match.away_team.name}
                        </span>
                        {legsInMatch > 0 && (
                          <Badge variant="value" className="shrink-0 text-[10px]">
                            {legsInMatch} leg{legsInMatch > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{match.league.name}</span>
                        <span>·</span>
                        <span>{formatKickoff(match.kickoff)}</span>
                      </div>
                    </div>
                    {open ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {/* Mercados expandidos */}
                  {open && (
                    <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-3">
                      {Object.entries(MARKET_SELECTIONS).map(([market, selections]) => {
                        const hasAny = selections.some((s) => getOdd(match.id, market, s));
                        if (!hasAny) return null;
                        return (
                          <div key={market}>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              {MARKET_LABELS[market]}
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {selections.map((sel) => {
                                const odd = getOdd(match.id, market, sel);
                                const active = isLegActive(match.id, market, sel);
                                return (
                                  <button
                                    key={sel}
                                    disabled={!odd}
                                    onClick={() => {
                                      if (active) {
                                        const idx = legs.findIndex(
                                          (l) =>
                                            l.matchId === match.id &&
                                            l.market === market &&
                                            l.selection === sel,
                                        );
                                        if (idx !== -1) removeLeg(idx);
                                      } else {
                                        addLeg(match, market, sel);
                                      }
                                    }}
                                    className={cn(
                                      "relative flex flex-col items-center rounded-lg border px-2 py-2 text-center transition-all",
                                      active
                                        ? "border-primary bg-primary/10 text-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)]"
                                        : odd
                                          ? "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5"
                                          : "cursor-not-allowed border-border/30 opacity-40",
                                    )}
                                  >
                                    <span className="text-[10px] font-semibold text-muted-foreground">
                                      {SELECTION_LABELS[market]?.[sel] ?? sel}
                                    </span>
                                    <span
                                      className={cn(
                                        "font-mono text-sm font-black tabular-nums",
                                        active ? "text-primary" : "text-foreground",
                                      )}
                                    >
                                      {odd ? odd.price.toFixed(2) : "—"}
                                    </span>
                                    {odd && !active && (
                                      <Plus className="absolute right-1.5 top-1.5 h-3 w-3 text-muted-foreground/50" />
                                    )}
                                    {active && (
                                      <CheckCircle2 className="absolute right-1.5 top-1.5 h-3 w-3 text-primary" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PARLAY SLIP ── */}
      <div className={cn("space-y-4", !showSlip && "hidden lg:block")}>
        {/* Botón volver a lista en mobile */}
        <button
          onClick={() => setShowSlip(false)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:hidden"
        >
          ← Volver a partidos
        </button>

        <Card className="sticky top-20">
          {/* Header del slip */}
          <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <span className="font-display font-bold">Mi Parlay</span>
              {legs.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {legs.length} leg{legs.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {legs.length > 0 && (
              <button
                onClick={() => { setLegs([]); setSaved(false); }}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="p-5 space-y-4">
            {legs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-semibold">Tu parlay está vacío</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecciona cuotas de los partidos para añadir legs
                </p>
              </div>
            ) : (
              <>
                {/* Legs */}
                <div className="space-y-2">
                  {legs.map((leg, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="truncate font-semibold text-foreground">
                          {leg.matchLabel}
                        </p>
                        <p className="text-muted-foreground">
                          {MARKET_LABELS[leg.market]} · {leg.selectionLabel}
                        </p>
                        {leg.bookmakerName && (
                          <p className="text-muted-foreground/70">{leg.bookmakerName}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-sm font-black text-primary">
                          {leg.price.toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeLeg(idx)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Warnings */}
                {(parlayResult?.warnings ?? []).length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                    {parlayResult!.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-amber-500">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}

                {/* Stats */}
                {parlayResult && (
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-4">
                    <SlipStat
                      label="Cuota total"
                      value={`x${parlayResult.totalOdds.toFixed(2)}`}
                      highlight
                    />
                    <SlipStat
                      label="Prob. combinada"
                      value={`${(parlayResult.combinedImpliedProb * 100).toFixed(1)}%`}
                    />
                    {parlayResult.edge !== undefined && (
                      <SlipStat
                        label="Edge"
                        value={`${parlayResult.edge >= 0 ? "+" : ""}${(parlayResult.edge * 100).toFixed(1)}%`}
                        positive={parlayResult.edge >= 0}
                      />
                    )}
                    {parlayResult.isValue && (
                      <div className="col-span-2 flex items-center gap-1.5 rounded-md bg-value/10 px-2.5 py-1.5 text-xs font-bold text-value">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Parlay con valor esperado positivo (+5% edge)
                      </div>
                    )}
                  </div>
                )}

                {/* Stake */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Monto a apostar (COP)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 50.000"
                    value={stake}
                    onChange={(e) => setStake(e.target.value.replace(/[^\d.,]/g, ""))}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  />
                  {potentialReturn !== null && potentialReturn > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Retorno potencial:{" "}
                      <span className="font-bold text-value">{formatCOP(potentialReturn)}</span>
                    </p>
                  )}
                </div>

                {/* Nombre */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Nombre del parlay (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder={`Parlay ${new Date().toLocaleDateString("es-CO")}`}
                    value={parlayName}
                    onChange={(e) => setParlayName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  />
                </div>

                {/* Error */}
                {saveError && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {saveError}
                  </p>
                )}

                {/* CTA */}
                {saved ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-value/10 py-3 text-sm font-bold text-value">
                    <CheckCircle2 className="h-4 w-4" />
                    Guardado — redirigiendo…
                  </div>
                ) : (
                  <Button
                    onClick={handleSave}
                    disabled={legs.length < 2 || isPending}
                    className="w-full glow-primary"
                    size="lg"
                  >
                    {isPending ? "Guardando…" : "Guardar parlay"}
                  </Button>
                )}
                <p className="text-center text-[11px] text-muted-foreground">
                  Se guarda en tu dashboard. Solo es un registro personal — la apuesta la
                  colocas directamente en el bookmaker.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* FAB mobile: toggle entre lista y slip */}
      <button
        onClick={() => setShowSlip((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold shadow-lg transition-all lg:hidden",
          showSlip
            ? "bg-muted text-foreground"
            : "glow-primary bg-primary text-primary-foreground",
        )}
      >
        {showSlip ? (
          <>
            <Search className="h-4 w-4" />
            Partidos
          </>
        ) : (
          <>
            <Calculator className="h-4 w-4" />
            Slip
            {legs.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground/20 text-xs">
                {legs.length}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}

function SlipStat({
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
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-lg font-black tabular-nums",
          highlight && "text-primary",
          positive === true && "text-value",
          positive === false && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
