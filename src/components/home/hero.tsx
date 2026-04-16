"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TrendingUp, Target, Zap, BarChart3 } from "lucide-react"

const stats = [
  {
    icon: TrendingUp,
    value: "+12.4%",
    label: "ROI promedio",
    color: "text-emerald-400",
  },
  {
    icon: Target,
    value: "58.2%",
    label: "Win rate",
    color: "text-emerald-400",
  },
  {
    icon: Zap,
    value: "~24",
    label: "Value bets/día",
    color: "text-amber-400",
  },
  {
    icon: BarChart3,
    value: "4",
    label: "Cuotas comparadas",
    color: "text-amber-400",
  },
]

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#0a0a0a]">
      {/* Background glow orbs */}
      <div className="absolute left-1/4 top-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/20 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 h-80 w-80 translate-x-1/2 translate-y-1/2 rounded-full bg-emerald-500/20 blur-[100px]" />
      <div className="absolute right-1/3 top-1/2 h-64 w-64 rounded-full bg-amber-500/10 blur-[80px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left content */}
          <div className="space-y-8">
            {/* Live indicator pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Edge matemático · Actualizado cada 15 min
            </div>

            {/* Headline */}
            <h1 className="text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Apuesta donde las{" "}
              <span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">
                matemáticas ganan.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-xl text-pretty text-lg leading-relaxed text-zinc-400">
              Comparamos cuotas entre Betplay, Wplay, Codere y Rivalo. Detectamos
              value bets con modelo Poisson+xG.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-amber-500 text-zinc-900 hover:bg-amber-400">
                <Link href="/parlays">Ver parlays del día</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800 hover:text-white">
                <Link href="/premium">Comparar planes</Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-6 pt-4 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Sin registro
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Datos en tiempo real
              </div>
            </div>
          </div>

          {/* Right content - Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm transition-all hover:border-zinc-700 hover:bg-zinc-900/80"
              >
                {/* Card glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-emerald-500/5 opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative space-y-3">
                  <div className={`inline-flex rounded-lg bg-zinc-800 p-2 ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div className={`text-3xl font-bold ${stat.color}`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-zinc-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom decorative element */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
      </div>
    </section>
  )
}
