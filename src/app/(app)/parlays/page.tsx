import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParlayCard } from "@/components/parlay/parlay-card";
import { FunBetCard } from "@/components/parlay/funbet-card";
import { Combinada80Card } from "@/components/parlay/combinada80-card";
import { Combinada90Card } from "@/components/parlay/combinada90-card";
import { isPremiumUser } from "@/lib/utils/auth";
import { Layers, Lock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  const funBets = (parlays ?? []).filter(isFunBet);
  const combinadas80 = (parlays ?? []).filter(isCombi80);
  const combinadas90 = (parlays ?? []).filter(isCombi90);
  const regularParlays = (parlays ?? []).filter(
    (p) => !isFunBet(p) && !isCombi80(p) && !isCombi90(p),
  );
  const premium = regularParlays.filter((p: any) => p.tier !== "free");
  const free = regularParlays.filter((p: any) => p.tier === "free");

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
          {/* ── FunBet del día ───────────────────────────────────── */}
          {funBets.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="font-display text-2xl font-bold">FunBet del día</h2>
                <p className="text-sm text-muted-foreground">
                  Alto riesgo, máxima emoción. Cuota acumulada ~x30. Una por día.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {funBets.map((p: any) => (
                  <FunBetCard key={p.id} parlay={p} />
                ))}
              </div>
            </section>
          )}

          {/* ── Combinadas 80% ───────────────────────────────────── */}
          {combinadas80.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="font-display text-2xl font-bold">Combinadas 80%</h2>
                <p className="text-sm text-muted-foreground">
                  Probabilidad combinada del modelo superior al 80%. Cuota objetivo x3.5.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {combinadas80.map((p: any) => (
                  <Combinada80Card key={p.id} parlay={p} />
                ))}
              </div>
            </section>
          )}

          {/* ── Combinadas 90% Premium ───────────────────────────── */}
          {combinadas90.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
                    Combinadas 90%
                    <Badge variant="premium" className="gap-1">
                      <Lock className="h-3 w-3" />
                      PREMIUM
                    </Badge>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    4 combinadas diarias con probabilidad ≥ 90% y ganancia neta ≥ 0.60 por unidad.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {combinadas90.map((p: any) => (
                  <Combinada90Card key={p.id} parlay={p} isLocked={!isPremium} />
                ))}
              </div>
            </section>
          )}

          {/* ── Parlays regulares ────────────────────────────────── */}
          {regularParlays.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="font-display text-2xl font-bold">Combinadas de valor</h2>
                <p className="text-sm text-muted-foreground">
                  Edge positivo individual en cada selección. Modelo Poisson + xG.
                </p>
              </div>
              <Tabs defaultValue="free" className="w-full">
                <TabsList>
                  <TabsTrigger value="free">
                    Gratis
                    {free.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {free.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="premium">
                    Premium
                    {premium.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {premium.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="free" className="mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {free.length === 0 ? (
                      <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                        No hay combinadas gratuitas disponibles hoy.
                      </p>
                    ) : (
                      free.map((parlay: any) => (
                        <ParlayCard key={parlay.id} parlay={parlay} />
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="premium" className="mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {premium.length === 0 ? (
                      <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                        No hay combinadas premium disponibles hoy.
                      </p>
                    ) : (
                      premium.map((parlay: any) => (
                        <ParlayCard key={parlay.id} parlay={parlay} isLocked={!isPremium} />
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
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
