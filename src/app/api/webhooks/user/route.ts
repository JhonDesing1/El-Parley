import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set(["value_bet", "parlay", "result"]);
const MAX_WEBHOOKS_PER_USER = 10;

/** POST /api/webhooks/user — Crear webhook */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verificar Pro
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", user.id)
    .eq("tier", "pro")
    .in("status", ["active", "trialing"])
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  const body = await req.json();
  const url: string = body.url?.trim() ?? "";
  const events: string[] = Array.isArray(body.events) ? body.events : ["value_bet"];

  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  const validEvents = events.filter((e) => ALLOWED_EVENTS.has(e));
  if (validEvents.length === 0) {
    return NextResponse.json({ error: "Al menos un evento es requerido" }, { status: 400 });
  }

  // Limitar número de webhooks
  const { count } = await supabase
    .from("user_webhooks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= MAX_WEBHOOKS_PER_USER) {
    return NextResponse.json(
      { error: `Límite de ${MAX_WEBHOOKS_PER_USER} webhooks alcanzado` },
      { status: 400 },
    );
  }

  const secret = `whsec_${randomBytes(24).toString("hex")}`;

  const { data: webhook, error } = await supabase
    .from("user_webhooks")
    .insert({
      user_id: user.id,
      url,
      secret,
      events: validEvents,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("[api/webhooks/user] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ webhook }, { status: 201 });
}

/** PATCH /api/webhooks/user — Activar/pausar webhook */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, is_active } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await supabase
    .from("user_webhooks")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}

/** DELETE /api/webhooks/user?id=... — Eliminar webhook */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await supabase
    .from("user_webhooks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
