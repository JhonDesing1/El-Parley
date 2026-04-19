"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TrendingUp, Target, Zap, BarChart3 } from "lucide-react"

const stats = [
  {
    icon: TrendingUp,
    value: "+12.4%",
    label: "ROI promedio (retorno de inversión)",
    sub: "sobre bankroll inicial",
    color: "text-value",
  },
  {
    icon: Target,
    value: "0.60",
    label: "Cuotas acertadas",
    sub: "Premium · alta confianza",
    color: "text-value",
  },
  {
    icon: Zap,
    value: "~12",
    label: "Value bets/día · Premium",
    sub: "Free: 2 públicas al día",
    color: "text-primary",
  },
  {
    icon: BarChart3,
    value: "4",
    label: "Casas comparadas",
    sub: "Nacionales e internacionales",
    color: "text-primary",
  },
]

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-background">
      {/* Background glow orbs */}
      <div className="absolute left-1/4 top-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 h-80 w-80 translate-x-1/2 translate-y-1/2 rounded-full bg-value/15 blur-[100px]" />
      <div className="absolute right-1/3 top-1/2 h-64 w-64 rounded-full bg-primary/8 blur-[80px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left content */}
          <div className="space-y-8">
            {/* Live indicator pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-value/30 bg-value/10 px-4 py-2 text-sm text-value">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-value opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-value" />
              </span>
              Edge matemático (ventaja estadística) · Actualizado cada 15 min
            </div>

            {/* Headline */}
            <h1 className="font-display text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Apuesta donde las{" "}
              <span className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
                matemáticas ganan.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Analizamos cuotas de las principales casas de apuestas nacionales e internacionales para detectar{" "}
              <span className="font-semibold text-foreground">value bets con modelo Poisson+xG</span>
              {" "}— solo selecciones con cuota mínima de 0.60 y más del{" "}
              <span className="font-semibold text-value">80% de probabilidad de acierto.</span>
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/parlays">Ver parlays del día</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary hover:text-foreground">
                <Link href="/premium">Comparar planes</Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-6 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-value" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Sin registro
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-value" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Datos en tiempo real
              </div>
              <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Premium · Cuotas en vivo — Clásicos &amp; Copa Mundo
              </div>
            </div>
          </div>

          {/* Right content - Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            {(stats as typeof stats).map((stat) => (
              <div
                key={stat.label}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card"
              >
                {/* Card glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-value/5 opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative space-y-2">
                  <div className={`inline-flex rounded-lg bg-secondary p-2 ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div className={`font-display text-3xl font-bold ${stat.color}`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                  <div className="text-[10px] text-muted-foreground/60">{stat.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom decorative element */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </section>
  )
}
