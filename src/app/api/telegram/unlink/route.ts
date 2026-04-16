import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** POST /api/telegram/unlink — Desvincula la cuenta de Telegram del usuario. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ telegram_chat_id: null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
