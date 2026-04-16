import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createMPPreference, MP_PLANS } from "@/lib/mercadopago/client";
import type { MPPlan } from "@/lib/mercadopago/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/checkout-mp?plan=monthly|yearly
 *
 * Crea una preferencia en Mercado Pago y redirige al usuario al checkout.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?redirect=/premium", req.url));
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Pagos no configurados" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const planParam = searchParams.get("plan");
  const plan: MPPlan = planParam === "yearly" ? "yearly" : "monthly";
  const referenceCode = `${MP_PLANS[plan].referencePrefix}-${randomUUID()}`;

  try {
    const preference = await createMPPreference({
      plan,
      userId: user.id,
      userEmail: user.email ?? "",
      referenceCode,
    });

    const checkoutUrl = preference.init_point;
    if (!checkoutUrl) {
      throw new Error("No se obtuvo init_point de Mercado Pago");
    }

    return NextResponse.redirect(checkoutUrl, 303);
  } catch (error) {
    console.error("[checkout-mp] Error creando preferencia:", error);
    return NextResponse.redirect(new URL("/premium?payment=error", req.url));
  }
}
