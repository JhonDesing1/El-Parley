import type { DB } from "./types";

export function leaguesRepo(db: DB) {
  return {
    /** Ligas marcadas como destacadas para sincronizar fixtures. Usado en sync-fixtures. */
    async getFeatured() {
      return db.from("leagues").select("id, season").eq("is_featured", true);
    },
  };
}
