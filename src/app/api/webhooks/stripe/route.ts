import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { upsertSubscription } from "@/lib/billing/upsert-subscription";

export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-09-30.acacia" as Stripe.LatestApiVersion,
    })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

/**
 * POST /api/webhooks/stripe
 * Maneja eventos de subscripciones para sincronizar la tabla `subscriptions`.
 */
export async function POST(req: NextRequest) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (!userId || !session.subscription) break;

      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      // Prefer tier from session metadata (set at checkout creation); fall back to sub metadata
      const sessionTier = (session.metadata?.tier === "pro" ? "pro" : "premium") as "premium" | "pro";
      await upsertStripeSubscription(supabase, userId, sub, sessionTier);
      await supabase.from("profiles").update({ tier: sessionTier }).eq("id", userId);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) break;

      const subTier = (sub.metadata?.tier === "pro" ? "pro" : "premium") as "premium" | "pro";
      await upsertStripeSubscription(supabase, userId, sub, subTier);

      const profileTier = sub.status === "active" || sub.status === "trialing" ? subTier : "free";
      await supabase.from("profiles").update({ tier: profileTier }).eq("id", userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
        })
        .eq("provider_subscription_id", sub.id);
      if (userId) {
        await supabase.from("profiles").update({ tier: "free" }).eq("id", userId);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("provider_subscription_id", invoice.subscription as string);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function upsertStripeSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  sub: Stripe.Subscription,
  tier: "premium" | "pro" = "premium",
) {
  await upsertSubscription({
    supabase,
    userId,
    provider: "stripe",
    providerCustomerId: sub.customer as string,
    providerSubscriptionId: sub.id,
    tier,
    status: sub.status as "active" | "canceled" | "past_due" | "trialing" | "incomplete",
    currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  });
}
