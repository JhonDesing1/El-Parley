import { redirect } from "next/navigation";
import {
  BookOpen,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Percent,
  DollarSign,
  BarChart2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KellyCalculator } from "./kelly-calculator";

export const metadata = { title: "Gestión de Bankroll — El Parley" };

const STAKING_METHODS = [
  {
    title: "Stake plano",
    icon: DollarSign,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    description: "Apostar siempre la misma cantidad fija, independientemente del edge.",
    pros: ["Muy simple de aplicar", "Fácil de rastrear", "Sin riesgo de sobreinversión"],
    cons: [
      "Ignora el valor real de cada apuesta",
      "No optimiza el crecimiento del bankroll",
      "Un stake fijo pierde poder relativo al crecer el bankroll",
    ],
    example: "Siempre apostas $20.000. Ganas 3 de cada 10 apuestas con cuota 3.5 → ROI positivo.",
    recommended: false,
  },
  {
    title: "Stake porcentual",
    icon: Percent,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    description:
      "Apostar un porcentaje fijo del bankroll actual (1–2% es el rango conservador).",
    pros: [
      "El stake crece con el bankroll (efecto compuesto)",
      "Se reduce automáticamente en rachas negativas",
      "Equilibrio entre crecimiento y protección",
    ],
    cons: [
      "Tampoco considera el edge de cada apuesta",
      "Un % muy alto puede arruinar el bankroll rápido",
    ],
    example:
      "Bankroll: $1.000.000. Stake 2% = $20.000. Tras ganar, bankroll = $1.040.000 → próximo stake $20.800.",
    recommended: true,
  },
  {
    title: "Criterio de Kelly",
    icon: BarChart2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    description:
      "Stake matemáticamente óptimo basado en el edge real de cada apuesta. Maximiza el crecimiento a largo plazo.",
    pros: [
      "Maximiza el crecimiento logarítmico del bankroll",
      "Pondera más las apuestas con más edge",
      "Base matemática sólida (demostrado por Kelly, 1956)",
    ],
    cons: [
      "Requiere una estimación precisa de la probabilidad real",
      "El Kelly completo tiene varianza muy alta",
      "Puede sugerir stakes grandes que asustan psicológicamente",
    ],
    example:
      "Edge 8%, cuota 2.10 → Kelly sugiere ~4% del bankroll. Con ¼ Kelly → 1% ($10.000 sobre $1M).",
    recommended: true,
  },
];

const GOLDEN_RULES = [
  {
    icon: Shield,
    title: "Nunca arriesgues más del 5% en una sola apuesta",
    description:
      "Sin importar cuánto confíes en una selección. El mercado y los modelos cometen errores. Un límite duro te protege de las apuestas emocionales.",
  },
  {
    icon: TrendingUp,
    title: "Registra cada apuesta",
    description:
      'Sin tracking no hay mejora. Usa "Mis Picks" para llevar el historial completo: mercado, cuota, stake, resultado y P&L.',
  },
  {
    icon: Percent,
    title: "Usa siempre ¼ o ½ Kelly, nunca el Kelly completo",
    description:
      "El Kelly completo asume que tu modelo es perfecto. No lo es. ¼ Kelly reduce la varianza ~75% con solo una reducción moderada del crecimiento esperado.",
  },
  {
    icon: DollarSign,
    title: "Separa el bankroll de apuestas del dinero personal",
    description:
      "Define una cantidad que puedas perder completamente sin afectar tu vida. Esa es tu unidad de medida. Nunca la recargues impulsivamente.",
  },
  {
    icon: BookOpen,
    title: "Evalúa por ROI, no por racha",
    description:
      "10 pérdidas seguidas con edge positivo real son estadísticamente normales. Evalúa mínimo 100 apuestas antes de juzgar si una estrategia funciona.",
  },
  {
    icon: AlertTriangle,
    title: "Define un stop-loss del 25–30%",
    description:
      "Si pierdes el 25% del bankroll inicial, para. Revisa tus criterios de selección antes de continuar. Puede ser drawdown normal o puede ser que algo está mal.",
  },
];

const MISTAKES = [
  "Aumentar el stake para 'recuperar' pérdidas (martingala)",
  "Apostar más del 5% en una sola selección",
  "Mezclar dinero de apuestas con gastos del día a día",
  "Seguir apostando durante una racha negativa sin analizar las causas",
  "Confiar en 'tipsters' sin datos reales de rendimiento a largo plazo",
  "Apostar en mercados que no entiendes bien",
  "Ignorar las comisiones y márgenes de las casas de apuestas",
  "No llevar registro de tus apuestas",
];

export default async function BankrollPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/bankroll");

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Gestión de Bankroll</h1>
          <p className="mt-1 text-muted-foreground">
            La habilidad más importante de un apostador rentable a largo plazo no es elegir
            ganadores — es gestionar su capital.
          </p>
        </div>
      </div>

      {/* Intro */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            El <strong className="text-foreground">bankroll</strong> es el capital exclusivo que
            destinas a apuestas deportivas. Gestionarlo correctamente significa apostar solo
            fracciones controladas de ese capital en cada selección, de modo que ninguna racha
            perdedora — por larga que sea — pueda dejarte sin fondos. Los apostadores profesionales
            no ganan porque predicen más; ganan porque{" "}
            <strong className="text-foreground">sobreviven lo suficiente</strong> para que el edge
            positivo se materialice.
          </p>
        </CardContent>
      </Card>

      {/* Métodos de staking */}
      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl font-bold">Métodos de staking</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STAKING_METHODS.map((method) => {
            const Icon = method.icon;
            return (
              <Card
                key={method.title}
                className={`relative border ${method.border} flex flex-col`}
              >
                {method.recommended && (
                  <Badge className="absolute right-3 top-3 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                    Recomendado
                  </Badge>
                )}
                <CardHeader className="pb-3">
                  <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${method.bg}`}>
                    <Icon className={`h-4 w-4 ${method.color}`} />
                  </div>
                  <CardTitle className="text-base">{method.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                  <p className="text-muted-foreground">{method.description}</p>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Ventajas
                    </div>
                    <ul className="space-y-1">
                      {method.pros.map((p) => (
                        <li key={p} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/60" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-red-400">
                      <XCircle className="h-3 w-3" /> Desventajas
                    </div>
                    <ul className="space-y-1">
                      {method.cons.map((c) => (
                        <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/60" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                    <strong className="text-foreground">Ejemplo:</strong> {method.example}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Kelly Calculator */}
      <section className="mb-10">
        <h2 className="mb-2 font-display text-xl font-bold">Calculadora de stake</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Ingresa tu bankroll, la cuota del mercado y tu estimación de probabilidad real para
          obtener el stake óptimo por el método Kelly fraccional.
        </p>
        <KellyCalculator />
      </section>

      {/* ¿Qué es el Edge? */}
      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl font-bold">¿Qué es el edge y por qué importa?</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  El <strong className="text-foreground">edge</strong> (ventaja) es la diferencia
                  entre la probabilidad real de un evento y la probabilidad implícita que ofrece la
                  casa de apuestas.
                </p>
                <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs">
                  <div className="text-foreground">Edge = (P_real × cuota) − 1</div>
                  <div className="mt-2 text-muted-foreground">
                    P_real = 0.55 · cuota = 2.10
                    <br />
                    Edge = (0.55 × 2.10) − 1 = <span className="text-emerald-400">+15.5%</span>
                  </div>
                </div>
                <p>
                  Un edge positivo no garantiza ganar cada apuesta, pero sí garantiza ser rentable
                  si apuestas en suficientes eventos con edge similar.
                </p>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-3">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Edge positivo (&gt;3%)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La casa está subvalorando la probabilidad real. Apostar aquí es estadísticamente
                    rentable a largo plazo. El Parley detecta automáticamente estos eventos.
                  </p>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-3">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-red-400">
                    Sin edge (0% o negativo)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Estás pagando el margen de la casa. A largo plazo perderás dinero sin importar
                    qué tan bien elijas los resultados. Evita apostar sin edge identificado.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Reglas de oro */}
      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl font-bold">Las 6 reglas de oro</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {GOLDEN_RULES.map((rule, i) => {
            const Icon = rule.icon;
            return (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-border/50 bg-muted/20 p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{rule.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{rule.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Errores comunes */}
      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl font-bold">Errores que arruinan bankrolls</h2>
        <Card>
          <CardContent className="pt-6">
            <ul className="grid gap-2 sm:grid-cols-2">
              {MISTAKES.map((m, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <span className="text-sm text-muted-foreground">{m}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Tabla de referencia rápida */}
      <section>
        <h2 className="mb-4 font-display text-xl font-bold">Referencia rápida de stakes</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="mb-4 text-xs text-muted-foreground">
              Guía orientativa basada en el edge detectado. Asume ¼ Kelly y bankroll de $1.000.000 COP.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4">Edge</th>
                    <th className="pb-2 pr-4">Confianza</th>
                    <th className="pb-2 pr-4">% bankroll</th>
                    <th className="pb-2">Stake (sobre $1M)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {[
                    { edge: "3–5%", conf: "Baja", pct: "0.5–1%", stake: "$5.000–$10.000", color: "text-muted-foreground" },
                    { edge: "5–8%", conf: "Media", pct: "1–2%", stake: "$10.000–$20.000", color: "text-amber-400" },
                    { edge: "8–12%", conf: "Alta", pct: "2–3%", stake: "$20.000–$30.000", color: "text-emerald-400" },
                    { edge: ">12%", conf: "Muy alta", pct: "3–5%", stake: "$30.000–$50.000", color: "text-emerald-400" },
                  ].map((row) => (
                    <tr key={row.edge} className="text-sm">
                      <td className={`py-2.5 pr-4 font-mono font-bold ${row.color}`}>{row.edge}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{row.conf}</td>
                      <td className="py-2.5 pr-4 font-mono text-muted-foreground">{row.pct}</td>
                      <td className="py-2.5 font-mono text-muted-foreground">{row.stake}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
