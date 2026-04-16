import type { DB, Insert, Update } from "./types";
import type { Database } from "@/types/database";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

export function subscriptionsRepo(db: DB) {
  return {
    /** Suscripciones activas cuyo período ya expiró. Usado en expire-subscriptions. */
    async getExpiredActive() {
      return db
        .from("subscriptions")
        .select("id, user_id")
        .eq("status", "active")
        .not("current_period_end", "is", null)
        .lt("current_period_end", new Date().toISOString());
    },

    /** Suscripciones past_due más antiguas que `staleThreshold`. Usado en expire-subscriptions. */
    async getPastDueStale(staleThreshold: string) {
      return db
        .from("subscriptions")
        .select("id, user_id")
        .eq("status", "past_due")
        .lt("updated_at", staleThreshold);
    },

    /** Comprueba si el usuario tiene alguna suscripción activa o en trial. */
    async getActiveForUser(userId: string) {
      return db
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .limit(1)
        .maybeSingle();
    },

    /** Suscripciones PayU incompletas más antiguas que `threshold`. Usado en sync-payu. */
    async getIncompletePayU(threshold: string) {
      return db
        .from("subscriptions")
        .select("id, user_id, provider_subscription_id, updated_at")
        .eq("provider", "payu")
        .eq("status", "incomplete")
        .lt("updated_at", threshold);
    },

    /** Actualiza el estado de una suscripción por su ID. */
    async update(id: string, data: Update<"subscriptions">) {
      return db.from("subscriptions").update(data).eq("id", id);
    },

    /** Actualiza el estado de varias suscripciones en bloque. */
    async updateManyStatus(
      ids: string[],
      status: SubscriptionStatus,
      extra: Partial<Update<"subscriptions">> = {},
    ) {
      return db.from("subscriptions").update({ status, ...extra }).in("id", ids);
    },

    /** Actualiza una suscripción por provider_subscription_id. */
    async updateByProviderId(
      providerSubscriptionId: string,
      data: Update<"subscriptions">,
    ) {
      return db
        .from("subscriptions")
        .update(data)
        .eq("provider_subscription_id", providerSubscriptionId);
    },

    /** Upsert de suscripción. Usado por el helper upsertSubscription en billing/. */
    async upsert(data: Insert<"subscriptions">) {
      return db
        .from("subscriptions")
        .upsert(data, { onConflict: "provider_subscription_id" });
    },
  };
}
