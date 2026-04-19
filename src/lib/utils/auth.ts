import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Devuelve el tier activo del usuario (free | premium | pro).
 * Usa una sola query para todos los checks de UI.
 */
export async function getUserTier(): Promise<"free" | "premium" | "pro"> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "free";

  const { data } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.tier as "free" | "premium" | "pro") ?? "free";
}

/** True si el usuario tiene suscripción premium o pro activa. */
export async function isPremiumUser(): Promise<boolean> {
  const tier = await getUserTier();
  return tier === "premium" || tier === "pro";
}

/** True si el usuario tiene suscripción pro activa. */
export async function isProUser(): Promise<boolean> {
  const tier = await getUserTier();
  return tier === "pro";
}

/** True si el email del usuario está en ADMIN_EMAILS (separados por coma). */
export async function isAdminUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(user.email.toLowerCase());
}
