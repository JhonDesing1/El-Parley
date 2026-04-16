import { NextRequest, NextResponse } from "next/server";
import { verifyNotificationSignature } from "@/lib/payu/signature";
import { getPayUConfig } from "@/lib/payu/client";
import { PAYU_STATES, type PayUResponseParams } from "@/lib/payu/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/payu-response
 *
 * Redirect síncrono que PayU hace al navegador del usuario tras completar el pago.
 * ⚠️ NO actualizar la DB aquí — este endpoint puede ser falsificado o no llegar.
 *    La fuente de verdad es el webhook IPN (/api/webhooks/payu).
 *
 * Solo redirigimos al usuario a la página correcta según el resultado.
 *
 * Docs: https://developers.payulatam.com/latam/es/docs/integrations/webcheckout-integration/payment-response.html
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const params: Partial<PayUResponseParams> = {
    merchantId: searchParams.get("merchantId") ?? "",
    transactionState: searchParams.get("transactionState") ?? "",
    TX_VALUE: searchParams.get("TX_VALUE") ?? "",
    TX_TAX: searchParams.get("TX_TAX") ?? "",
    buyerEmail: searchParams.get("buyerEmail") ?? "",
    referenceCode: searchParams.get("referenceCode") ?? "",
    reference_pol: searchParams.get("reference_pol") ?? "",
    signature: searchParams.get("signature") ?? "",
    description: searchParams.get("description") ?? "",
    lapPaymentMethod: searchParams.get("lapPaymentMethod") ?? "",
    lapPaymentMethodType: searchParams.get("lapPaymentMethodType") ?? "",
    extra1: searchParams.get("extra1") ?? "",
    extra2: searchParams.get("extra2") ?? "",
  };

  // Verificar firma para evitar que alguien falsifique un redirect de "éxito"
  const config = getPayUConfig();
  const signatureValid = verifyNotificationSignature({
    apiKey: config.apiKey,
    merchantId: config.merchantId,
    referenceCode: params.referenceCode ?? "",
    amount: params.TX_VALUE ?? "",
    currency: "COP",
    transactionState: params.transactionState ?? "",
    receivedSignature: params.signature ?? "",
  });

  if (!signatureValid) {
    console.warn("[payu-response] Firma inválida en redirect", {
      reference: params.referenceCode,
    });
    return NextResponse.redirect(new URL("/premium?error=invalid", siteUrl));
  }

  // Redirigir según el estado — la DB ya fue (o será) actualizada por el IPN
  switch (params.transactionState) {
    case PAYU_STATES.APPROVED: {
      const welcome = (params.extra2 ?? "").startsWith("pro") ? "pro" : "premium";
      return NextResponse.redirect(new URL(`/dashboard?welcome=${welcome}`, siteUrl));
    }

    case PAYU_STATES.PENDING:
      // PSE / efectivo: informar al usuario que el pago está pendiente
      return NextResponse.redirect(new URL("/dashboard?payment=pending", siteUrl));

    case PAYU_STATES.DECLINED:
      return NextResponse.redirect(new URL("/premium?payment=declined", siteUrl));

    default:
      return NextResponse.redirect(new URL("/premium?payment=error", siteUrl));
  }
}
