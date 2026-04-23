"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { registerPickAction } from "@/app/(app)/picks/actions";
import type { MarketType } from "@/types";

const MARKET_LABELS: Record<string, string> = {
  "1x2": "Resultado final (1X2)",
  btts: "Ambos anotan",
  over_under_2_5: "Más/Menos 2.5",
  over_under_1_5: "Más/Menos 1.5",
  double_chance: "Doble oportunidad",
  correct_score: "Resultado exacto",
  asian_handicap: "Hándicap asiático",
  draw_no_bet: "Empate no apuesta",
};

const SELECTION_LABELS: Record<string, string> = {
  home: "Local",
  draw: "Empate",
  away: "Visitante",
  over: "Más",
  under: "Menos",
  yes: "Sí",
  no: "No",
};

export interface RegisterPickModalProps {
  matchId: number;
  matchLabel: string;
  market: MarketType;
  selection: string;
  odds: number;
  bookmakerName?: string;
  bookmakerId?: number;
  valueBetId?: number;
  line?: number;
  /** Modo controlado: si se pasan estas props, el Dialog es externo */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Si no hay trigger externo, muestra el botón por defecto */
  hideTrigger?: boolean;
}

export function RegisterPickModal({
  matchId,
  matchLabel,
  market,
  selection,
  odds,
  bookmakerName,
  bookmakerId,
  valueBetId,
  line,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: RegisterPickModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function setOpen(v: boolean) {
    if (isControlled) {
      controlledOnOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  }
  const [stake, setStake] = useState("");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectionLabel =
    SELECTION_LABELS[selection] ?? selection;
  const marketLabel = MARKET_LABELS[market] ?? market;
  const potentialReturn = stake
    ? (parseFloat(stake) * odds).toFixed(2)
    : null;

  function handleOpen(v: boolean) {
    setOpen(v);
    if (!v) {
      // Reset on close
      setTimeout(() => {
        setSuccess(false);
        setError(null);
        setStake("");
        setNotes("");
      }, 200);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await registerPickAction({
        matchId,
        market,
        selection,
        odds,
        bookmakerId,
        valueBetId,
        stake: stake ? parseFloat(stake) : undefined,
        line: line ?? undefined,
        notes: notes || undefined,
      });

      if (result.ok) {
        setSuccess(true);
      } else {
        setError(result.error ?? "Error desconocido");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full gap-2">
            <ClipboardList className="h-4 w-4" />
            Registrar apuesta
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-sm">
        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <DialogHeader>
              <DialogTitle>Apuesta registrada</DialogTitle>
              <DialogDescription>
                Tu apuesta quedó guardada. La verás en{" "}
                <a href="/mis-picks" className="underline underline-offset-2 hover:text-foreground">
                  Mis Apuestas
                </a>{" "}
                cuando el partido termine.
              </DialogDescription>
            </DialogHeader>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Registrar apuesta</DialogTitle>
              <DialogDescription className="truncate">{matchLabel}</DialogDescription>
            </DialogHeader>

            {/* Pick summary */}
            <div className="rounded-lg bg-muted/40 p-4 ring-1 ring-border/40">
              <div className="mb-3 flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  {marketLabel}
                </Badge>
                {bookmakerName && (
                  <span className="text-xs text-muted-foreground">{bookmakerName}</span>
                )}
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Selección
                  </p>
                  <p className="font-display text-xl font-bold">{selectionLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Cuota
                  </p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-value">
                    {odds.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Stake (opcional) */}
            <div className="space-y-1.5">
              <label htmlFor="pick-stake" className="text-sm font-semibold">
                Stake (opcional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <input
                  id="pick-stake"
                  type="number"
                  min="1"
                  step="1000"
                  placeholder="0"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="w-full rounded-md border border-input bg-background py-2 pl-7 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              {potentialReturn && (
                <p className="text-xs text-muted-foreground">
                  Retorno potencial:{" "}
                  <span className="font-semibold text-emerald-400">
                    ${parseFloat(potentialReturn).toLocaleString("es-CO")}
                  </span>
                </p>
              )}
            </div>

            {/* Notas (opcional) */}
            <div className="space-y-1.5">
              <label htmlFor="pick-notes" className="text-sm font-semibold">
                Notas (opcional)
              </label>
              <textarea
                id="pick-notes"
                rows={2}
                placeholder="¿Por qué te gusta esta apuesta?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="flex-1 gap-2"
                disabled={isPending}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar
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
