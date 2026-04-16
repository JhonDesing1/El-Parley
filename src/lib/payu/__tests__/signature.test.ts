import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { generatePaymentSignature, verifyNotificationSignature } from "../signature";

const BASE = {
  apiKey: "testKey123",
  merchantId: "merchant01",
  referenceCode: "REF-001",
  currency: "COP",
};

describe("generatePaymentSignature", () => {
  it("produce el MD5 correcto del string canónico", () => {
    const amount = "19900";
    const expected = createHash("md5")
      .update(`${BASE.apiKey}~${BASE.merchantId}~${BASE.referenceCode}~${amount}~${BASE.currency}`)
      .digest("hex");

    expect(generatePaymentSignature({ ...BASE, amount })).toBe(expected);
  });

  it("es sensible al orden de los campos", () => {
    const sig1 = generatePaymentSignature({ ...BASE, amount: "19900" });
    const sig2 = generatePaymentSignature({ ...BASE, merchantId: "other", amount: "19900" });
    expect(sig1).not.toBe(sig2);
  });
});

describe("verifyNotificationSignature", () => {
  function buildSig(amount: string, state: string): string {
    // Simula el redondeo de PayU manualmente para el caso sin decimales relevantes
    const rounded = amount.includes(".") ? amount : `${amount}.0`;
    return createHash("md5")
      .update(`${BASE.apiKey}~${BASE.merchantId}~${BASE.referenceCode}~${rounded}~${BASE.currency}~${state}`)
      .digest("hex");
  }

  it("valida una firma correcta para pago aprobado", () => {
    const state = "4";
    const amount = "19900"; // → redondea a "19900.0"
    const sig = buildSig(amount, state);

    expect(
      verifyNotificationSignature({
        ...BASE,
        amount,
        transactionState: state,
        receivedSignature: sig,
      }),
    ).toBe(true);
  });

  it("rechaza una firma incorrecta", () => {
    expect(
      verifyNotificationSignature({
        ...BASE,
        amount: "19900",
        transactionState: "4",
        receivedSignature: "invalidsignaturehere",
      }),
    ).toBe(false);
  });

  it("redondea correctamente: segundo decimal >= 5 sube el primero", () => {
    // amount "100.75" → segundo decimal 5 >= 5 → redondea a "100.8"
    const state = "4";
    const rounded = "100.8";
    const sig = createHash("md5")
      .update(`${BASE.apiKey}~${BASE.merchantId}~${BASE.referenceCode}~${rounded}~${BASE.currency}~${state}`)
      .digest("hex");

    expect(
      verifyNotificationSignature({
        ...BASE,
        amount: "100.75",
        transactionState: state,
        receivedSignature: sig,
      }),
    ).toBe(true);
  });

  it("redondea correctamente: segundo decimal < 5 trunca a 1 decimal", () => {
    // amount "100.73" → segundo decimal 3 < 5 → trunca a "100.7"
    const state = "4";
    const rounded = "100.7";
    const sig = createHash("md5")
      .update(`${BASE.apiKey}~${BASE.merchantId}~${BASE.referenceCode}~${rounded}~${BASE.currency}~${state}`)
      .digest("hex");

    expect(
      verifyNotificationSignature({
        ...BASE,
        amount: "100.73",
        transactionState: state,
        receivedSignature: sig,
      }),
    ).toBe(true);
  });

  it("distingue estados de transacción diferentes", () => {
    const state4 = "4";
    const state6 = "6";
    const amount = "19900";
    const sig4 = buildSig(amount, state4);

    expect(
      verifyNotificationSignature({
        ...BASE,
        amount,
        transactionState: state6,
        receivedSignature: sig4,
      }),
    ).toBe(false);
  });
});
