import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Vercel Cron — corre cada hora.
 * Refresca la vista materializada public.leaderboard para mantener
 * el ranking de tipsters actualizado sin lectura en caliente.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("refresh_leaderboard");

  if (error) {
    console.error("[refresh-leaderboard cron] RPC error:", error);
    return NextResponse.json(
      { error: "rpc failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
