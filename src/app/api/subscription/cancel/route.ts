import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscription/cancel
 *
 * Programa la cancelación de la suscripción activa del usuario al final del
 * período actual (cancel_at_period_end = true). El usuario mantiene acceso
 * hasta que expire. El cron expire-subscriptions se encarga del resto.
 *
 * No requiere body.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Buscar la suscripción activa
  const { data: subscription, error: fetchError } = await admin
    .from("subscriptions")
    .select("id, status, cancel_at_period_end")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("[cancel-sub] Error buscando suscripción:", fetchError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (!subscription) {
    return NextResponse.json({ error: "no_active_subscription" }, { status: 404 });
  }

  if (subscription.cancel_at_period_end) {
    // Ya estaba marcada para cancelar
    return NextResponse.json({ ok: true, alreadyScheduled: true });
  }

  const { error: updateError } = await admin
    .from("subscriptions")
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq("id", subscription.id);

  if (updateError) {
    console.error("[cancel-sub] Error actualizando suscripción:", updateError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  console.info("[cancel-sub] Cancelación programada para usuario", user.id);
  return NextResponse.json({ ok: true });
}
