import { createClient } from "@/lib/supabase/server";
import { ParlayCard } from "@/components/parlay/parlay-card";
import { FunBetCard } from "@/components/parlay/funbet-card";
import { Combinada80Card } from "@/components/parlay/combinada80-card";
import { Combinada90Card } from "@/components/parlay/combinada90-card";
import { isPremiumUser } from "@/lib/utils/auth";
import { Layers, Lock, RefreshCw, Crown, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Combinadas del día — El Parley",
  description:
    "Combinadas con probabilidad matemática superior al 80%. FunBet diario con cuota x30.",
};

export const revalidate = 600; // 10 min

export default async function ParlaysPage() {
  const supabase = await createClient();
  const isPremium = await isPremiumUser();

  const { data: parlays } = await supabase
    .from("parlays")
    .select(
      `
      *,
      legs:parlay_legs(
        *,
        match:matches(
          *,
          home_team:teams!home_team_id(*),
          away_team:teams!away_team_id(*),
          league:leagues(*)
        ),
        bookmaker:bookmakers(*)
      )
      `,
    )
    .gte("valid_until", new Date().toISOString())
    .order("created_at", { ascending: false });

  // Separar por tipo usando la convención de título
  const isFunBet = (p: any) => (p.title as string)?.startsWith("FunBet");
  const isCombi80 = (p: any) => (p.title as string)?.startsWith("Combinada 80%");
  const isCombi90 = (p: any) => (p.title as string)?.startsWith("Combinada 90%");

  const allFunBets = (parlays ?? []).filter(isFunBet);
  const allCombinadas80 = (parlays ?? []).filter(isCombi80);
  const allCombinadas90 = (parlays ?? []).filter(isCombi90);
  const allRegularParlays = (parlays ?? []).filter(
    (p) => !isFunBet(p) && !isCombi80(p) && !isCombi90(p),
  );

  // Política por tier:
  //   Free    → 1 combinada + 1 funbet
  //   Premium → 3 combinadas + 2 funbets
  const maxCombinadas = isPremium ? 3 : 1;
  const maxFunBets = isPremium ? 2 : 1;

  // Para premium priorizamos 90% (mayor probabilidad) → 80% → regulares.
  // Para free priorizamos la combinada más segura que podamos mostrar sin blur.
  const combinadasOrdered = isPremium
    ? [...allCombinadas90, ...allCombinadas80, ...allRegularParlays.filter((p: any) => p.tier !== "free"), ...allRegularParlays.filter((p: any) => p.tier === "free")]
    : [...allCombinadas80, ...allRegularParlays.filter((p: any) => p.tier === "free"), ...allCombinadas90, ...allRegularParlays.filter((p: any) => p.tier !== "free")];

  const combinadas = combinadasOrdered.slice(0, maxCombinadas);
  const funBets = allFunBets.slice(0, maxFunBets);

  const lastGenerated =
    parlays && parlays.length > 0 && parlays[0].created_at
      ? new Date(parlays[0].created_at).toLocaleString("es-CO", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  const hasContent = (parlays ?? []).length > 0;

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            Combinadas del día
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Tres tipos de combinada: segura (80%+ de probabilidad), de valor (edge positivo)
            y FunBet (alto riesgo, máxima emoción).
          </p>
        </div>
        {lastGenerated && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            <span>Actualizado {lastGenerated}</span>
          </div>
        )}
      </header>

      {!hasContent ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {/* ── Combinadas ───────────────────────────────────────── */}
          {combinadas.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
                    Combinadas de valor
                    {isPremium && (
                      <Badge variant="premium" className="gap-1">
                        <Crown className="h-3 w-3" />
                        PREMIUM
                      </Badge>
                    )}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {isPremium
                      ? "3 combinadas diarias priorizando ligas top del mundo. Modelo Poisson + xG."
                      : "1 combinada diaria gratis. Upgrade a Premium para ver 3 combinadas."}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {combinadas.length}/{maxCombinadas}
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {combinadas.map((p: any) => {
                  const premiumOnly = isCombi90(p) || p.tier !== "free";
                  const locked = premiumOnly && !isPremium;
                  if (isCombi90(p)) return <Combinada90Card key={p.id} parlay={p} isLocked={locked} />;
                  if (isCombi80(p)) return <Combinada80Card key={p.id} parlay={p} />;
                  return <ParlayCard key={p.id} parlay={p} isLocked={locked} />;
                })}
              </div>
            </section>
          )}

          {/* ── FunBet del día ───────────────────────────────────── */}
          {funBets.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold">FunBet del día</h2>
                  <p className="text-sm text-muted-foreground">
                    {isPremium
                      ? "2 FunBets diarios — alto riesgo, máxima emoción. Cuota acumulada ~x30."
                      : "1 FunBet gratis al día — alto riesgo, cuota acumulada ~x30."}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {funBets.length}/{maxFunBets}
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {funBets.map((p: any) => (
                  <FunBetCard key={p.id} parlay={p} />
                ))}
              </div>
            </section>
          )}

          {/* ── Upsell para usuarios free ────────────────────────── */}
          {!isPremium && (
            <section>
              <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-6">
                <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
                <div className="relative flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-xl font-bold">
                      <Lock className="h-5 w-5 text-primary" />
                      Desbloquea 3 combinadas + 2 FunBets al día
                    </h3>
                    <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                      Premium desbloquea 3 combinadas diarias (incluyendo las de 90%+ de probabilidad)
                      y 2 FunBets — con prioridad a ligas top del mundo.
                    </p>
                  </div>
                  <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Link href="/premium">
                      Ver planes
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-muted/10 py-20 text-center">
      <Layers className="mb-4 h-12 w-12 text-muted-foreground/30" />
      <h2 className="text-lg font-semibold">Sin combinadas hoy todavía</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Nuestro modelo genera combinadas automáticamente cada mañana a las 6, 10 y 14 UTC.
        Vuelve en un momento o revisa las value bets individuales.
      </p>
    </div>
  );
}
