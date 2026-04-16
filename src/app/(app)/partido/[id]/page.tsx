import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParlayCard } from "@/components/parlay/parlay-card";
import { isPremiumUser } from "@/lib/utils/auth";
import { Layers, RefreshCw } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parlays del día — El Parley",
  description:
    "Combinadas de alto valor seleccionadas algorítmicamente. Probabilidad combinada > 65%.",
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

  const free = (parlays ?? []).filter((p) => p.tier === "free");
  const premium = (parlays ?? []).filter((p) => p.tier !== "free");

  // Última actualización: el parlay más reciente
  const lastGenerated =
    parlays && parlays.length > 0 && parlays[0].created_at
      ? new Date(parlays[0].created_at).toLocaleString("es-CO", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            Parlays del día
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Combinadas seleccionadas por nuestro modelo matemático. Cada selección tiene
            edge positivo individual y la probabilidad combinada supera el umbral mínimo.
          </p>
        </div>
        {lastGenerated && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            <span>Actualizado {lastGenerated}</span>
          </div>
        )}
      </header>

      {(!parlays || parlays.length === 0) ? (
        <EmptyState />
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">
              Todos
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                {parlays.length}
              </span>
            </TabsTrigger>
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

          <TabsContent value="all" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {(parlays ?? []).map((parlay: any) => (
                <ParlayCard
                  key={parlay.id}
                  parlay={parlay}
                  isLocked={parlay.tier !== "free" && !isPremium}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="free" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {free.length === 0 ? (
                <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                  No hay parlays gratuitos disponibles hoy.
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
                  No hay parlays premium disponibles hoy.
                </p>
              ) : (
                premium.map((parlay: any) => (
                  <ParlayCard key={parlay.id} parlay={parlay} isLocked={!isPremium} />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-muted/10 py-20 text-center">
      <Layers className="mb-4 h-12 w-12 text-muted-foreground/30" />
      <h2 className="text-lg font-semibold">Sin parlays hoy todavía</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Nuestro modelo genera parlays automáticamente cada mañana a las 6, 10 y 14 UTC.
        Vuelve en un momento o revisa las value bets individuales.
      </p>
    </div>
  );
}
