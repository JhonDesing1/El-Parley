import { createClient } from "@/lib/supabase/server";
import PricingClient, { type CurrentPlan, type SubscriptionStatus } from "./pricing-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Premium — El Parley",
  description: "Desbloquea value bets ilimitadas, parlays generados por IA y alertas por Telegram.",
};

export const dynamic = "force-dynamic";

/**
 * Infiere si la suscripción es mensual o anual a partir del prefijo del
 * provider_subscription_id (EP-M-* = monthly, EP-Y-* = yearly).
 */
function inferPlanInterval(providerSubscriptionId: string | null): CurrentPlan {
  if (!providerSubscriptionId) return null;
  if (providerSubscriptionId.startsWith("EP-Y")) return "yearly";
  if (providerSubscriptionId.startsWith("EP-M")) return "monthly";
  return "monthly"; // fallback para subs creadas antes de este sistema
}

export default async function PremiumPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Middleware redirige, pero por seguridad
    return <PricingClient
      currentPlan={null}
      subscriptionStatus={null}
      cancelAtPeriodEnd={false}
      periodEnd={null}
    />;
  }

  // Suscripción más reciente del usuario (activa, trialing o cancelada pendiente)
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, provider_subscription_id, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing", "past_due", "canceled"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentPlan = inferPlanInterval(subscription?.provider_subscription_id ?? null);
  const subscriptionStatus = (subscription?.status ?? null) as SubscriptionStatus;
  const cancelAtPeriodEnd = subscription?.cancel_at_period_end ?? false;
  const periodEnd = subscription?.current_period_end ?? null;

  return (
    <PricingClient
      currentPlan={currentPlan}
      subscriptionStatus={subscriptionStatus}
      cancelAtPeriodEnd={cancelAtPeriodEnd}
      periodEnd={periodEnd}
    />
  );
}
