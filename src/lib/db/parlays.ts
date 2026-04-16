import type { DB } from "./types";

export function parlaysRepo(db: DB) {
  return {
    /**
     * Parlays públicos activos (valid_until en el futuro) con todas sus legs.
     * Usado en la página de parlays.
     */
    async getActive() {
      return db
        .from("parlays")
        .select(
          `*,
           legs:parlay_legs(
             *,
             match:matches(
               *,
               home_team:teams!home_team_id(*),
               away_team:teams!away_team_id(*),
               league:leagues(*)
             ),
             bookmaker:bookmakers(*)
           )`,
        )
        .gte("valid_until", new Date().toISOString())
        .order("created_at", { ascending: false });
    },

    /**
     * Legs de un parlay para pre-cargar el builder.
     * Usado en /parlays/builder?from=<parlay-id>.
     */
    async getLegsByParlayId(parlayId: string) {
      return db
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
        .eq("parlay_id", parlayId);
    },
  };
}
