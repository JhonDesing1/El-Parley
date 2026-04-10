import { redirect } from "next/navigation";
import { Sparkles, TrendingUp, Heart, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isPremiumUser } from "@/lib/utils/auth";

export const metadata = { title: "Dashboard — ApuestaValue" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard");

  const premium = await isPremiumUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: favorites } = await supabase
    .from("favorites")
    .select("match_id")
    .eq("user_id", user.id);

  const { data: userParlays } = await supabase
    .from("user_parlays")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">
            Hola, {profile?.username ?? user.email?.split("@")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">Bienvenido de vuelta</p>
        </div>
        {premium && <Badge variant="premium">PREMIUM ACTIVO</Badge>}
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={TrendingUp} label="ROI 30d" value={`${profile?.roi_30d ?? 0}%`} />
        <StatCard icon={Trophy} label="Win rate" value={`${profile?.win_rate ?? 0}%`} />
        <StatCard icon={Sparkles} label="Total picks" value={String(profile?.total_picks ?? 0)} />
        <StatCard icon={Heart} label="Favoritos" value={String(favorites?.length ?? 0)} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mis parlays recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {!userParlays?.length ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No has creado parlays todavía.
              </p>
            ) : (
              <ul className="space-y-2">
                {userParlays.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-md bg-muted/40 p-3"
                  >
                    <div>
                      <div className="text-sm font-semibold">{p.name ?? "Sin nombre"}</div>
                      <div className="text-xs text-muted-foreground">
                        x{Number(p.total_odds).toFixed(2)}
                      </div>
                    </div>
                    <Badge variant={p.status === "won" ? "value" : "outline"}>
                      {p.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tu rendimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Empieza a registrar tus picks para ver tu ROI auditado.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="font-mono text-3xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}
