/**
 * Tipos TypeScript para la integración PSE (Pago Seguro en Línea) vía PayU.
 * PSE es el sistema de débito bancario online en Colombia.
 * Documentación: https://developers.payulatam.com/latam/es/docs/integrations/api-integration/payments-api-colombia.html
 */

import type { PayUPlan } from "@/lib/payu/types";

// ─── Bancos ───────────────────────────────────────────────────────────────────

export interface PSEBank {
  pseCode: string;
  description: string;
}

// ─── Datos del pagador ────────────────────────────────────────────────────────

export type PSEPersonType = "N" | "J"; // Natural | Jurídica

export type PSEDocumentType =
  | "CC"   // Cédula de ciudadanía
  | "CE"   // Cédula de extranjería
  | "NIT"  // NIT empresa
  | "TI"   // Tarjeta de identidad
  | "PP"   // Pasaporte
  | "IDC"  // Identificador único cliente
  | "CEL"  // Número celular
  | "RC"   // Registro civil
  | "DE";  // Documento de identificación extranjero

// ─── Request de creación de transacción ──────────────────────────────────────

export interface PSETransactionRequest {
  plan: PayUPlan;
  userId: string;
  userEmail: string;
  // Datos del pagador
  fullName: string;
  documentType: PSEDocumentType;
  documentNumber: string;
  phone: string;
  personType: PSEPersonType;
  financialInstitutionCode: string; // Código del banco PSE
  // Datos del dispositivo (enviados desde el cliente)
  ipAddress: string;
  userAgent: string;
}

// ─── Response de creación de transacción ─────────────────────────────────────

export interface PSETransactionResponse {
  success: boolean;
  bankUrl?: string;       // URL del portal bancario para redirigir al usuario
  transactionId?: string;
  orderId?: string;
  referenceCode?: string;
  state?: string;
  error?: string;
}

// ─── PayU Payments API — Request ─────────────────────────────────────────────

export interface PayUAdditionalValues {
  TX_VALUE: { value: number; currency: "COP" };
  TX_TAX: { value: number; currency: "COP" };
  TX_TAX_RETURN_BASE: { value: number; currency: "COP" };
}

export interface PayUPSEOrder {
  accountId: string;
  referenceCode: string;
  description: string;
  language: "es";
  signature: string;
  notifyUrl: string;
  additionalValues: PayUAdditionalValues;
  partner1: string; // userId — se devuelve como extra1 en el IPN
  partner2: string; // plan   — se devuelve como extra2 en el IPN
  buyer: {
    merchantBuyerId: string;
    fullName: string;
    emailAddress: string;
    contactPhone: string;
    dniNumber: string;
    shippingAddress: {
      street1: string;
      city: string;
      state: string;
      country: "CO";
      postalCode: string;
      phone: string;
    };
  };
}

export interface PayUPSETransactionBody {
  language: "es";
  command: "SUBMIT_TRANSACTION";
  merchant: { apiLogin: string; apiKey: string };
  test: boolean;
  transaction: {
    order: PayUPSEOrder;
    payer: {
      fullName: string;
      emailAddress: string;
      contactPhone: string;
      dniType: PSEDocumentType;
      dniNumber: string;
    };
    extraParameters: {
      FINANCIAL_INSTITUTION_CODE: string;
      USER_TYPE: PSEPersonType;
      PSE_REFERENCE1: string; // Referencia 1 (ej. email)
      PSE_REFERENCE2: string; // Referencia 2 (ej. tipo documento)
      PSE_REFERENCE3: string; // Referencia 3 (ej. número documento)
      RESPONSE_URL: string;
    };
    type: "AUTHORIZATION_AND_CAPTURE";
    paymentMethod: "PSE";
    paymentCountry: "CO";
    deviceSessionId: string;
    ipAddress: string;
    cookie: string;
    userAgent: string;
  };
}

// ─── PayU Payments API — Response ────────────────────────────────────────────

export interface PayUAPITransactionResponse {
  orderId: number;
  transactionId: string;
  state: "PENDING" | "APPROVED" | "DECLINED" | "ERROR";
  paymentNetworkResponseCode?: string;
  paymentNetworkResponseErrorMessage?: string;
  trazabilityCode?: string;
  authorizationCode?: string;
  pendingReason?: string;
  responseCode?: string;
  errorCode?: string;
  responseMessage?: string;
  transactionDate?: string;
  transactionTime?: string;
  operationDate?: string;
  extraParameters?: {
    BANK_URL?: string;
    [key: string]: string | undefined;
  };
}

export interface PayUAPIResponse {
  code: "SUCCESS" | "ERROR";
  error?: string;
  transactionResponse?: PayUAPITransactionResponse;
}

// ─── Bank list API ────────────────────────────────────────────────────────────

export interface PayUBankListRequest {
  language: "es";
  command: "GET_BANKS_LIST";
  merchant: { apiLogin: string; apiKey: string };
  test: boolean;
  bankListInformation: {
    paymentMethod: "PSE";
    paymentCountry: "CO";
  };
}

export interface PayUBankListResponse {
  code: "SUCCESS" | "ERROR";
  error?: string;
  banks: PSEBank[];
}
