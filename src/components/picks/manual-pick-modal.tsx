"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { Plus, Search, Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getPickFormDataAction,
  registerPickAction,
  type MatchOption,
  type BookmakerOption,
} from "@/app/(app)/picks/actions";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { MarketType } from "@/types";

const MARKET_OPTIONS: { value: MarketType; label: string }[] = [
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
    { value: "home_draw", label: "Local o Empate (1X)" },
    { value: "home_away", label: "Local o Visitante (12)" },
    { value: "draw_away", label: "Empate o Visitante (X2)" },
  ],
  asian_handicap: [
    { value: "home", label: "Local" },
    { value: "away", label: "Visitante" },
  ],
  draw_no_bet: [
    { value: "home", label: "Local" },
    { value: "away", label: "Visitante" },
  ],
  correct_score: [],
};

function resetForm() {
  return {
    market: "1x2" as MarketType,
    selection: "home",
    customSelection: "",
    odds: "",
    line: "",
    bookmakerId: "",
    stake: "",
    notes: "",
  };
}

export function ManualPickModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"match" | "details">("match");

  // Initial data
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [bookmakers, setBookmakers] = useState<BookmakerOption[]>([]);

  // Match search
  const [search, setSearch] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<MatchOption | null>(null);

  // Pick fields
  const [form, setForm] = useState(resetForm());

  // Submit state
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof ReturnType<typeof resetForm>>(
    key: K,
    value: ReturnType<typeof resetForm>[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Load matches + bookmakers once on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getPickFormDataAction().then((data) => {
      setMatches(data.matches);
      setBookmakers(data.bookmakers);
      setLoading(false);
    });
  }, [open]);

  // Reset selection when market changes
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

  const selectionOptions = MARKET_SELECTIONS[form.market] ?? [];
  const isCorrectScore = form.market === "correct_score";
  const isAsianHandicap = form.market === "asian_handicap";
  const potentialReturn =
    form.odds && form.stake
      ? Math.round(parseFloat(form.odds) * parseFloat(form.stake)).toLocaleString("es-CO")
      : null;

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
    if (!selectedMatch) return;

    const oddsVal = parseFloat(form.odds);
    if (!form.odds || oddsVal < 1.01) {
      setError("La cuota debe ser mayor a 1.01");
      return;
    }

    const finalSelection = isCorrectScore ? form.customSelection.trim() : form.selection;
    if (!finalSelection) {
      setError("Debes indicar una selección");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await registerPickAction({
        matchId: selectedMatch.id,
        market: form.market,
        selection: finalSelection,
        odds: oddsVal,
        bookmakerId: form.bookmakerId ? parseInt(form.bookmakerId) : undefined,
        stake: form.stake ? parseFloat(form.stake) : undefined,
        line: form.line ? parseFloat(form.line) : undefined,
        notes: form.notes || undefined,
      });

      if (result.ok) {
        setSuccess(true);
      } else {
        setError(result.error ?? "Error desconocido");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Registrar pick
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        {/* ── Success state ── */}
        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <DialogHeader>
              <DialogTitle>Pick registrado</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Tu pick quedó guardado. Aparecerá como <strong>Pendiente</strong> hasta que el partido
              termine.
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
                Registrar otro
              </Button>
            </div>
          </div>
        ) : step === "match" ? (
          /* ── Step 1: select match ── */
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Registrar pick manual</DialogTitle>
            </DialogHeader>

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
                {search ? "Sin resultados para esa búsqueda." : "No hay partidos disponibles próximamente."}
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
                      <span className="shrink-0">·</span>
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
          /* ── Step 2: pick details ── */
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Registrar pick</DialogTitle>
            </DialogHeader>

            {/* Selected match chip */}
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-border/40">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selectedMatch?.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{selectedMatch?.league}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-2 h-7 shrink-0 px-2 text-xs"
                onClick={() => setStep("match")}
                disabled={isPending}
              >
                Cambiar
              </Button>
            </div>

            {/* Market */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Mercado</label>
              <select
                value={form.market}
                onChange={(e) => set("market", e.target.value as MarketType)}
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
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Selección</label>
              {isCorrectScore ? (
                <input
                  type="text"
                  placeholder="Ej: 2-1"
                  value={form.customSelection}
                  onChange={(e) => set("customSelection", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

            {/* Odds + Line */}
            <div className={`grid gap-3 ${isAsianHandicap ? "grid-cols-2" : "grid-cols-1"}`}>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Cuota</label>
                <input
                  type="number"
                  min="1.01"
                  step="0.01"
                  placeholder="1.85"
                  value={form.odds}
                  onChange={(e) => set("odds", e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              {isAsianHandicap && (
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Línea</label>
                  <input
                    type="number"
                    step="0.25"
                    placeholder="-0.5"
                    value={form.line}
                    onChange={(e) => set("line", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              )}
            </div>

            {/* Bookmaker */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">
                Casa de apuestas{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <select
                value={form.bookmakerId}
                onChange={(e) => set("bookmakerId", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">No especificada</option>
                {bookmakers.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stake */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">
                Stake{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  step="1000"
                  placeholder="0"
                  value={form.stake}
                  onChange={(e) => set("stake", e.target.value)}
                  className="w-full rounded-md border border-input bg-background py-2 pl-7 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              {potentialReturn && (
                <p className="text-xs text-muted-foreground">
                  Retorno potencial:{" "}
                  <span className="font-semibold text-emerald-400">${potentialReturn}</span>
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">
                Notas{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="¿Por qué te gusta este pick?"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              <Button
                type="submit"
                size="sm"
                className="flex-1 gap-2"
                disabled={isPending || !form.odds}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar pick
              </Button>
            </div>

            <p className="text-center text-[10px] text-muted-foreground">
              Solo para seguimiento personal. No implica depósito real.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
