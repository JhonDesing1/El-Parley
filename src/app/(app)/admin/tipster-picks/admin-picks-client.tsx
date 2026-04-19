"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { Plus, Search, Loader2, CheckCircle2, Trash2, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  createTipsterPickAction,
  resolveTipsterPickAction,
  deleteTipsterPickAction,
  togglePublishedAction,
  type TipsterPickInput,
} from "./actions";
import { getPickFormDataAction, type MatchOption } from "@/app/(app)/picks/actions";

// ── Constants ─────────────────────────────────────────────────────────────────

const MARKET_OPTIONS = [
  { value: "1x2", label: "Resultado final (1X2)" },
  { value: "btts", label: "Ambos anotan" },
  { value: "over_under_2_5", label: "Más/Menos 2.5 goles" },
  { value: "over_under_1_5", label: "Más/Menos 1.5 goles" },
  { value: "double_chance", label: "Doble oportunidad" },
  { value: "draw_no_bet", label: "Empate no apuesta" },
  { value: "asian_handicap", label: "Hándicap asiático" },
  { value: "correct_score", label: "Resultado exacto" },
];

const MARKET_SELECTIONS: Record<string, { value: string; label: string }[]> = {
  "1x2": [
    { value: "home", label: "Local" },
    { value: "draw", label: "Empate" },
    { value: "away", label: "Visitante" },
  ],
  btts: [
    { value: "yes", label: "Sí" },
    { value: "no", label: "No" },
  ],
  over_under_2_5: [
    { value: "over", label: "Más 2.5" },
    { value: "under", label: "Menos 2.5" },
  ],
  over_under_1_5: [
    { value: "over", label: "Más 1.5" },
    { value: "under", label: "Menos 1.5" },
  ],
  double_chance: [
    { value: "home_draw", label: "1X" },
    { value: "home_away", label: "12" },
    { value: "draw_away", label: "X2" },
  ],
  asian_handicap: [
    { value: "home", label: "Local" },
    { value: "away", label: "Visitante" },
  ],
  draw_no_bet: [
    { value: "home", label: "Local" },
    { value: "away", label: "Visitante" },
  ],
};

const RESULT_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  won:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  lost:    "bg-red-500/15 text-red-400 border-red-500/25",
  void:    "bg-muted/50 text-muted-foreground border-border/40",
};
const RESULT_LABELS: Record<string, string> = {
  pending: "Pendiente",
  won: "Ganado",
  lost: "Perdido",
  void: "Nulo",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TipsterPickRow {
  id: number;
  tipster_name: string;
  match_id: number | null;
  match_label: string | null;
  league_label: string | null;
  kickoff: string | null;
  market: string;
  selection: string;
  odds: number;
  stake_units: number;
  result: "pending" | "won" | "lost" | "void";
  profit_units: number | null;
  published: boolean;
  reasoning: string | null;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ── Create Pick Modal ─────────────────────────────────────────────────────────

function resetForm() {
  return {
    tipster_name: "El Parley",
    market: "1x2",
    selection: "home",
    customSelection: "",
    odds: "",
    stake_units: "1",
    reasoning: "",
    notes: "",
    useMatch: "true",
    matchLabel: "",
    leagueLabel: "",
    kickoff: "",
  };
}

export function CreatePickModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"match" | "details">("match");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<MatchOption | null>(null);
  const [form, setForm] = useState(resetForm());
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof ReturnType<typeof resetForm>>(
    key: K,
    value: ReturnType<typeof resetForm>[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getPickFormDataAction().then((data) => {
      setMatches(data.matches);
      setLoading(false);
    });
  }, [open]);

  useEffect(() => {
    const opts = MARKET_SELECTIONS[form.market];
    if (opts && opts.length > 0) {
      set("selection", opts[0].value);
      set("customSelection", "");
    } else {
      set("selection", "");
      set("customSelection", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.market]);

  const filteredMatches = useMemo(() => {
    if (!search.trim()) return matches.slice(0, 15);
    const q = search.toLowerCase();
    return matches
      .filter((m) => m.label.toLowerCase().includes(q) || m.league.toLowerCase().includes(q))
      .slice(0, 15);
  }, [matches, search]);

  function handleClose(v: boolean) {
    setOpen(v);
    if (!v) {
      setTimeout(() => {
        setStep("match");
        setSearch("");
        setSelectedMatch(null);
        setForm(resetForm());
        setSuccess(false);
        setError(null);
      }, 200);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const oddsVal = parseFloat(form.odds);
    if (!form.odds || oddsVal <= 1) {
      setError("La cuota debe ser mayor a 1.00");
      return;
    }

    const isCorrectScore = form.market === "correct_score";
    const finalSelection = isCorrectScore ? form.customSelection.trim() : form.selection;
    if (!finalSelection) {
      setError("Debes indicar una selección");
      return;
    }

    setError(null);

    const input: TipsterPickInput = {
      tipster_name: form.tipster_name || "El Parley",
      match_id: selectedMatch?.id ?? null,
      match_label: selectedMatch ? selectedMatch.label : form.matchLabel || undefined,
      league_label: selectedMatch ? selectedMatch.league : form.leagueLabel || undefined,
      kickoff: selectedMatch ? selectedMatch.kickoff : form.kickoff || undefined,
      market: form.market,
      selection: finalSelection,
      odds: oddsVal,
      stake_units: parseInt(form.stake_units) || 1,
      reasoning: form.reasoning || undefined,
      notes: form.notes || undefined,
    };

    startTransition(async () => {
      const result = await createTipsterPickAction(input);
      if (result.ok) {
        setSuccess(true);
      } else {
        setError(result.error ?? "Error desconocido");
      }
    });
  }

  const selectionOptions = MARKET_SELECTIONS[form.market] ?? [];
  const isCorrectScore = form.market === "correct_score";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo pick
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <DialogHeader>
              <DialogTitle>Pick publicado</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              El pick ya está visible en <strong>/picks</strong>.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
                Cerrar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSuccess(false);
                  setError(null);
                  setStep("match");
                  setSelectedMatch(null);
                  setSearch("");
                  setForm(resetForm());
                }}
              >
                Otro pick
              </Button>
            </div>
          </div>
        ) : step === "match" ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Nuevo pick de tipster</DialogTitle>
            </DialogHeader>

            {/* Toggle: buscar partido en BD vs texto libre */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={form.useMatch === "true" ? "default" : "outline"}
                onClick={() => set("useMatch", "true")}
              >
                Buscar partido
              </Button>
              <Button
                size="sm"
                variant={form.useMatch !== "true" ? "default" : "outline"}
                onClick={() => { set("useMatch", "false"); setStep("details"); }}
              >
                Texto libre
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                placeholder="Buscar equipo o liga..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMatches.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {search ? "Sin resultados." : "No hay partidos disponibles."}
              </p>
            ) : (
              <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-border/50">
                {filteredMatches.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMatch(m);
                      setStep("details");
                    }}
                    className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-muted ${
                      i === 0 ? "rounded-t-lg" : ""
                    } ${i === filteredMatches.length - 1 ? "rounded-b-lg" : "border-b border-border/40"}`}
                  >
                    <p className="text-sm font-semibold leading-snug">{m.label}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">{m.league}</span>
                      <span>·</span>
                      <span className="shrink-0">
                        {format(new Date(m.kickoff), "d MMM · HH:mm", { locale: es })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Detalles del pick</DialogTitle>
            </DialogHeader>

            {/* Partido seleccionado o texto libre */}
            {selectedMatch ? (
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-border/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{selectedMatch.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{selectedMatch.league}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-7 shrink-0 px-2 text-xs"
                  onClick={() => { setSelectedMatch(null); setStep("match"); }}
                  disabled={isPending}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-sm font-semibold">Partido</label>
                  <input
                    type="text"
                    placeholder="Real Madrid vs Barcelona"
                    value={form.matchLabel}
                    onChange={(e) => set("matchLabel", e.target.value)}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold">Liga</label>
                    <input
                      type="text"
                      placeholder="La Liga"
                      value={form.leagueLabel}
                      onChange={(e) => set("leagueLabel", e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold">Fecha/hora</label>
                    <input
                      type="datetime-local"
                      value={form.kickoff}
                      onChange={(e) => set("kickoff", e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tipster name */}
            <div className="space-y-1">
              <label className="text-sm font-semibold">Tipster</label>
              <input
                type="text"
                value={form.tipster_name}
                onChange={(e) => set("tipster_name", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Market */}
            <div className="space-y-1">
              <label className="text-sm font-semibold">Mercado</label>
              <select
                value={form.market}
                onChange={(e) => set("market", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MARKET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Selection */}
            <div className="space-y-1">
              <label className="text-sm font-semibold">Selección</label>
              {isCorrectScore || selectionOptions.length === 0 ? (
                <input
                  type="text"
                  placeholder="Ej: 2-1 o texto libre"
                  value={form.customSelection}
                  onChange={(e) => set("customSelection", e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectionOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set("selection", opt.value)}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-all ${
                        form.selection === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Odds + Stake units */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold">Cuota</label>
                <input
                  type="number"
                  min="1.01"
                  step="0.01"
                  placeholder="1.85"
                  value={form.odds}
                  onChange={(e) => set("odds", e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold">Unidades (1–10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  value={form.stake_units}
                  onChange={(e) => set("stake_units", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Reasoning */}
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                Razonamiento{" "}
                <span className="font-normal text-muted-foreground">(visible para usuarios)</span>
              </label>
              <textarea
                rows={3}
                placeholder="¿Por qué es un buen pick?"
                value={form.reasoning}
                onChange={(e) => set("reasoning", e.target.value)}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Notes (internal) */}
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                Notas internas{" "}
                <span className="font-normal text-muted-foreground">(solo admin)</span>
              </label>
              <input
                type="text"
                placeholder="Nota privada..."
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setStep("match")}
                disabled={isPending}
              >
                Atrás
              </Button>
              <Button type="submit" size="sm" className="flex-1 gap-2" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Publicar pick
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Resolve Button ─────────────────────────────────────────────────────────────

export function ResolvePickButtons({ pick }: { pick: TipsterPickRow }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (pick.result !== "pending") return null;

  function resolve(result: "won" | "lost" | "void") {
    setError(null);
    startTransition(async () => {
      const res = await resolveTipsterPickAction(pick.id, result);
      if (!res.ok) setError(res.error ?? "Error");
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10"
          onClick={() => resolve("won")}
          disabled={isPending}
        >
          Ganado
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs text-red-400 hover:border-red-500/50 hover:bg-red-500/10"
          onClick={() => resolve("lost")}
          disabled={isPending}
        >
          Perdido
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => resolve("void")}
          disabled={isPending}
        >
          Nulo
        </Button>
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

// ── Delete Button ─────────────────────────────────────────────────────────────

export function DeletePickButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("¿Eliminar este pick?")) return;
    startTransition(async () => {
      await deleteTipsterPickAction(id);
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

// ── Toggle Published Button ────────────────────────────────────────────────────

export function TogglePublishedButton({
  id,
  published,
}: {
  id: number;
  published: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await togglePublishedAction(id, !published);
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
      title={published ? "Despublicar" : "Publicar"}
      onClick={handleToggle}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : published ? (
        <Eye className="h-3.5 w-3.5" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

// ── Picks Table (display only — actions use the buttons above) ─────────────────

export function PicksTable({ picks }: { picks: TipsterPickRow[] }) {
  if (picks.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No hay picks aún. Crea el primero con el botón «Nuevo pick».
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {picks.map((pick) => {
        const matchName = pick.match_label ?? "—";
        const league = pick.league_label ?? "";
        const kickoff = pick.kickoff
          ? format(new Date(pick.kickoff), "d MMM HH:mm", { locale: es })
          : null;

        return (
          <Card key={pick.id} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              {/* Left */}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${RESULT_STYLES[pick.result]}`}
                  >
                    {RESULT_LABELS[pick.result]}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {pick.market}
                  </Badge>
                  {!pick.published && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      oculto
                    </Badge>
                  )}
                </div>

                <p className="truncate font-semibold">{matchName}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{pick.selection}</span>
                  {league && ` · ${league}`}
                  {kickoff && ` · ${kickoff}`}
                </p>

                {pick.reasoning && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {pick.reasoning}
                  </p>
                )}
              </div>

              {/* Right */}
              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <p className="font-mono text-lg font-bold tabular-nums">
                    {Number(pick.odds).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{pick.stake_units}u</p>
                  {pick.profit_units != null && (
                    <p
                      className={`text-sm font-bold tabular-nums ${
                        pick.profit_units >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {pick.profit_units >= 0 ? "+" : ""}
                      {pick.profit_units.toFixed(2)}u
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <ResolvePickButtons pick={pick} />
                  <TogglePublishedButton id={pick.id} published={pick.published} />
                  <DeletePickButton id={pick.id} />
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
