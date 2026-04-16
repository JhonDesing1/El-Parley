import type { DB, Insert } from "./types";

export function valueBetsRepo(db: DB) {
  return {
    /**
     * Value bets pendientes con bookmaker y datos del partido.
     * Usado en home page y generate-blog.
     */
    async getPendingWithDetails(limit = 20, minEdge = 0.03) {
      return db
        .from("value_bets")
        .select(
          `id, match_id, market, selection, price, edge, model_prob,
           kelly_fraction, confidence, reasoning, is_premium,
           bookmaker:bookmakers(id, slug, name, logo_url, affiliate_url),
           match:matches(
             kickoff,
             home_team:teams!home_team_id(id, name, short_name, logo_url),
             away_team:teams!away_team_id(id, name, short_name, logo_url),
             league:leagues(id, name, slug, country, logo_url, flag_url)
           )`,
        )
        .eq("result", "pending")
        .gte("edge", minEdge)
        .order("edge", { ascending: false })
        .limit(limit);
    },

    /**
     * Value bets pendientes de un partido con bookmaker.
     * Usado en partido/[id] (vía cache layer).
     */
    async getPendingForMatch(matchId: number) {
      return db
        .from("value_bets")
        .select(
          `id, market, selection, price, edge, model_prob,
           kelly_fraction, confidence, reasoning, is_premium,
           bookmaker:bookmakers(id, slug, name, logo_url, affiliate_url)`,
        )
        .eq("match_id", matchId)
        .eq("result", "pending")
        .order("edge", { ascending: false });
    },

    /**
     * Value bets pendientes de varios partidos (para detect-value-bets
     * necesita solo cuotas/mercado; para generate-blog necesita relaciones completas).
     */
    async getPendingForMatches(
      from: string,
      to: string,
      minEdge = 0.03,
      limit = 50,
    ) {
      return db
        .from("value_bets")
        .select(
          `id, match_id, market, selection, price, edge, model_prob,
           kelly_fraction, confidence, reasoning, is_premium,
           bookmaker:bookmakers(id, slug, name, logo_url, affiliate_url),
           match:matches(
             kickoff,
             home_team:teams!home_team_id(id, name, short_name, logo_url),
             away_team:teams!away_team_id(id, name, short_name, logo_url),
             league:leagues(id, name, slug, country, logo_url, flag_url)
           )`,
        )
        .eq("result", "pending")
        .gte("edge", minEdge)
        .gte("match.kickoff", from)
        .lte("match.kickoff", to)
        .order("edge", { ascending: false })
        .limit(limit);
    },

    /** Cuotas + mercado pendientes de un partido para liquidación. Usado en sync-results. */
    async getSettlementData(matchId: number) {
      return db
        .from("value_bets")
        .select("id, market, selection")
        .eq("match_id", matchId)
        .eq("result", "pending");
    },

    /** Elimina todas las value bets pendientes de un partido antes de re-detectar. */
    async deletePendingForMatch(matchId: number) {
      return db
        .from("value_bets")
        .delete()
        .eq("match_id", matchId)
        .eq("result", "pending");
    },

    /** Inserta un lote de value bets detectados. */
    async insertMany(bets: Insert<"value_bets">[]) {
      return db.from("value_bets").insert(bets);
    },

    /** Actualiza el resultado de una value bet (won / lost / void). */
    async updateResult(id: number, result: "won" | "lost" | "void") {
      return db.from("value_bets").update({ result }).eq("id", id);
    },
  };
}
