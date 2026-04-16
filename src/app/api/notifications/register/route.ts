import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/notifications/register
 * Guarda el OneSignal player_id en notification_subscriptions.
 * Solo para usuarios autenticados.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { player_id } = body as { player_id?: string };

  if (!player_id || typeof player_id !== "string") {
    return NextResponse.json({ error: "player_id required" }, { status: 400 });
  }

  const { error } = await supabase.from("notification_subscriptions").upsert(
    {
      user_id: user.id,
      onesignal_player_id: player_id,
      push_value_bets: true,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[notifications/register]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
