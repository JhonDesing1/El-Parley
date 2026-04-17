import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface PremiumGateProps {
  children: React.ReactNode;
  isPremium: boolean;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Envoltorio que difumina el contenido y muestra un CTA si el usuario no es premium.
 * Renderiza el contenido real para mantener el SEO en server components.
 */
export function PremiumGate({
  children,
  isPremium,
  title = "Contenido Premium",
  description = "Suscríbete para desbloquear value bets exclusivas, parlays VIP y ROI tracking.",
  className,
}: PremiumGateProps) {
  if (isPremium) return <>{children}</>;

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* Contenido difuminado */}
      <div className="pointer-events-none select-none blur-md" aria-hidden="true">
        {children}
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background/40 via-background/85 to-background">
        <div className="max-w-md px-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30">
            <Lock className="h-6 w-6 text-amber-400" />
          </div>
          <h3 className="font-display text-2xl font-bold tracking-tight">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <Button asChild variant="value" size="lg" className="mt-5">
            <Link href="/premium">
              <Sparkles className="h-4 w-4" />
              Desbloquear Premium
            </Link>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Desde $5.000 COP/mes · Cancela cuando quieras
          </p>
        </div>
      </div>
    </div>
  );
}
