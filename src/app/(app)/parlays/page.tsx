import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParlayCard } from "@/components/parlay/parlay-card";
import { isPremiumUser } from "@/lib/utils/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parlays del día — ApuestaValue",
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

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Parlays del día
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Combinadas seleccionadas por nuestro modelo matemático. Cada selección tiene
          edge positivo individual y la probabilidad combinada supera el umbral mínimo.
        </p>
      </header>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="free">Gratis</TabsTrigger>
          <TabsTrigger value="premium">Premium</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
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

        <TabsContent value="free">
          <div className="grid gap-4 md:grid-cols-2">
            {free.map((parlay: any) => (
              <ParlayCard key={parlay.id} parlay={parlay} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="premium">
          <div className="grid gap-4 md:grid-cols-2">
            {premium.map((parlay: any) => (
              <ParlayCard key={parlay.id} parlay={parlay} isLocked={!isPremium} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
