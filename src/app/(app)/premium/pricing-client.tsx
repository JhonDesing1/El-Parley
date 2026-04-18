"use client"

import { useState } from "react"
import { Check, X, Zap, Crown, Sparkles, CalendarClock } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"

export type CurrentPlan = "monthly" | "yearly" | null
export type SubscriptionStatus = "active" | "trialing" | "canceled" | "past_due" | null

const plans = [
  {
    id: "free" as const,
    name: "Gratis",
    icon: Zap,
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Perfecto para comenzar a explorar el mundo del betting inteligente",
    features: [
      { name: "Value bets básicas (6/día)", included: true },
      { name: "Comparador de cuotas", included: true },
      { name: "Partidos del día", included: true },
      { name: "Value bets ilimitadas", included: false },
      { name: "Parlays generados por IA", included: false },
      { name: "Alertas por Telegram", included: false },
      { name: "Kelly calculator", included: false },
      { name: "Backtesting", included: false },
    ],
    cta: "Empezar gratis",
    ctaLink: "/register",
    highlighted: false,
    badge: null,
  },
  {
    id: "premium" as const,
    name: "Premium",
    icon: Crown,
    monthlyPrice: 10000,
    yearlyPrice: Math.round(10000 * 12 * 0.8),
    description: "Para apostadores serios que buscan ventaja competitiva",
    features: [
      { name: "Value bets básicas (6/día)", included: true },
      { name: "Comparador de cuotas", included: true },
      { name: "Partidos del día", included: true },
      { name: "Value bets ilimitadas", included: true },
      { name: "Parlays generados por IA", included: true },
      { name: "Alertas por Telegram", included: true },
      { name: "Kelly calculator", included: true },
      { name: "Backtesting", included: true },
      { name: "Badge Premium", included: true },
    ],
    highlighted: true,
    badge: "Más popular",
  },
  {
    id: "pro" as const,
    name: "Pro",
    icon: Sparkles,
    monthlyPrice: 39900,
    yearlyPrice: Math.round(39900 * 12 * 0.8),
    description: "Acceso completo con herramientas profesionales y soporte dedicado",
    features: [
      { name: "Value bets básicas (6/día)", included: true },
      { name: "Comparador de cuotas", included: true },
      { name: "Partidos del día", included: true },
      { name: "Value bets ilimitadas", included: true },
      { name: "Parlays generados por IA", included: true },
      { name: "Alertas por Telegram", included: true },
      { name: "Kelly calculator", included: true },
      { name: "Backtesting", included: true },
      { name: "Badge PRO dorado", included: true },
      { name: "API access", included: true },
      { name: "Soporte prioritario", included: true },
    ],
    highlighted: false,
    badge: null,
  },
]

function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

interface PricingClientProps {
  currentPlan: CurrentPlan
  subscriptionStatus: SubscriptionStatus
  cancelAtPeriodEnd: boolean
  periodEnd: string | null // ISO date
}

export default function PricingClient({
  currentPlan,
  subscriptionStatus,
  cancelAtPeriodEnd,
  periodEnd,
}: PricingClientProps) {
  const [isYearly, setIsYearly] = useState(currentPlan === "yearly")
  const [loadingDowngrade, setLoadingDowngrade] = useState(false)
  const router = useRouter()

  const isActivePremium =
    subscriptionStatus === "active" || subscriptionStatus === "trialing"

  async function handleDowngrade() {
    if (!confirm("¿Confirmas el cambio a plan mensual al vencer tu suscripción actual?")) return
    setLoadingDowngrade(true)
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" })
      if (!res.ok) throw new Error("Error al programar el cambio")
      router.refresh()
    } catch {
      alert("Ocurrió un error. Intenta de nuevo o escríbenos a soporte@elparley.co")
    } finally {
      setLoadingDowngrade(false)
    }
  }

  const selectedInterval = isYearly ? "yearly" : "monthly"

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Precios de{" "}
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
              El Parley
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
            Elige el plan que mejor se adapte a tu estilo de apuestas. Cancela cuando quieras.
          </p>
        </div>

        {/* Banner plan activo */}
        {isActivePremium && (
          <div className="mx-auto mt-8 max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-center text-sm text-amber-300">
            {cancelAtPeriodEnd ? (
              <>
                <CalendarClock className="mr-1.5 inline h-4 w-4" />
                Tu suscripción vence el{" "}
                <strong>
                  {periodEnd
                    ? new Date(periodEnd).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "—"}
                </strong>{" "}
                y no se renovará.
              </>
            ) : (
              <>
                Tienes Plan Premium{" "}
                <strong>{currentPlan === "yearly" ? "anual" : "mensual"}</strong> activo.
                {periodEnd && (
                  <>
                    {" "}
                    Válido hasta el{" "}
                    <strong>
                      {new Date(periodEnd).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>
                    .
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Billing Toggle */}
        <div className="mt-10 flex items-center justify-center gap-4">
          <span className={`text-sm font-medium ${!isYearly ? "text-white" : "text-zinc-500"}`}>
            Mensual
          </span>
          <Switch
            checked={isYearly}
            onCheckedChange={setIsYearly}
            className="data-[state=checked]:bg-amber-500"
          />
          <span className={`text-sm font-medium ${isYearly ? "text-white" : "text-zinc-500"}`}>
            Anual
          </span>
          <Badge className="ml-2 border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">
            Ahorra 20%
          </Badge>
        </div>

        {/* Pricing Cards */}
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon
            const price = isYearly ? plan.yearlyPrice / 12 : plan.monthlyPrice

            // Estado de este plan para el usuario actual
            const isCurrentPlan =
              isActivePremium &&
              plan.id === "premium" &&
              currentPlan === selectedInterval &&
              !cancelAtPeriodEnd

            const isUpgrade =
              isActivePremium &&
              plan.id === "premium" &&
              currentPlan === "monthly" &&
              selectedInterval === "yearly" &&
              !cancelAtPeriodEnd

            const isDowngrade =
              isActivePremium &&
              plan.id === "premium" &&
              currentPlan === "yearly" &&
              selectedInterval === "monthly" &&
              !cancelAtPeriodEnd

            const isPendingCancel =
              isActivePremium && plan.id === "premium" && cancelAtPeriodEnd

            return (
              <Card
                key={plan.name}
                className={`relative flex flex-col border-2 bg-zinc-900/50 backdrop-blur ${
                  plan.highlighted
                    ? "border-amber-500 shadow-lg shadow-amber-500/20"
                    : "border-zinc-800"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="border-amber-500 bg-amber-500 px-4 py-1 text-sm font-semibold text-zinc-950 hover:bg-amber-600">
                      {plan.badge}
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4 pt-8">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        plan.highlighted
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                    {isCurrentPlan && (
                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        Plan actual
                      </Badge>
                    )}
                    {isPendingCancel && plan.id === "premium" && (
                      <Badge className="border-zinc-500/30 bg-zinc-500/10 text-zinc-400">
                        Vence pronto
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-3 text-zinc-400">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="mb-6">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-white">
                        {price === 0 ? "Gratis" : formatPrice(Math.round(price))}
                      </span>
                      {price > 0 && <span className="ml-2 text-zinc-500">/mes</span>}
                    </div>
                    {isYearly && price > 0 && (
                      <p className="mt-1 text-sm text-zinc-500">
                        Facturado como {formatPrice(plan.yearlyPrice)}/año
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature.name} className="flex items-start gap-3">
                        {feature.included ? (
                          <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                        ) : (
                          <X className="mt-0.5 h-5 w-5 shrink-0 text-zinc-600" />
                        )}
                        <span className={feature.included ? "text-zinc-300" : "text-zinc-600"}>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-4">
                  {/* Plan Pro: próximamente */}
                  {plan.id === "pro" && (
                    <Button disabled className="w-full bg-zinc-800 text-white">
                      Próximamente
                    </Button>
                  )}

                  {/* Plan Gratis */}
                  {plan.id === "free" && (
                    <a
                      href="/register"
                      className="inline-flex w-full items-center justify-center rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                    >
                      Empezar gratis
                    </a>
                  )}

                  {/* Plan Premium — sin suscripción activa */}
                  {plan.id === "premium" && !isActivePremium && (
                    <a
                      href={`/api/checkout-mp?plan=${selectedInterval}`}
                      className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-600"
                    >
                      Suscribirse
                    </a>
                  )}

                  {/* Plan Premium — ya tiene este plan */}
                  {plan.id === "premium" && isCurrentPlan && (
                    <Button disabled className="w-full bg-zinc-800 text-zinc-400">
                      Plan actual
                    </Button>
                  )}

                  {/* Plan Premium — upgrade mensual → anual */}
                  {plan.id === "premium" && isUpgrade && (
                    <a
                      href={`/api/checkout-mp?plan=yearly`}
                      className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-600"
                    >
                      Cambiar a anual — Ahorra 20%
                    </a>
                  )}

                  {/* Plan Premium — downgrade anual → mensual */}
                  {plan.id === "premium" && isDowngrade && (
                    <Button
                      variant="outline"
                      className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      onClick={handleDowngrade}
                      disabled={loadingDowngrade}
                    >
                      {loadingDowngrade ? "Procesando..." : "Cambiar al vencer"}
                    </Button>
                  )}

                  {/* Plan Premium — suscripción cancelada pendiente de vencer */}
                  {plan.id === "premium" && isPendingCancel && (
                    <a
                      href={`/api/checkout-mp?plan=${selectedInterval}`}
                      className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-600"
                    >
                      Renovar suscripción
                    </a>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* Trust indicators */}
        <div className="mt-16 text-center">
          <p className="text-sm text-zinc-500">
            ¿Tienes preguntas? Escríbenos a{" "}
            <a
              href="mailto:soporte@elparley.co"
              className="text-amber-400 underline-offset-4 hover:underline"
            >
              soporte@elparley.co
            </a>
          </p>
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-zinc-600">
            <span>🇨🇴 Nequi · Tarjeta · PSE vía Mercado Pago</span>
            <span>✅ Cancela cuando quieras</span>
            <span>🔒 Pago seguro</span>
          </div>
        </div>
      </div>
    </div>
  )
}
