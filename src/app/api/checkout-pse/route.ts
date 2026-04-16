import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPSETransaction } from "@/lib/pse/client";
import type { PSEDocumentType, PSEPersonType } from "@/lib/pse/types";
import type { PayUPlan } from "@/lib/payu/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout-pse
 *
 * Inicia una transacción PSE vía la Payments API de PayU.
 * A diferencia del checkout con tarjeta (formulario POST → PayU), PSE requiere:
 *   1. El usuario selecciona su banco en nuestro formulario.
 *   2. Llamamos a la API de PayU con todos los datos.
 *   3. PayU devuelve una BANK_URL.
 *   4. El cliente redirige al usuario al portal bancario.
 *   5. El banco confirma/rechaza el débito y redirige de vuelta.
 *   6. PayU notifica el resultado final vía IPN a /api/webhooks/payu.
 *
 * Body esperado (JSON):
 *   plan                   — "monthly" | "yearly" | "pro-monthly" | "pro-yearly"
 *   fullName               — Nombre completo del pagador
 *   documentType           — CC | CE | NIT | TI | PP | IDC | CEL | RC | DE
 *   documentNumber         — Número de documento
 *   phone                  — Teléfono de contacto
 *   personType             — "N" (Natural) | "J" (Jurídica)
 *   financialInstitutionCode — Código PSE del banco (de /api/pse/banks)
 *   ipAddress              — IP del cliente (enviada por el form)
 *   userAgent              — User-Agent del navegador
 */
export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // ── Parsear body ────────────────────────────────────────────────────────────
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    plan,
    fullName,
    documentType,
    documentNumber,
    phone,
    personType,
    financialInstitutionCode,
    ipAddress,
    userAgent,
  } = body;

  // ── Validar campos requeridos ───────────────────────────────────────────────
  if (
    !plan ||
    !fullName ||
    !documentType ||
    !documentNumber ||
    !phone ||
    !personType ||
    !financialInstitutionCode
  ) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const validPlans: PayUPlan[] = ["monthly", "yearly", "pro-monthly", "pro-yearly"];
  if (!validPlans.includes(plan as PayUPlan)) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  // ── Iniciar transacción PSE ─────────────────────────────────────────────────
  const result = await createPSETransaction({
    plan: plan as PayUPlan,
    userId: user.id,
    userEmail: user.email ?? "",
    fullName,
    documentType: documentType as PSEDocumentType,
    documentNumber,
    phone,
    personType: personType as PSEPersonType,
    financialInstitutionCode,
    // Fallback a IP/UA del header si el cliente no los envía
    ipAddress: ipAddress || req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1",
    userAgent: userAgent || req.headers.get("user-agent") || "unknown",
  });

  if (!result.success) {
    console.error("[checkout-pse] Transacción fallida:", result.error, { userId: user.id, plan });
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({
    bankUrl: result.bankUrl,
    transactionId: result.transactionId,
    referenceCode: result.referenceCode,
  });
}
