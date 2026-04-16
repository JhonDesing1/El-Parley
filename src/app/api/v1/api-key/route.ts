import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/api-key
 * Devuelve la API key actual del usuario autenticado.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("api_key")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ apiKey: profile?.api_key ?? null });
}

/**
 * POST /api/v1/api-key
 * Genera (o rota) la API key del usuario. Requiere suscripción Pro activa.
 * La key anterior queda inmediatamente invalidada.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", user.id)
    .eq("tier", "pro")
    .in("status", ["active", "trialing"])
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json(
      { error: "Active Pro subscription required" },
      { status: 403 },
    );
  }

  const newKey = `av_pro_${randomBytes(24).toString("hex")}`;
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ api_key: newKey })
    .eq("id", user.id);

  if (error) {
    console.error("[api/v1/api-key] Error al guardar la key:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ apiKey: newKey });
}
