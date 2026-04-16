/**
 * Tipos TypeScript para la integración con PayU Latam.
 * Documentación: https://developers.payulatam.com/latam/es/docs/integrations
 */

// ─── Configuración ────────────────────────────────────────────────────────────

export type PayUEnv = "sandbox" | "production";

export interface PayUConfig {
  merchantId: string;
  accountId: string;
  apiKey: string;
  apiLogin: string;
  env: PayUEnv;
}

// ─── Planes de suscripción ────────────────────────────────────────────────────

export type PayUPlan = "monthly" | "yearly" | "pro-monthly" | "pro-yearly";

export interface PayUPlanConfig {
  referencePrefix: string;
  amount: string;       // COP, sin decimales
  currency: "COP";
  description: string;
}

// ─── Checkout form data ───────────────────────────────────────────────────────

export interface PayUCheckoutParams {
  merchantId: string;
  accountId: string;
  description: string;
  referenceCode: string;
  amount: string;
  currency: "COP";
  signature: string;
  tax: string;
  taxReturnBase: string;
  buyerEmail: string;
  responseUrl: string;
  confirmationUrl: string;
  lng: "es";
  extra1: string; // user_id
  extra2: PayUPlan;
}

// ─── Notificación IPN (webhook POST de PayU) ─────────────────────────────────

export interface PayUNotification {
  merchant_id: string;
  reference_sale: string;    // referenceCode que enviamos
  reference_pol: string;     // ID de transacción de PayU
  sign: string;              // Firma a verificar
  transaction_id: string;
  state_pol: string;         // "4"=APPROVED, "6"=DECLINED, "7"=PENDING, "104"=ERROR
  response_code_pol: string;
  currency: string;
  value: string;
  tax: string;
  additional_value: string;
  buyer_email: string;
  payment_method: string;
  payment_method_name: string;
  payment_method_type: string;
  installments_number: string;
  risk?: string;
  extra1?: string;           // user_id
  extra2?: string;           // plan
  transaction_date: string;
}

// ─── Respuesta síncrona (redirect post-pago) ─────────────────────────────────

export interface PayUResponseParams {
  merchantId: string;
  merchant_name?: string;
  merchant_address?: string;
  telephone?: string;
  merchant_url?: string;
  transactionState: string;  // "4"=APPROVED, "6"=DECLINED, "7"=PENDING
  TX_VALUE: string;
  TX_TAX: string;
  buyerEmail: string;
  referenceCode: string;
  reference_pol: string;
  signature: string;
  description: string;
  lapPaymentMethod: string;
  lapPaymentMethodType: string;
  extra1?: string;           // user_id
  extra2?: string;           // plan
}

// ─── Estados de transacción PayU ─────────────────────────────────────────────

export const PAYU_STATES = {
  APPROVED: "4",
  DECLINED: "6",
  PENDING: "7",
  ERROR: "104",
} as const;

export type PayUState = (typeof PAYU_STATES)[keyof typeof PAYU_STATES];
