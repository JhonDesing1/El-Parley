import type { DB, Insert } from "./types";
import type { Database } from "@/types/database";

type MarketType = Database["public"]["Enums"]["market_type"];

export function oddsRepo(db: DB) {
  return {
    /** Cuotas de un partido con su casa de apuestas. Usado en detect-value-bets. */
    async getForMatch(matchId: number) {
      return db
        .from("odds")
        .select("id, bookmaker_id, market, selection, price")
        .eq("match_id", matchId);
    },

    /**
     * Cuotas de varios partidos, filtradas por mercados.
     * Devuelve la mejor cuota por (match_id, market, selection) — usado en parlays builder.
     */
    async getForMatches(matchIds: number[], markets?: MarketType[]) {
      let query = db
        .from("odds")
        .select("match_id, market, selection, price, bookmaker:bookmakers(id, slug, name)")
        .in("match_id", matchIds)
        .order("price", { ascending: false });

      if (markets?.length) {
        query = query.in("market", markets);
      }

      return query;
    },

    /** Upsert masivo de cuotas con conflicto por clave compuesta. */
    async upsertMany(odds: Insert<"odds">[]) {
      return db
        .from("odds")
        .upsert(odds, {
          onConflict: "match_id,bookmaker_id,market,selection,line",
        });
    },

    /** Elimina cuotas de los partidos indicados. Usado en cleanup-odds. */
    async deleteForMatches(matchIds: number[]) {
      return db.from("odds").delete({ count: "exact" }).in("match_id", matchIds);
    },
  };
}
