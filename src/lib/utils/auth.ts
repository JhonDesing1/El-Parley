import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function isPremiumUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("subscriptions")
    .select("status, tier")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing"])
    .in("tier", ["premium", "pro"])
    .maybeSingle();

  return Boolean(data);
}
