import type { PayUConfig, PayUPlan, PayUPlanConfig, PayUCheckoutParams } from "./types";
import { generatePaymentSignature } from "./signature";

// ─── Planes disponibles ───────────────────────────────────────────────────────

export const PAYU_PLANS: Record<PayUPlan, PayUPlanConfig> = {
  monthly: {
    referencePrefix: "AV-M",
    amount: "19900",    // COP 19.900 ≈ USD 4.99
    currency: "COP",
    description: "El Parley Premium — Mensual",
  },
  yearly: {
    referencePrefix: "AV-Y",
    amount: "99900",    // COP 99.900 ≈ USD 24.99
    currency: "COP",
    description: "El Parley Premium — Anual",
  },
  "pro-monthly": {
    referencePrefix: "AV-PM",
    amount: "59900",    // COP 59.900 ≈ USD 14.99
    currency: "COP",
    description: "El Parley Pro — Mensual",
  },
  "pro-yearly": {
    referencePrefix: "AV-PY",
    amount: "299900",   // COP 299.900 ≈ USD 74.99
    currency: "COP",
    description: "El Parley Pro — Anual",
  },
};

/** Devuelve el tier de suscripción según el plan de PayU. */
export function getTierFromPayUPlan(plan: PayUPlan): "premium" | "pro" {
  return plan.startsWith("pro") ? "pro" : "premium";
}

// ─── URLs por entorno ─────────────────────────────────────────────────────────

const PAYU_CHECKOUT_URLS: Record<"sandbox" | "production", string> = {
  sandbox: "https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/",
  production: "https://checkout.payulatam.com/ppp-web-gateway-payu/",
};

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Devuelve la configuración activa de PayU leyendo siempre las variables de entorno.
 * Configura PAYU_ENV=sandbox para pruebas y PAYU_ENV=production para producción.
 */
export function getPayUConfig(): PayUConfig {
  const env = (process.env.PAYU_ENV ?? "sandbox") as "sandbox" | "production";

  return {
    merchantId: process.env.PAYU_MERCHANT_ID!,
    accountId: process.env.PAYU_ACCOUNT_ID!,
    apiKey: process.env.PAYU_API_KEY!,
    apiLogin: process.env.PAYU_API_LOGIN!,
    env,
  };
}

/**
 * URL del checkout de PayU según el entorno actual.
 */
export function getPayUCheckoutUrl(): string {
  const config = getPayUConfig();
  return PAYU_CHECKOUT_URLS[config.env];
}

/**
 * Construye todos los parámetros necesarios para el formulario de pago de PayU.
 *
 * @param plan       - "monthly" | "yearly"
 * @param userId     - UUID del usuario en Supabase
 * @param userEmail  - Email del comprador
 * @param referenceCode - Código único de referencia (UUID generado en el endpoint)
 */
export function buildPayUCheckoutParams({
  plan,
  userId,
  userEmail,
  referenceCode,
}: {
  plan: PayUPlan;
  userId: string;
  userEmail: string;
  referenceCode: string;
}): PayUCheckoutParams {
  const config = getPayUConfig();
  const planConfig = PAYU_PLANS[plan];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const signature = generatePaymentSignature({
    apiKey: config.apiKey,
    merchantId: config.merchantId,
    referenceCode,
    amount: planConfig.amount,
    currency: planConfig.currency,
  });

  return {
    merchantId: config.merchantId,
    accountId: config.accountId,
    description: planConfig.description,
    referenceCode,
    amount: planConfig.amount,
    currency: planConfig.currency,
    signature,
    tax: "0",            // IVA incluido en el precio (simplificado para suscripciones)
    taxReturnBase: "0",
    buyerEmail: userEmail,
    responseUrl: `${siteUrl}/api/payu-response`,
    confirmationUrl: `${siteUrl}/api/webhooks/payu`,
    lng: "es",
    extra1: userId,
    extra2: plan,
  };
}
