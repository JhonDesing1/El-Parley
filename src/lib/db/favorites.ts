import type { DB } from "./types";

export function favoritesRepo(db: DB) {
  return {
    /** IDs de partidos favoritos del usuario. Usado en dashboard. */
    async getMatchIds(userId: string) {
      return db.from("favorites").select("match_id").eq("user_id", userId);
    },
  };
}
