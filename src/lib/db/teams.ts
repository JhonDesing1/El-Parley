import type { DB, Insert } from "./types";

export function teamsRepo(db: DB) {
  return {
    /** Upsert masivo de equipos provenientes de API-Football. */
    async upsertMany(teams: Insert<"teams">[]) {
      return db.from("teams").upsert(teams, { onConflict: "id" });
    },
  };
}
