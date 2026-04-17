"use client"

import { useState } from "react"
import { Check, X, Zap, Crown, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"

const plans = [
  {
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
    name: "Premium",
    icon: Crown,
    monthlyPrice: 19900,
    yearlyPrice: Math.round(19900 * 12 * 0.8),
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
    cta: "Suscribirse",
    ctaLink: null, // se calcula dinámicamente según el toggle anual
    highlighted: true,
    badge: "Más popular",
  },
  {
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
    cta: "Próximamente",
    ctaLink: "#",
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

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)

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
                  <Button
                    asChild={plan.ctaLink !== null && plan.ctaLink !== "#"}
                    disabled={plan.ctaLink === "#" || plan.ctaLink === null}
                    className={`w-full ${
                      plan.highlighted
                        ? "bg-amber-500 text-zinc-950 hover:bg-amber-600"
                        : "bg-zinc-800 text-white hover:bg-zinc-700"
                    }`}
                  >
                    {plan.ctaLink !== null && plan.ctaLink !== "#" ? (
                      <a href={
                        plan.name === "Premium"
                          ? `/api/checkout-mp?plan=${isYearly ? "yearly" : "monthly"}`
                          : plan.ctaLink
                      }>{plan.cta}</a>
                    ) : (
                      <span>{plan.cta}</span>
                    )}
                  </Button>
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
