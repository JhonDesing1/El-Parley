import type { DB } from "./types";

export function notificationsRepo(db: DB) {
  return {
    /**
     * Upsert de suscripción push por usuario.
     * Si ya existe, actualiza el player_id de OneSignal.
     * Usado en notifications/register.
     */
    async upsertPushSubscription(userId: string, onesignalPlayerId: string) {
      return db
        .from("notification_subscriptions")
        .upsert(
          { user_id: userId, onesignal_player_id: onesignalPlayerId, push_value_bets: true },
          { onConflict: "user_id" },
        );
    },
  };
}
