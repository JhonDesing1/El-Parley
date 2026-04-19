"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/utils/auth";

export interface TipsterPickInput {
  tipster_name?: string;
  match_id?: number | null;
  match_label?: string;
  league_label?: string;
  kickoff?: string;
  market: string;
  selection: string;
  odds: number;
  stake_units?: number;
  reasoning?: string;
  notes?: string;
}

export async function createTipsterPickAction(
  input: TipsterPickInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdminUser())) return { ok: false, error: "No autorizado" };

  const supabase = createAdminClient() as any;
  const { error } = await supabase.from("tipster_picks").insert({
    tipster_name: input.tipster_name || "El Parley",
    match_id: input.match_id ?? null,
    match_label: input.match_label || null,
    league_label: input.league_label || null,
    kickoff: input.kickoff || null,
    market: input.market,
    selection: input.selection,
    odds: input.odds,
    stake_units: input.stake_units ?? 1,
    reasoning: input.reasoning || null,
    notes: input.notes || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/tipster-picks");
  revalidatePath("/picks");
  return { ok: true };
}

export async function resolveTipsterPickAction(
  id: number,
  result: "won" | "lost" | "void",
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdminUser())) return { ok: false, error: "No autorizado" };

  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("tipster_picks")
    .update({ result })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/tipster-picks");
  revalidatePath("/picks");
  return { ok: true };
}

export async function deleteTipsterPickAction(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdminUser())) return { ok: false, error: "No autorizado" };

  const supabase = createAdminClient() as any;
  const { error } = await supabase.from("tipster_picks").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/tipster-picks");
  revalidatePath("/picks");
  return { ok: true };
}

export async function togglePublishedAction(
  id: number,
  published: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdminUser())) return { ok: false, error: "No autorizado" };

  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("tipster_picks")
    .update({ published })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/tipster-picks");
  revalidatePath("/picks");
  return { ok: true };
}
