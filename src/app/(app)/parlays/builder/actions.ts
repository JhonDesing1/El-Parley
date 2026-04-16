"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MarketType } from "@/types";

interface SaveLeg {
  matchId: number;
  matchLabel: string;
  market: string;
  selection: string;
  price: number;
  bookmakerSlug?: string;
  bookmakerId?: number;
}

export async function saveParlayAction(
  name: string,
  stake: number | null,
  totalOdds: number,
  legs: SaveLeg[],
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (legs.length < 2) return { ok: false, error: "Mínimo 2 selecciones" };
  if (legs.length > 12) return { ok: false, error: "Máximo 12 selecciones" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const potentialReturn = stake ? stake * totalOdds : null;

  const { data: parlay, error: parlayErr } = await supabase
    .from("user_parlays")
    .insert({
      user_id: user.id,
      name: name || `Parlay ${new Date().toLocaleDateString("es-CO")}`,
      total_odds: totalOdds,
      stake: stake ?? null,
      potential_return: potentialReturn,
      status: "pending",
    })
    .select("id")
    .single();

  if (parlayErr || !parlay) {
    return { ok: false, error: parlayErr?.message ?? "Error al guardar" };
  }

  const legRows = legs.map((leg, idx) => ({
    user_parlay_id: parlay.id,
    match_id: leg.matchId,
    market: leg.market as MarketType,
    selection: leg.selection,
    price: leg.price,
    bookmaker_id: leg.bookmakerId ?? null,
    leg_order: idx + 1,
    result: "pending" as const,
  }));

  const { error: legsErr } = await supabase.from("user_parlay_legs").insert(legRows);
  if (legsErr) {
    // Cleanup orphan parlay header
    await supabase.from("user_parlays").delete().eq("id", parlay.id);
    return { ok: false, error: legsErr.message };
  }

  revalidatePath("/dashboard");
  return { ok: true, id: parlay.id };
}
