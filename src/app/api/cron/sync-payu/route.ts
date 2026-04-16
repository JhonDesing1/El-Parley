import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/sync-payu
 * Vercel Cron — corre cada 24h.
 *
 * Cancela suscripciones PayU que llevan más de 7 días en estado `incomplete`
 * (pagos PSE / efectivo abandonados o rechazados tardíamente).
 *
 * PayU no ofrece webhooks retroactivos — si el IPN no llegó en 7 días,
 * el pago no se completó y el acceso no debe mantenerse activo.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Umbral: 7 días atrás
  const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Buscar suscripciones PayU en `incomplete` con más de 7 días sin cambio
  const { data: stale, error } = await supabase
    .from("subscriptions")
    .select("id, user_id, provider_subscription_id, updated_at")
    .eq("provider", "payu")
    .eq("status", "incomplete")
    .lt("updated_at", threshold);

  if (error) {
    console.error("[sync-payu] Error al consultar suscripciones:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!stale || stale.length === 0) {
    return NextResponse.json({ canceled: 0 });
  }

  // 2. Cancelar en lote
  const ids = stale.map((s) => s.id);
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .in("id", ids);

  if (updateError) {
    console.error("[sync-payu] Error al cancelar suscripciones:", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 3. Degradar perfil a free solo si no tienen otra suscripción activa
  const results = await Promise.allSettled(
    stale.map(async (sub) => {
      const { data: active } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", sub.user_id)
        .in("status", ["active", "trialing"])
        .limit(1)
        .single();

      if (!active) {
        await supabase
          .from("profiles")
          .update({ tier: "free" })
          .eq("id", sub.user_id);
      }
    }),
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.warn(`[sync-payu] ${failed} perfiles no pudieron degradarse`);
  }

  console.info(`[sync-payu] Canceladas ${ids.length} suscripciones incompletas`);
  return NextResponse.json({ canceled: ids.length });
}
