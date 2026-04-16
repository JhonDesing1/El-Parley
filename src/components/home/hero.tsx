import Link from "next/link";
import { ArrowUpRight, TrendingUp, Zap, Target, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-noise">
      {/* ══════════════════════════════════════
          BACKGROUND — capas en orden (z-bajo a z-alto)
          ══════════════════════════════════════ */}

      {/* 1. Orb A — grande, dorado, arriba-izquierda, deriva lenta */}
      <div
        className="pointer-events-none absolute rounded-full animate-fade-in"
        style={{
          top: "-15%",
          left: "-12%",
          width: "780px",
          height: "780px",
          background:
            "radial-gradient(circle at 40% 40%, hsl(43 92% 58% / 0.55) 0%, hsl(43 92% 48% / 0.2) 45%, transparent 70%)",
          filter: "blur(72px)",
          animation: "fade-in 1.5s ease-out both, orb-drift-a 14s ease-in-out infinite",
          animationDelay: "0s, 0s",
        }}
      />

      {/* 2. Orb B — grande, esmeralda, abajo-derecha, deriva opuesta */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          bottom: "-20%",
          right: "-10%",
          width: "700px",
          height: "700px",
          background:
            "radial-gradient(circle at 55% 55%, hsl(152 72% 44% / 0.5) 0%, hsl(152 72% 38% / 0.18) 45%, transparent 70%)",
          filter: "blur(80px)",
          animation: "fade-in 1.8s ease-out both, orb-drift-b 18s ease-in-out infinite",
          animationDelay: "0.3s, 0s",
        }}
      />

      {/* 3. Orb C — mediano, dorado, centro-derecha, drift-c */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          top: "15%",
          right: "8%",
          width: "420px",
          height: "420px",
          background:
            "radial-gradient(circle, hsl(43 92% 62% / 0.45) 0%, transparent 65%)",
          filter: "blur(55px)",
          animation: "fade-in 2s ease-out both, orb-drift-c 10s ease-in-out infinite",
          animationDelay: "0.5s, 1s",
        }}
      />

      {/* 4. Orb D — pequeño acento esmeralda, izquierda-medio */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          top: "55%",
          left: "5%",
          width: "320px",
          height: "320px",
          background:
            "radial-gradient(circle, hsl(152 72% 50% / 0.4) 0%, transparent 65%)",
          filter: "blur(48px)",
          animation: "fade-in 2.2s ease-out both, orb-drift-a 16s ease-in-out infinite reverse",
          animationDelay: "0.7s, 5s",
        }}
      />

      {/* 5. Banda aurora central — sweep horizontal */}
      <div
        className="animate-aurora pointer-events-none absolute left-0 right-0"
        style={{
          top: "30%",
          height: "280px",
          background:
            "linear-gradient(90deg, transparent 0%, hsl(43 92% 52% / 0.12) 25%, hsl(152 72% 44% / 0.14) 55%, hsl(43 92% 52% / 0.08) 80%, transparent 100%)",
          filter: "blur(30px)",
        }}
      />

      {/* 6. Velo superior: vignette oscura sobre los orbs */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 50%, transparent 40%, hsl(var(--background) / 0.55) 100%)",
        }}
      />

      {/* 7. Grid de puntos sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="container relative grid gap-12 py-24 md:grid-cols-12 md:py-40">
        {/* ── Columna izquierda ── */}
        <div className="md:col-span-7">
          {/* Pill de estado */}
          <div
            className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-4 py-1.5 text-xs font-mono uppercase tracking-widest text-primary"
            style={{ animationDelay: "0.05s" }}
          >
            <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-primary" />
            Edge matemático · Actualizado cada 15 min
          </div>

          {/* Headline principal */}
          <h1
            className="animate-fade-in-up font-display text-5xl font-black leading-[0.87] tracking-tight sm:text-6xl md:text-7xl lg:text-[88px]"
            style={{ animationDelay: "0.15s" }}
          >
            Apuesta donde
            <br />
            las{" "}
            <span
              className="relative inline-block"
              style={{
                background:
                  "linear-gradient(135deg, hsl(43 92% 68%) 0%, hsl(43 92% 50%) 50%, hsl(38 90% 42%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              matemáticas
              {/* Subrayado dorado decorativo */}
              <span
                className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full opacity-60"
                style={{
                  background: "linear-gradient(90deg, hsl(43 92% 60%), transparent)",
                }}
              />
            </span>
            <br />
            <span className="italic text-foreground/75">ganan</span>.
          </h1>

          {/* Subtítulo */}
          <p
            className="animate-fade-in-up mt-8 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg"
            style={{ animationDelay: "0.3s" }}
          >
            Comparamos cuotas entre{" "}
            <strong className="font-semibold text-foreground/80">
              Betplay, Wplay, Codere y Rivalo
            </strong>
            . Detectamos value bets con modelo Poisson&nbsp;+&nbsp;xG y armamos parlays
            con probabilidad combinada{" "}
            <strong className="font-semibold text-foreground/80">&gt;&nbsp;68%</strong>.
          </p>

          {/* CTAs */}
          <div
            className="animate-fade-in-up mt-10 flex flex-wrap gap-3"
            style={{ animationDelay: "0.45s" }}
          >
            <Button asChild size="lg" className="group glow-primary font-bold">
              <Link href="/parlays">
                Ver parlays del día
                <ArrowUpRight className="ml-1.5 h-4 w-4 animate-arrow transition-transform" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary/30 hover:border-primary/60 hover:bg-primary/5"
            >
              <Link href="/premium">Comparar planes</Link>
            </Button>
          </div>

          {/* Social proof inline */}
          <p
            className="animate-fade-in-up mt-6 text-xs text-muted-foreground/70"
            style={{ animationDelay: "0.6s" }}
          >
            Sin tipsters · Solo estadística · Edge verificable
          </p>
        </div>

        {/* ── Stats cards ── */}
        <div className="flex flex-col gap-3 md:col-span-5 md:justify-center">
          <Stat
            icon={DollarSign}
            label="ROI 30 días"
            value="+12.4%"
            color="gold"
            delay="0.2s"
          />
          <Stat
            icon={TrendingUp}
            label="Win rate"
            value="58.2%"
            color="emerald"
            delay="0.32s"
          />
          <Stat
            icon={Target}
            label="Value bets / día"
            value="~24"
            color="gold"
            delay="0.44s"
          />
          <Stat
            icon={Zap}
            label="Cuotas comparadas"
            value="4 casas"
            color="emerald"
            delay="0.56s"
          />
        </div>
      </div>

      {/* ── Línea degradada en la base ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.4) 30%, hsl(var(--value) / 0.3) 70%, transparent)",
        }}
      />
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color = "gold",
  delay = "0s",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: "gold" | "emerald";
  delay?: string;
}) {
  const isGold = color === "gold";
  return (
    <div
      className={`animate-fade-in-up group relative overflow-hidden rounded-xl border p-5 backdrop-blur-sm transition-all duration-300 ${
        isGold
          ? "animate-border-glow border-primary/20 bg-primary/5 hover:bg-primary/10"
          : "animate-border-glow-value border-value/20 bg-value/5 hover:bg-value/10"
      }`}
      style={{ animationDelay: delay }}
    >
      {/* Shimmer de fondo al hover */}
      <div
        className={`absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${
          isGold
            ? "bg-gradient-to-br from-primary/8 via-transparent to-transparent"
            : "bg-gradient-to-br from-value/8 via-transparent to-transparent"
        }`}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <div className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div
            className={`mt-1.5 font-mono text-4xl font-black tabular-nums leading-none ${
              isGold ? "text-primary" : "text-value"
            }`}
          >
            {value}
          </div>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-all duration-300 ${
            isGold
              ? "bg-primary/10 text-primary ring-primary/20 group-hover:ring-primary/40"
              : "bg-value/10 text-value ring-value/20 group-hover:ring-value/40"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
