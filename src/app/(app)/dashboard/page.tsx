import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, TrendingUp, Heart, Trophy, ClipboardList, ArrowRight, Code2, BarChart2, Send, Webhook, BookOpen, Target, Crown, CheckCircle2, Zap, RefreshCw } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUserTier } from "@/lib/utils/auth";
import { upsertSubscription } from "@/lib/billing/upsert-subscription";

export const metadata = { title: "Dashboard — El Parley" };

/** Verifica el pago de MP en el momento del redirect (antes de que llegue el IPN). */
async function tryActivateMPPayment(paymentId: string, userId: string): Promise<boolean> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return false;
  try {
    const { MercadoPagoConfig, Payment } = await import("mercadopago");
    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: Number(paymentId) });

    const metaUserId = payment.metadata?.user_id as string | undefined;
    if (metaUserId !== userId) return false;
    if (payment.status !== "approved") return false;

    const plan = (payment.metadata?.plan ?? "monthly") as "monthly" | "yearly";
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (plan === "yearly" ? 12 : 1));

    const adminSupabase = createAdminClient();
    await upsertSubscription({
      supabase: adminSupabase,
      userId,
      provider: "mercadopago",
      providerCustomerId: String(payment.payer?.id ?? payment.payer?.email ?? ""),
      providerSubscriptionId: String(payment.id),
      tier: "premium",
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
    });
    await adminSupabase.from("profiles").update({ tier: "premium" }).eq("id", userId);
    return true;
  } catch {
    return false;
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const params = await searchParams;

  // Si viene del checkout de MP con payment_id, verificar y activar inmediatamente
  // (el IPN puede llegar segundos después del redirect — esto evita el delay)
  const incomingPaymentId = params.payment_id ?? params.collection_id;
  if (params.welcome === "premium" && incomingPaymentId) {
    await tryActivateMPPayment(incomingPaymentId, user.id);
  }

  const tier = await getUserTier();
  const premium = tier === "premium" || tier === "pro";
  const pro = tier === "pro";

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

  const { data: recentPicks, count: pendingCount } = await supabase
    .from("user_picks")
    .select(
      `id, market, selection, odds, result, profit_loss,
       match:matches(home_team:teams!home_team_id(name), away_team:teams!away_team_id(name))`,
      { count: "estimated" },
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { count: pendingPicksCount } = await supabase
    .from("user_picks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("result", "pending");

  // Win rate de la plataforma para bets de alta confianza
  const { data: highConfResolved } = await supabase
    .from("value_bets")
    .select("result")
    .eq("confidence", "high")
    .in("result", ["won", "lost"]);
  const hcTotal = (highConfResolved ?? []).length;
  const hcWon = (highConfResolved ?? []).filter((r) => r.result === "won").length;
  const platformWinRate = hcTotal >= 10 ? Math.round((hcWon / hcTotal) * 100) : null;

  return (
    <div className="container max-w-6xl py-8">
      {params.welcome === "premium" && premium && (
        <div className="mb-8 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
              <Crown className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-emerald-400">
                ¡Bienvenido a Premium, {profile?.username ?? user.email?.split("@")[0]}!
              </h2>
              <p className="text-sm text-emerald-400/70">Tu suscripción ya está activa. Aquí tienes todo lo que puedes hacer:</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Link href="/value-bets" className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 transition-colors hover:bg-emerald-500/15">
              <Zap className="h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-emerald-300">Value Bets</div>
                <div className="text-xs text-emerald-400/60">Ilimitadas, sin restricciones</div>
              </div>
            </Link>
            <Link href="/parlays" className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 transition-colors hover:bg-emerald-500/15">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-emerald-300">Parlays IA</div>
                <div className="text-xs text-emerald-400/60">Combinadas generadas por IA</div>
              </div>
            </Link>
            <Link href="/telegram" className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 transition-colors hover:bg-emerald-500/15">
              <Send className="h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-emerald-300">Bot Telegram</div>
                <div className="text-xs text-emerald-400/60">Alertas en tiempo real</div>
              </div>
            </Link>
            <Link href="/bankroll" className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 transition-colors hover:bg-emerald-500/15">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-emerald-300">Kelly Calculator</div>
                <div className="text-xs text-emerald-400/60">Gestión de bankroll óptima</div>
              </div>
            </Link>
          </div>
        </div>
      )}
      {params.welcome === "premium" && !premium && (
        <div className="mb-8 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-6">
          <div className="flex items-start gap-3">
            <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-yellow-400" />
            <div>
              <h2 className="font-semibold text-yellow-400">Activando tu suscripción Premium…</h2>
              <p className="mt-1 text-sm text-yellow-400/70">
                Tu pago fue recibido. El acceso Premium puede tardar hasta 1 minuto en activarse.{" "}
                <Link href="/dashboard?welcome=premium" className="underline hover:text-yellow-300">
                  Actualizar página
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
      {params.welcome === "pro" && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Pago confirmado — bienvenido a Pro. Tienes acceso a la API REST, backtesting y todas las funciones profesionales.
        </div>
      )}
      {params.pending === "true" && (
        <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          Tu pago está pendiente de confirmación (PSE / efectivo). Te notificaremos por email cuando se acredite. El acceso se activará automáticamente.
        </div>
      )}

      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">
            Hola, {profile?.username ?? user.email?.split("@")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">Bienvenido de vuelta</p>
        </div>
        {pro && <Badge className="border-amber-500/50 bg-amber-500/10 text-amber-400">PRO ACTIVO</Badge>}
        {!pro && premium && <Badge variant="premium">PREMIUM ACTIVO</Badge>}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Mi ROI 30d"
          value={`${profile?.roi_30d ?? 0}%`}
          valueClass={(profile?.roi_30d ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <StatCard
          icon={Trophy}
          label="Cuotas acertadas"
          value={(((profile?.win_rate ?? 0) / 100)).toFixed(2)}
          valueClass={
            (profile?.win_rate ?? 0) >= 55
              ? "text-emerald-400"
              : (profile?.win_rate ?? 0) >= 45
                ? undefined
                : "text-red-400"
          }
        />
        <StatCard
          icon={Target}
          label="Cuotas acertadas"
          value={platformWinRate !== null ? (platformWinRate / 100).toFixed(2) : "—"}
          valueClass={
            platformWinRate !== null
              ? platformWinRate >= 60
                ? "text-emerald-400"
                : platformWinRate >= 50
                  ? undefined
                  : "text-red-400"
              : "text-muted-foreground"
          }
          sub={hcTotal >= 10 ? `Plataforma · alta confianza · ${hcTotal} bets` : "Plataforma · sin datos aún"}
        />
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Mis apuestas recientes
              {!!pendingPicksCount && pendingPicksCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400 ring-1 ring-amber-500/25">
                  {pendingPicksCount} pendiente{pendingPicksCount !== 1 ? "s" : ""}
                </span>
              )}
            </CardTitle>
            <Link
              href="/mis-picks"
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {!recentPicks?.length ? (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Sin apuestas registradas aún.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ve a la ficha de un partido y haz clic en{" "}
                  <span className="font-semibold text-foreground">Registrar apuesta</span>.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {(recentPicks as any[]).map((pick) => {
                  const home = pick.match?.home_team?.name ?? "?";
                  const away = pick.match?.away_team?.name ?? "?";
                  const resultColors: Record<string, string> = {
                    won: "text-emerald-400",
                    lost: "text-red-400",
                    pending: "text-amber-400",
                    void: "text-muted-foreground",
                  };
                  return (
                    <li
                      key={pick.id}
                      className="flex items-center justify-between rounded-md bg-muted/40 p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {home} vs {away}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {pick.selection} · x{Number(pick.odds).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={`text-xs font-bold uppercase ${resultColors[pick.result] ?? "text-muted-foreground"}`}
                        >
                          {pick.result === "pending"
                            ? "Pendiente"
                            : pick.result === "won"
                              ? "Ganado"
                              : pick.result === "lost"
                                ? "Perdido"
                                : "Nulo"}
                        </span>
                        {pick.profit_loss != null && (
                          <span
                            className={`font-mono text-xs tabular-nums ${Number(pick.profit_loss) >= 0 ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {Number(pick.profit_loss) >= 0 ? "+" : ""}$
                            {Math.abs(Number(pick.profit_loss)).toLocaleString("es-CO")}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 font-display text-lg font-bold">Aprende</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Link href="/bankroll" className="group rounded-xl border border-border/50 bg-muted/30 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
            <BookOpen className="mb-2 h-5 w-5 text-primary" />
            <div className="text-sm font-semibold">Gestión de Bankroll</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Métodos de staking, Kelly y calculadora de stake</div>
          </Link>
        </div>
      </div>

      {premium && !pro && (
        <div className="mt-8">
          <h2 className="mb-4 font-display text-lg font-bold">Herramientas Premium</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Link href="/value-bets" className="group rounded-xl border border-border/50 bg-muted/30 p-4 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5">
              <Zap className="mb-2 h-5 w-5 text-emerald-400" />
              <div className="text-sm font-semibold">Value Bets Ilimitadas</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Todas las oportunidades de valor, sin límite</div>
            </Link>
            <Link href="/parlays" className="group rounded-xl border border-border/50 bg-muted/30 p-4 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5">
              <Sparkles className="mb-2 h-5 w-5 text-emerald-400" />
              <div className="text-sm font-semibold">Parlays IA</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Combinadas curadas por inteligencia artificial</div>
            </Link>
            <Link href="/telegram" className="group rounded-xl border border-border/50 bg-muted/30 p-4 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5">
              <Send className="mb-2 h-5 w-5 text-emerald-400" />
              <div className="text-sm font-semibold">Bot Telegram</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Alertas de value bets en tiempo real</div>
            </Link>
          </div>
        </div>
      )}

      {pro && (
        <div className="mt-8">
          <h2 className="mb-4 font-display text-lg font-bold">Herramientas Pro</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <Link href="/backtesting" className="group rounded-xl border border-border/50 bg-muted/30 p-4 transition-colors hover:border-amber-500/40 hover:bg-amber-500/5">
              <BarChart2 className="mb-2 h-5 w-5 text-amber-400" />
              <div className="text-sm font-semibold">Backtesting</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Analiza el rendimiento histórico de value bets</div>
            </Link>
            <Link href="/api-key" className="group rounded-xl border border-border/50 bg-muted/30 p-4 transition-colors hover:border-amber-500/40 hover:bg-amber-500/5">
              <Code2 className="mb-2 h-5 w-5 text-amber-400" />
              <div className="text-sm font-semibold">API REST</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Accede a tus datos desde cualquier app</div>
            </Link>
            <Link href="/telegram" className="group rounded-xl border border-border/50 bg-muted/30 p-4 transition-colors hover:border-amber-500/40 hover:bg-amber-500/5">
              <Send className="mb-2 h-5 w-5 text-amber-400" />
              <div className="text-sm font-semibold">Bot Telegram</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Recibe alertas de value bets en Telegram</div>
            </Link>
            <Link href="/webhooks" className="group rounded-xl border border-border/50 bg-muted/30 p-4 transition-colors hover:border-amber-500/40 hover:bg-amber-500/5">
              <Webhook className="mb-2 h-5 w-5 text-amber-400" />
              <div className="text-sm font-semibold">Webhooks</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Envía eventos a tus propios endpoints</div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  valueClass,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`font-mono text-3xl font-bold tabular-nums ${valueClass ?? ""}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}
