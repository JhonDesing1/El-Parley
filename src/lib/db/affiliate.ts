import type { DB, Insert } from "./types";

export function affiliateRepo(db: DB) {
  return {
    /** Registra un clic de afiliado (fire-and-forget). Usado en track/affiliate. */
    insert(data: Insert<"affiliate_clicks">) {
      db.from("affiliate_clicks").insert(data).then();
    },

    /** Elimina clics anteriores a `threshold`. Usado en cleanup-odds. */
    async deleteOlderThan(threshold: string) {
      return db
        .from("affiliate_clicks")
        .delete({ count: "exact" })
        .lt("clicked_at", threshold);
    },
  };
}
