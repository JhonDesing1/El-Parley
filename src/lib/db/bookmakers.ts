import type { DB } from "./types";

export function bookmakersRepo(db: DB) {
  return {
    /** Busca una casa de apuestas por slug. Usado en track/affiliate. */
    async getBySlug(slug: string) {
      return db.from("bookmakers").select("id").eq("slug", slug).single();
    },
  };
}
