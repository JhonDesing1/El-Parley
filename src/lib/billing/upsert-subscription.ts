import type { createAdminClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface UpsertSubscriptionParams {
  supabase: AdminClient;
  userId: string;
  provider: "mercadopago";
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  tier: "premium" | "pro";
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
  currentPeriodStart: string; // ISO
  currentPeriodEnd: string;   // ISO
  cancelAtPeriodEnd?: boolean;
}

/**
 * Inserta o actualiza una fila en `subscriptions` de forma idempotente.
 * El conflicto se resuelve por `provider_subscription_id` (campo UNIQUE).
 */
export async function upsertSubscription({
  supabase,
  userId,
  provider,
  providerCustomerId,
  providerSubscriptionId,
  tier,
  status,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAtPeriodEnd = false,
}: UpsertSubscriptionParams) {
  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      provider,
      provider_customer_id: providerCustomerId,
      provider_subscription_id: providerSubscriptionId,
      tier,
      status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
    },
    { onConflict: "provider_subscription_id" },
  );
}
