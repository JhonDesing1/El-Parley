import type { DB } from "./types";

export function userPicksRepo(db: DB) {
  return {
    /** Picks recientes del usuario con nombre de equipos. Usado en dashboard. */
    async getRecent(userId: string, limit = 5) {
      return db
        .from("user_picks")
        .select(
          `id, market, selection, odds, result, profit_loss,
           match:matches(
             home_team:teams!home_team_id(name),
             away_team:teams!away_team_id(name)
           )`,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
    },

    /** Historial completo de picks del usuario con relaciones. Usado en mis-picks. */
    async getAll(userId: string, limit = 50) {
      return db
        .from("user_picks")
        .select(
          `id, market, selection, odds, stake, result, profit_loss, created_at, resolved_at,
           bookmaker:bookmakers(id, name, slug),
           match:matches(
             id, kickoff, status, home_score, away_score,
             home_team:teams!home_team_id(id, name, logo_url),
             away_team:teams!away_team_id(id, name, logo_url),
             league:leagues(id, name, country, logo_url)
           )`,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
    },

    /** Picks pendientes de un partido para liquidación. Usado en sync-results. */
    async getPendingForMatch(matchId: number) {
      return db
        .from("user_picks")
        .select("id, market, selection, stake, odds")
        .eq("match_id", matchId)
        .eq("result", "pending");
    },

    /** Actualiza el resultado y P&L de un pick liquidado. */
    async updateResult(
      id: string,
      result: "won" | "lost" | "void",
      resolvedAt: string,
      profitLoss: number | null,
    ) {
      return db
        .from("user_picks")
        .update({ result, resolved_at: resolvedAt, profit_loss: profitLoss })
        .eq("id", id);
    },
  };
}
