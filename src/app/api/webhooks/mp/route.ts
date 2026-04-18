import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createAdminClient } from "@/lib/supabase/server";
import { upsertSubscription } from "@/lib/billing/upsert-subscription";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/mp
 *
 * Notificación IPN de Mercado Pago.
 * Docs: https://www.mercadopago.com.co/developers/es/docs/your-integrations/notifications/ipn
 */
export async function POST(req: NextRequest) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return NextResponse.json({ received: true });
  }

  const { searchParams } = new URL(req.url);
  const topic = searchParams.get("topic") ?? searchParams.get("type");
  const id = searchParams.get("id") ?? searchParams.get("data.id");

  // Solo procesamos notificaciones de pagos
  if (topic !== "payment" || !id) {
    return NextResponse.json({ received: true });
  }

  try {
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    });
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: Number(id) });

    const userId = payment.metadata?.user_id as string | undefined;
    const plan = (payment.metadata?.plan ?? "monthly") as "monthly" | "yearly";
    const status = payment.status;

    if (!userId) {
      console.error("[mp-webhook] user_id ausente en metadata", { id });
      return NextResponse.json({ received: true });
    }

    const supabase = createAdminClient();

    if (status === "approved") {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + (plan === "yearly" ? 12 : 1));

      // Cancelar suscripción activa anterior del mismo usuario (upgrade/recompra)
      await supabase
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: now.toISOString() })
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .neq("provider_subscription_id", String(payment.id));

      await upsertSubscription({
        supabase,
        userId,
        provider: "mercadopago",
        providerCustomerId: String(payment.payer?.id ?? payment.payer?.email ?? ""),
        providerSubscriptionId: String(payment.id),
        tier: "premium",
        status: "active",
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
      });

      await supabase.from("profiles").update({ tier: "premium" }).eq("id", userId);

      console.info("[mp-webhook] Pago aprobado", { id, plan, userId });
    } else if (status === "rejected" || status === "cancelled") {
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("provider_subscription_id", String(payment.id));

      console.info("[mp-webhook] Pago rechazado/cancelado", { id, status, userId });
    } else {
      console.info("[mp-webhook] Estado pendiente", { id, status, userId });
    }
  } catch (error) {
    console.error("[mp-webhook] Error procesando notificación:", error);
  }

  return NextResponse.json({ received: true });
}
