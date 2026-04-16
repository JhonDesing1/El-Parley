/**
 * Cliente PSE — interactúa con la Payments API de PayU para:
 *   1. Obtener la lista de bancos disponibles para PSE
 *   2. Crear una transacción PSE y obtener la URL del portal bancario
 *
 * PSE requiere la Payments REST API (no el web checkout con formulario),
 * porque el usuario debe seleccionar su banco antes del redirect.
 */

import { randomBytes } from "crypto";
import { generatePaymentSignature } from "@/lib/payu/signature";
import { getPayUConfig, PAYU_PLANS } from "@/lib/payu/client";
import type {
  PSEBank,
  PSETransactionRequest,
  PSETransactionResponse,
  PayUPSETransactionBody,
  PayUAPIResponse,
  PayUBankListResponse,
} from "./types";

// ─── URLs por entorno ─────────────────────────────────────────────────────────

const PSE_API_URLS: Record<"sandbox" | "production", string> = {
  sandbox: "https://sandbox.api.payulatam.com/payments-api/4.0/service.cgi",
  production: "https://api.payulatam.com/payments-api/4.0/service.cgi",
};

// ─── Lista de bancos ──────────────────────────────────────────────────────────

/**
 * Obtiene la lista de bancos disponibles para PSE en Colombia.
 * El resultado se puede cachear hasta 1 hora (los bancos cambian poco).
 */
export async function getPSEBanks(): Promise<PSEBank[]> {
  const config = getPayUConfig();
  const url = PSE_API_URLS[config.env];

  const body = {
    language: "es",
    command: "GET_BANKS_LIST",
    merchant: { apiLogin: config.apiLogin, apiKey: config.apiKey },
    test: config.env === "sandbox",
    bankListInformation: { paymentMethod: "PSE", paymentCountry: "CO" },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    // Cache de 1 hora — la lista de bancos PSE rara vez cambia
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`PayU banks API error: ${res.status} ${res.statusText}`);
  }

  const data: PayUBankListResponse = await res.json();

  if (data.code !== "SUCCESS") {
    throw new Error(data.error ?? "Error obteniendo la lista de bancos PSE");
  }

  return data.banks ?? [];
}

// ─── Crear transacción PSE ────────────────────────────────────────────────────

/**
 * Crea una transacción PSE en PayU y devuelve la URL del portal bancario.
 *
 * El flujo:
 *   1. Llamamos a la Payments API con los datos del pagador y el banco elegido.
 *   2. PayU devuelve estado PENDING + BANK_URL.
 *   3. Redirigimos al usuario a BANK_URL donde autenticará el débito.
 *   4. El banco redirige de vuelta a /api/payu-response (síncrono).
 *   5. PayU notifica el resultado final vía IPN a /api/webhooks/payu.
 *
 * Los campos partner1/partner2 en el order se devuelven como extra1/extra2 en
 * el IPN, lo que permite al webhook identificar el usuario y el plan.
 */
export async function createPSETransaction(
  params: PSETransactionRequest,
): Promise<PSETransactionResponse> {
  const config = getPayUConfig();
  const planConfig = PAYU_PLANS[params.plan];
  const url = PSE_API_URLS[config.env];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Código de referencia único para esta transacción
  const random = randomBytes(8).toString("hex");
  const planCode = params.plan.replace("-", "").toUpperCase().slice(0, 2);
  const referenceCode = `PSE-${planCode}-${random}`;

  const amount = parseInt(planConfig.amount, 10);

  const signature = generatePaymentSignature({
    apiKey: config.apiKey,
    merchantId: config.merchantId,
    referenceCode,
    amount: planConfig.amount,
    currency: "COP",
  });

  const deviceSessionId = randomBytes(16).toString("hex");

  const body: PayUPSETransactionBody = {
    language: "es",
    command: "SUBMIT_TRANSACTION",
    merchant: {
      apiLogin: config.apiLogin,
      apiKey: config.apiKey,
    },
    test: config.env === "sandbox",
    transaction: {
      order: {
        accountId: config.accountId,
        referenceCode,
        description: planConfig.description,
        language: "es",
        signature,
        notifyUrl: `${siteUrl}/api/webhooks/payu`,
        additionalValues: {
          TX_VALUE: { value: amount, currency: "COP" },
          TX_TAX: { value: 0, currency: "COP" },
          TX_TAX_RETURN_BASE: { value: 0, currency: "COP" },
        },
        // partner1/partner2 se devuelven como extra1/extra2 en el IPN de PayU
        partner1: params.userId,
        partner2: params.plan,
        buyer: {
          merchantBuyerId: params.userId,
          fullName: params.fullName,
          emailAddress: params.userEmail,
          contactPhone: params.phone,
          dniNumber: params.documentNumber,
          shippingAddress: {
            street1: "N/A",
            city: "Bogotá",
            state: "Bogotá D.C.",
            country: "CO",
            postalCode: "110111",
            phone: params.phone,
          },
        },
      },
      payer: {
        fullName: params.fullName,
        emailAddress: params.userEmail,
        contactPhone: params.phone,
        dniType: params.documentType,
        dniNumber: params.documentNumber,
      },
      extraParameters: {
        FINANCIAL_INSTITUTION_CODE: params.financialInstitutionCode,
        USER_TYPE: params.personType,
        PSE_REFERENCE1: params.userEmail,
        PSE_REFERENCE2: params.documentType,
        PSE_REFERENCE3: params.documentNumber,
        RESPONSE_URL: `${siteUrl}/api/payu-response`,
      },
      type: "AUTHORIZATION_AND_CAPTURE",
      paymentMethod: "PSE",
      paymentCountry: "CO",
      deviceSessionId,
      ipAddress: params.ipAddress,
      cookie: `deviceId=${deviceSessionId}`,
      userAgent: params.userAgent,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      success: false,
      error: "No se pudo conectar con PayU. Inténtalo de nuevo.",
    };
  }

  if (!res.ok) {
    return {
      success: false,
      error: `Error de comunicación con PayU: ${res.status}`,
    };
  }

  const data: PayUAPIResponse = await res.json();

  if (data.code !== "SUCCESS") {
    return {
      success: false,
      error: data.error ?? "Error iniciando la transacción PSE",
    };
  }

  const txn = data.transactionResponse;

  if (!txn) {
    return { success: false, error: "Respuesta vacía de PayU" };
  }

  // PSE siempre inicia en PENDING y proporciona BANK_URL
  if (txn.state === "PENDING" && txn.extraParameters?.BANK_URL) {
    return {
      success: true,
      bankUrl: txn.extraParameters.BANK_URL,
      transactionId: txn.transactionId,
      orderId: String(txn.orderId),
      referenceCode,
      state: txn.state,
    };
  }

  if (txn.state === "DECLINED" || txn.state === "ERROR") {
    return {
      success: false,
      error: txn.responseMessage ?? "Transacción rechazada por el banco",
    };
  }

  return {
    success: false,
    error: `Estado inesperado: ${txn.state}. Contacta soporte si el débito fue realizado.`,
  };
}
