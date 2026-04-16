import type { DB, Insert } from "./types";

export function userParlaysRepo(db: DB) {
  return {
    /** Parlays recientes del usuario. Usado en dashboard. */
    async getRecent(userId: string, limit = 5) {
      return db
        .from("user_parlays")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
    },

    /** Inserta un nuevo parlay del usuario. Devuelve el registro creado. */
    async insert(parlay: Insert<"user_parlays">) {
      return db.from("user_parlays").insert(parlay).select().single();
    },

    /** Elimina un parlay (rollback en caso de error al insertar legs). */
    async delete(id: string) {
      return db.from("user_parlays").delete().eq("id", id);
    },
  };
}

export function userParlayLegsRepo(db: DB) {
  return {
    /** Inserta las legs de un parlay del usuario. */
    async insertMany(legs: Insert<"user_parlay_legs">[]) {
      return db.from("user_parlay_legs").insert(legs);
    },
  };
}
