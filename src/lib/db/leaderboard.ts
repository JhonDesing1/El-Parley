import type { DB } from "./types";

export function leaderboardRepo(db: DB) {
  return {
    /** Tabla de clasificación completa ordenada por rank. Usado en leaderboard page. */
    async getAll() {
      return db.from("leaderboard").select("*").order("rank", { ascending: true });
    },

    /** Refresca la vista materializada vía RPC. Usado en refresh-leaderboard cron. */
    async refresh() {
      return db.rpc("refresh_leaderboard");
    },
  };
}
