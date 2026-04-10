import Link from "next/link";
import { Check, Sparkles, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

export const metadata = {
  title: "Premium — ApuestaValue",
  description:
    "Desbloquea value bets exclusivas, parlays VIP, ROI tracking y alertas push. Desde $19.900 COP/mes.",
};

const PLANS = [
  {
    id: "free",
    name: "Free",
    icon: Sparkles,
    priceCOP: "Gratis",
    priceUSD: "$0",
    description: "Lo esencial para empezar",
    features: [
      "Cuotas en vivo de todas las casas",
      "1 parlay del día gratis",
      "Estadísticas básicas",
      "Detección de value bets (delay 30 min)",
    ],
    cta: "Empezar gratis",
    ctaHref: "/register",
    highlight: false,
  },
  {
    id: "premium",
    name: "Premium",
    icon: Zap,
    priceCOP: "$19.900",
    priceUSD: "$4.99",
    period: "/mes",
    description: "Para apostadores serios",
    features: [
      "Todo lo del plan Free",
      "Value bets en tiempo real (sin delay)",
      "Hasta 10 parlays VIP al día",
      "Historial de ROI auditado",
      "Alertas push instantáneas",
      "Análisis xG y modelos avanzados",
      "Sin publicidad",
    ],
    cta: "Suscribirme",
    ctaHref: "/api/checkout?plan=premium",
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    icon: Crown,
    priceCOP: "$59.900",
    priceUSD: "$14.99",
    period: "/mes",
    description: "Para profesionales y traders",
    features: [
      "Todo lo del plan Premium",
      "Acceso a la API REST personal",
      "Backtesting histórico ilimitado",
      "Bot de Telegram con alertas",
      "Soporte prioritario",
      "Webhooks personalizados",
    ],
    cta: "Hablar con ventas",
    ctaHref: "/api/checkout?plan=pro",
    highlight: false,
  },
];

export default function PremiumPage() {
  return (
    <div className="container max-w-6xl py-12">
      <header className="mx-auto mb-12 max-w-2xl text-center">
        <Badge variant="value" className="mb-4">
          PREMIUM
        </Badge>
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Convierte el azar en estadística
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Nuestros suscriptores premium tienen acceso a las mismas herramientas que usan
          los apostadores profesionales: edge matemático, Kelly staking y alertas en vivo.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col p-6",
                plan.highlight && "border-value/50 ring-1 ring-value/30 shadow-[0_0_60px_-15px_hsl(var(--value))]",
              )}
            >
              {plan.highlight && (
                <Badge variant="value" className="absolute -top-3 left-1/2 -translate-x-1/2">
                  MÁS POPULAR
                </Badge>
              )}

              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Icon className="h-6 w-6" />
              </div>

              <h3 className="font-display text-2xl font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

              <div className="mt-6">
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold tabular-nums">
                    {plan.priceCOP}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                {plan.id !== "free" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    o {plan.priceUSD} USD · PayU / Stripe
                  </div>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-value" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                variant={plan.highlight ? "value" : "outline"}
                size="lg"
                className="mt-6 w-full"
              >
                <Link href={plan.ctaHref}>{plan.cta}</Link>
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="mx-auto mt-16 max-w-2xl text-center">
        <p className="text-sm text-muted-foreground">
          🇨🇴 Pagos en pesos vía PayU · 🌎 Pagos internacionales vía Stripe · Cancela en
          cualquier momento · 7 días de garantía
        </p>
      </div>
    </div>
  );
}
