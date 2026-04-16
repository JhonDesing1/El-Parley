import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/utils/auth";
import { ParlayBuilderClient } from "./builder-client";

export const metadata: Metadata = {
  title: "Parlay Builder — El Parley",
  description: "Construye tu propia combinada. Calcula cuota total, probabilidad y valor esperado en tiempo real.",
};

export default async function ParlayBuilderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/parlays/builder");

  const supabase = await createClient();
  const params = await searchParams;

  // Partidos de las próximas 48h con odds disponibles
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
  const { data: matches } = await supabase
    .from("matches")
    .select(
      `id, kickoff, status,
       home_team:teams!home_team_id(id, name, short_name, logo_url),
       away_team:teams!away_team_id(id, name, short_name, logo_url),
       league:leagues(id, name, country, logo_url)`,
    )
    .eq("status", "scheduled")
    .lte("kickoff", in48h)
    .gte("kickoff", now.toISOString())
    .order("kickoff", { ascending: true })
    .limit(30);

  // Odds de todos esos partidos agrupadas
  const matchIds = (matches ?? []).map((m: any) => m.id);
  const { data: oddsRaw } = matchIds.length
    ? await supabase
        .from("odds")
        .select("match_id, market, selection, price, bookmaker:bookmakers(id, slug, name)")
        .in("match_id", matchIds)
        .in("market", ["1x2", "btts", "over_under_2_5"])
        .order("price", { ascending: false })
    : { data: [] };

  // Si viene ?from=parlay-id, pre-cargar las legs de ese parlay
  let seedLegs: any[] = [];
  if (params.from) {
    const { data: parlayLegs } = await supabase
      .from("parlay_legs")
      .select(
        `match_id, market, selection, price,
         bookmaker:bookmakers(id, slug, name),
         match:matches(
           id,
           home_team:teams!home_team_id(id, name, short_name),
           away_team:teams!away_team_id(id, name, short_name)
         )`,
      )
      .eq("parlay_id", params.from);
    seedLegs = parlayLegs ?? [];
  }

  // Mejor cuota por (match_id, market, selection)
  const bestOdds = new Map<string, { price: number; bookmaker: any }>();
  for (const o of oddsRaw ?? []) {
    const key = `${(o as any).match_id}__${(o as any).market}__${(o as any).selection}`;
    const existing = bestOdds.get(key);
    if (!existing || (o as any).price > existing.price) {
      bestOdds.set(key, { price: (o as any).price, bookmaker: (o as any).bookmaker });
    }
  }

  return (
    <div className="container max-w-7xl py-8">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight">Parlay Builder</h1>
        <p className="mt-2 text-muted-foreground">
          Selecciona partidos y mercados para construir tu combinada. La cuota, probabilidad y
          valor esperado se calculan en tiempo real.
        </p>
      </header>

      <ParlayBuilderClient
        matches={(matches ?? []) as any}
        bestOdds={Object.fromEntries(bestOdds)}
        seedLegs={seedLegs}
        userId={user.id}
      />
    </div>
  );
}
