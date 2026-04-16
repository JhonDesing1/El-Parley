import type { DB, Update } from "./types";

export function profilesRepo(db: DB) {
  return {
    /** Perfil completo del usuario. Usado en dashboard. */
    async getById(userId: string) {
      return db.from("profiles").select("*").eq("id", userId).single();
    },

    /** Solo las métricas de rendimiento. Usado en mis-picks. */
    async getStats(userId: string) {
      return db
        .from("profiles")
        .select("total_picks, win_rate, roi_7d, roi_30d")
        .eq("id", userId)
        .single();
    },

    /** Actualización parcial del perfil. */
    async update(userId: string, data: Update<"profiles">) {
      return db.from("profiles").update(data).eq("id", userId);
    },

    /** Cambia el tier del usuario (free / premium). Usado en webhooks y expire-subscriptions. */
    async setTier(userId: string, tier: "free" | "premium") {
      return db.from("profiles").update({ tier }).eq("id", userId);
    },
  };
}
