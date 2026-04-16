import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { buildPayUCheckoutParams, getPayUCheckoutUrl, PAYU_PLANS } from "@/lib/payu/client";
import type { PayUPlan } from "@/lib/payu/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/checkout-payu?plan=monthly|yearly[&tier=pro]
 *
 * Verifica auth, construye la firma y devuelve una página HTML con un
 * formulario que se auto-envía a PayU. PayU requiere un POST desde el browser
 * (no un redirect server-side), por eso se usa esta técnica.
 *
 * Parámetros:
 *   plan=monthly|yearly  — ciclo de facturación
 *   tier=pro             — si está presente, activa el plan Pro
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?redirect=/premium", req.url));
  }

  const { searchParams } = new URL(req.url);
  const tierParam = searchParams.get("tier");
  const billingParam = searchParams.get("plan");

  const billing: "monthly" | "yearly" = billingParam === "yearly" ? "yearly" : "monthly";
  const isPro = tierParam === "pro";
  const plan: PayUPlan = isPro ? `pro-${billing}` : billing;

  const referenceCode = `${PAYU_PLANS[plan].referencePrefix}-${randomUUID()}`;

  const params = buildPayUCheckoutParams({
    plan,
    userId: user.id,
    userEmail: user.email ?? "",
    referenceCode,
  });

  const checkoutUrl = getPayUCheckoutUrl();
  const formFields = Object.entries(params)
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(String(value))}" />`,
    )
    .join("\n    ");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redirigiendo a PayU…</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0a0a0a;
      color: #a1a1aa;
    }
    p { font-size: 0.9rem; }
  </style>
</head>
<body>
  <p>Redirigiendo a PayU…</p>
  <form id="payu-form" method="POST" action="${checkoutUrl}">
    ${formFields}
  </form>
  <script>document.getElementById("payu-form").submit();</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
