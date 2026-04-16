"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MarketType } from "@/types";

export interface MatchOption {
  id: number;
  kickoff: string;
  label: string;
  league: string;
}

export interface BookmakerOption {
  id: number;
  name: string;
}

export async function getPickFormDataAction(): Promise<{
  matches: MatchOption[];
  bookmakers: BookmakerOption[];
}> {
  const supabase = await createClient();
  // Include matches that started up to 3h ago (still registerable as live/recent)
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const [matchesResult, bookmakersResult] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, kickoff, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name), league:leagues(name)",
      )
      .in("status", ["scheduled", "live"])
      .gte("kickoff", cutoff)
      .order("kickoff", { ascending: true })
      .limit(80),
    supabase.from("bookmakers").select("id, name").order("name"),
  ]);

  return {
    matches: (matchesResult.data ?? []).map((m: any) => ({
      id: m.id,
      kickoff: m.kickoff,
      label: `${m.home_team.name} vs ${m.away_team.name}`,
      league: m.league?.name ?? "",
    })),
    bookmakers: bookmakersResult.data ?? [],
  };
}

export async function voidPickAction(
  pickId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  // Verify pick belongs to user and is still pending
  const { data: pick } = await supabase
    .from("user_picks")
    .select("id, result")
    .eq("id", pickId)
    .eq("user_id", user.id)
    .single();

  if (!pick) return { ok: false, error: "Pick no encontrado" };
  if (pick.result !== "pending") return { ok: false, error: "Solo se pueden anular picks pendientes" };

  const { error } = await supabase
    .from("user_picks")
    .update({ result: "void" })
    .eq("id", pickId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Error al anular el pick" };

  revalidatePath("/mis-picks");
  return { ok: true };
}

export interface RegisterPickInput {
  matchId: number;
  market: MarketType;
  selection: string;
  odds: number;
  bookmakerId?: number;
  valueBetId?: number;
  stake?: number;
  line?: number;
  notes?: string;
}

export async function registerPickAction(
  input: RegisterPickInput,
): Promise<{ ok: boolean; pickId?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data, error } = await supabase.rpc("register_pick", {
    p_match_id: input.matchId,
    p_market: input.market,
    p_selection: input.selection,
    p_odds: input.odds,
    p_bookmaker_id: input.bookmakerId ?? undefined,
    p_value_bet_id: input.valueBetId ?? undefined,
    p_stake: input.stake ?? undefined,
    p_line: input.line ?? undefined,
    p_notes: input.notes ?? undefined,
  });

  if (error) {
    const msg =
      error.message === "match_not_available"
        ? "El partido ya no está disponible para registrar picks"
        : error.message === "not_authenticated"
          ? "Debes iniciar sesión"
          : "Error al registrar el pick";
    return { ok: false, error: msg };
  }

  revalidatePath("/mis-picks");
  revalidatePath("/dashboard");

  return { ok: true, pickId: data as string };
}
