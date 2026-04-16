import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { upsertSubscription } from "@/lib/billing/upsert-subscription";
import { verifyNotificationSignature } from "@/lib/payu/signature";
import { getPayUConfig, PAYU_PLANS, getTierFromPayUPlan } from "@/lib/payu/client";
import { PAYU_STATES, type PayUNotification, type PayUPlan } from "@/lib/payu/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/payu
 *
 * Notificación IPN (Instant Payment Notification) asíncrona de PayU.
 * PayU reintenta el envío si no recibe HTTP 200, por eso siempre respondemos 200
 * incluso en casos que no requieren acción (firma inválida, evento duplicado).
 *
 * Docs: https://developers.payulatam.com/latam/es/docs/integrations/webcheckout-integration/payment-confirmation.html
 */
export async function POST(req: NextRequest) {
  // PayU envía el body como application/x-www-form-urlencoded
  const formData = await req.formData();
  const notification = Object.fromEntries(formData.entries()) as unknown as PayUNotification;

  const config = getPayUConfig();

  // ── 1. Verificar firma ────────────────────────────────────────────────────
  const signatureValid = verifyNotificationSignature({
    apiKey: config.apiKey,
    merchantId: config.merchantId,
    referenceCode: notification.reference_sale,
    amount: notification.value,
    currency: notification.currency,
    transactionState: notification.state_pol,
    receivedSignature: notification.sign,
  });

  if (!signatureValid) {
    // No retornamos 4xx para evitar que PayU reintente indefinidamente
    console.error("[payu-webhook] Firma inválida", {
      reference: notification.reference_sale,
      state: notification.state_pol,
    });
    return NextResponse.json({ received: true });
  }

  // ── 2. Extraer datos del pago ─────────────────────────────────────────────
  const userId = notification.extra1;
  const plan = (notification.extra2 ?? "monthly") as PayUPlan;
  const tier = getTierFromPayUPlan(plan);
  const transactionState = notification.state_pol;
  const referenceCode = notification.reference_sale;
  const transactionId = notification.reference_pol; // ID único de PayU

  if (!userId) {
    console.error("[payu-webhook] extra1 (user_id) ausente", { reference: referenceCode });
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();

  // ── 3. Manejar estado ─────────────────────────────────────────────────────
  switch (transactionState) {
    case PAYU_STATES.APPROVED: {
      const planConfig = PAYU_PLANS[plan];
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + (plan.endsWith("yearly") ? 12 : 1));

      await upsertSubscription({
        supabase,
        userId,
        provider: "payu",
        providerCustomerId: notification.buyer_email ?? null,
        providerSubscriptionId: transactionId,
        tier,
        status: "active",
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
      });

      await supabase.from("profiles").update({ tier }).eq("id", userId);

      console.info("[payu-webhook] Pago aprobado", {
        reference: referenceCode,
        plan,
        tier,
        userId,
        amount: planConfig.amount,
      });
      break;
    }

    case PAYU_STATES.DECLINED: {
      // Solo actualizamos si ya existía una fila (pago que venía de 'pending')
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("provider_subscription_id", transactionId);

      console.info("[payu-webhook] Pago rechazado", { reference: referenceCode, userId });
      break;
    }

    case PAYU_STATES.PENDING: {
      // PSE / efectivo (Efecty, Baloto) — el pago se confirmará más tarde
      const planConfig = PAYU_PLANS[plan];
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + (plan.endsWith("yearly") ? 12 : 1));

      await upsertSubscription({
        supabase,
        userId,
        provider: "payu",
        providerCustomerId: notification.buyer_email ?? null,
        providerSubscriptionId: transactionId,
        tier,
        status: "incomplete",
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
      });

      console.info("[payu-webhook] Pago pendiente", {
        reference: referenceCode,
        plan,
        userId,
        amount: planConfig.amount,
      });
      break;
    }

    case PAYU_STATES.ERROR:
    default:
      console.warn("[payu-webhook] Estado desconocido o error", {
        state: transactionState,
        reference: referenceCode,
      });
      break;
  }

  // PayU requiere HTTP 200 para dar la notificación por entregada
  return NextResponse.json({ received: true });
}
