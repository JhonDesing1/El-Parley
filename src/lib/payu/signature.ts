import { createHash } from "crypto";

/**
 * Genera la firma HMAC-MD5 para el formulario de pago de PayU.
 *
 * Fórmula: MD5("apiKey~merchantId~referenceCode~amount~currency")
 * Docs: https://developers.payulatam.com/latam/es/docs/integrations/webcheckout-integration/payment-form.html
 */
export function generatePaymentSignature({
  apiKey,
  merchantId,
  referenceCode,
  amount,
  currency,
}: {
  apiKey: string;
  merchantId: string;
  referenceCode: string;
  amount: string;
  currency: string;
}): string {
  const raw = `${apiKey}~${merchantId}~${referenceCode}~${amount}~${currency}`;
  return createHash("md5").update(raw).digest("hex");
}

/**
 * Verifica la firma incluida en la notificación IPN de PayU.
 *
 * Fórmula: MD5("apiKey~merchantId~referenceCode~roundedAmount~currency~transactionState")
 * El amount se redondea a 1 decimal según las reglas de PayU.
 * Docs: https://developers.payulatam.com/latam/es/docs/integrations/webcheckout-integration/payment-confirmation.html
 */
export function verifyNotificationSignature({
  apiKey,
  merchantId,
  referenceCode,
  amount,
  currency,
  transactionState,
  receivedSignature,
}: {
  apiKey: string;
  merchantId: string;
  referenceCode: string;
  amount: string;
  currency: string;
  transactionState: string;
  receivedSignature: string;
}): boolean {
  // PayU redondea el valor según su algoritmo específico:
  // si el tercer decimal >= 5 se redondea al alza, si no se trunca a 1 decimal
  const rounded = roundPayUAmount(amount);
  const raw = `${apiKey}~${merchantId}~${referenceCode}~${rounded}~${currency}~${transactionState}`;
  const expected = createHash("md5").update(raw).digest("hex");
  return expected === receivedSignature;
}

/**
 * Aplica el redondeo de PayU para verificación de firmas.
 * PayU usa la siguiente lógica:
 *   - Toma el valor con 1 decimal
 *   - Si el tercer decimal es >= 5 sube el segundo decimal en 1
 *   - En caso contrario, trunca a 1 decimal
 */
function roundPayUAmount(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;

  const str = num.toFixed(2); // "19900.00"
  const parts = str.split(".");
  const decimals = parts[1] ?? "00";

  // tercer decimal no existe (es 0), usar 1 decimal
  const firstDecimal = decimals[0] ?? "0";
  const secondDecimal = parseInt(decimals[1] ?? "0", 10);

  if (secondDecimal >= 5) {
    // redondear: sumar 1 al primer decimal
    const rounded = (parseInt(firstDecimal, 10) + 1).toString();
    return `${parts[0]}.${rounded}`;
  }

  return `${parts[0]}.${firstDecimal}`;
}
