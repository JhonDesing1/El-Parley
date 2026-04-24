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
 * Consulta 2 fuentes de verdad — primero suscripción activa con periodo vigente,
 * luego profiles.tier como respaldo (grants manuales, migraciones legacy, etc.).
 */
export async function getUserTier(): Promise<"free" | "premium" | "pro"> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "free";

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier, current_period_end")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subTier = sub?.tier as "free" | "premium" | "pro" | undefined;
  if (subTier === "premium" || subTier === "pro") {
    // Si hay fin de periodo y ya pasó, lo descartamos — evita servir suscripciones vencidas
    const end = sub?.current_period_end ? new Date(sub.current_period_end as string) : null;
    if (!end || end.getTime() >= Date.now()) return subTier;
  }

  // Fallback: tier del perfil — cubre upgrades manuales y races con el webhook MP
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle();

  const profileTier = profile?.tier as "free" | "premium" | "pro" | undefined;
  return profileTier ?? "free";
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
