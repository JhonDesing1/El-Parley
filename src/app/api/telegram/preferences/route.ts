import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** POST /api/telegram/preferences — Guarda las preferencias de alertas Telegram del usuario. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).value_bets !== "boolean" ||
    typeof (body as Record<string, unknown>).results !== "boolean" ||
    typeof (body as Record<string, unknown>).parlays !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { value_bets, results, parlays } = body as {
    value_bets: boolean;
    results: boolean;
    parlays: boolean;
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ tg_value_bets: value_bets, tg_results: results, tg_parlays: parlays })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
