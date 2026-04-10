import Link from "next/link";
import { ArrowUpRight, TrendingUp, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-noise">
      {/* Mesh gradient de fondo */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.3), transparent 50%), radial-gradient(circle at 80% 70%, hsl(var(--value) / 0.2), transparent 50%)",
        }}
      />

      <div className="container relative grid gap-12 py-20 md:grid-cols-12 md:py-32">
        <div className="md:col-span-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-mono uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-primary" />
            Edge matemático en tiempo real
          </div>

          <h1 className="font-display text-6xl font-black leading-[0.9] tracking-tight md:text-8xl">
            Apuesta donde
            <br />
            las <span className="text-primary">matemáticas</span>
            <br />
            <span className="italic">ganan</span>.
          </h1>

          <p className="mt-8 max-w-xl text-lg text-muted-foreground md:text-xl">
            Comparamos cuotas entre Betplay, Wplay, Codere y Rivalo. Detectamos value bets con un modelo Poisson + xG y armamos parlays con probabilidad combinada &gt; 68%.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild size="lg" className="glow-primary">
              <Link href="/parlays">
                Ver parlays del día
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/premium">Comparar planes</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6 md:col-span-4 md:justify-end">
          <Stat icon={TrendingUp} label="ROI 30 días" value="+12.4%" />
          <Stat icon={Target} label="Win rate" value="58.2%" />
          <Stat icon={Zap} label="Value bets/día" value="~24" />
        </div>
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card/50 p-6 backdrop-blur transition-colors hover:border-primary/50">
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <div className="font-mono text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-sm uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
