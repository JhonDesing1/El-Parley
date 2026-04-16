"use client";

import { useState } from "react";
import { Calculator, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { kellyFraction } from "@/lib/betting/kelly";

export function KellyCalculator() {
  const [bankroll, setBankroll] = useState("1000000");
  const [odds, setOdds] = useState("2.10");
  const [prob, setProb] = useState("55");
  const [fraction, setFraction] = useState<"0.25" | "0.5" | "1">("0.25");

  const bankrollNum = parseFloat(bankroll.replace(/\./g, "").replace(",", ".")) || 0;
  const oddsNum = parseFloat(odds.replace(",", ".")) || 0;
  const probNum = parseFloat(prob.replace(",", ".")) / 100 || 0;

  const fractionMap = { "0.25": 0.25 as const, "0.5": 0.5 as const, "1": 1 as const };
  const kelly = oddsNum > 1 && probNum > 0 && probNum < 1
    ? kellyFraction(probNum, oddsNum, fractionMap[fraction])
    : 0;

  const stakeAmount = Math.round(bankrollNum * kelly);
  const expectedValue = probNum * (oddsNum - 1) - (1 - probNum);
  const isValue = expectedValue > 0.03;

  function fmt(n: number) {
    return n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" />
          Calculadora de stake — Kelly
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Inputs */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bankroll (COP)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={bankroll}
              onChange={(e) => setBankroll(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="1.000.000"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cuota decimal
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="2.10"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tu probabilidad estimada (%)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={prob}
              onChange={(e) => setProb(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="55"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fracción Kelly
            </label>
            <div className="flex gap-1.5">
              {(["0.25", "0.5", "1"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFraction(f)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-colors ${
                    fraction === f
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {f === "0.25" ? "¼ Kelly" : f === "0.5" ? "½ Kelly" : "Kelly completo"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
          {stakeAmount > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Stake sugerido
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-primary">
                  ${fmt(stakeAmount)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {(kelly * 100).toFixed(2)}% del bankroll
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor esperado
                </div>
                <div
                  className={`mt-1 font-mono text-2xl font-bold ${
                    expectedValue > 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {expectedValue >= 0 ? "+" : ""}
                  {(expectedValue * 100).toFixed(1)}%
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">por unidad apostada</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ganancia potencial
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-emerald-400">
                  +${fmt(Math.round(stakeAmount * (oddsNum - 1)))}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  a cuota {oddsNum.toFixed(2)}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Ingresa valores válidos para calcular el stake óptimo.
            </p>
          )}
        </div>

        {/* Warnings */}
        {stakeAmount > 0 && !isValue && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-xs text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              El valor esperado es menor al 3% de edge mínimo recomendado. Esta apuesta puede no ser
              rentable a largo plazo.
            </span>
          </div>
        )}
        {stakeAmount > 0 && isValue && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/8 p-3 text-xs text-emerald-400">
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Esta apuesta tiene valor positivo (+{(expectedValue * 100).toFixed(1)}% edge). El
              ¼ Kelly te protege de la varianza mientras capturas el EV a largo plazo.
            </span>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          * El stake está limitado al 5% del bankroll por seguridad, aunque Kelly sugiera más.
          Nunca apostes más de lo que estás dispuesto a perder.
        </p>
      </CardContent>
    </Card>
  );
}
