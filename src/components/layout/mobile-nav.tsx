"use client";

import { useState, useEffect, useTransition } from "react";
import Link, { LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Zap, TrendingUp, Newspaper, ClipboardList, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

type NavLink = {
  href: string;
  label: string;
  icon: React.ElementType;
};

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Hoy", icon: Zap },
  { href: "/parlays", label: "Parlays", icon: TrendingUp },
  { href: "/blog", label: "Análisis", icon: Newspaper },
];

const AUTH_NAV_LINKS: NavLink[] = [
  { href: "/mis-picks", label: "Mis Picks", icon: ClipboardList },
  { href: "/bankroll", label: "Bankroll", icon: BookOpen },
];

export function MobileNav({
  user,
  premium,
  tier,
}: {
  user: { email?: string | null } | null;
  premium: boolean;
  tier?: "free" | "premium" | "pro";
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const pathname = usePathname();

  // Cerrar al navegar — startTransition evita cascading renders
  useEffect(() => {
    startTransition(() => setOpen(false));
  }, [pathname]);

  // Bloquear scroll del body cuando el menú está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = user ? [...NAV_LINKS, ...AUTH_NAV_LINKS] : NAV_LINKS;

  return (
    <>
      {/* Botón hamburguesa — solo visible en móvil */}
      <button
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/8 hover:text-primary md:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay + drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          aria-modal="true"
          role="dialog"
        >
          {/* Fondo semitransparente */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-background shadow-2xl">
            {/* Header del panel */}
            <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
              <Link
                href="/"
                className="flex items-center gap-2 font-display text-lg font-black uppercase tracking-tight"
                onClick={() => setOpen(false)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground glow-primary">
                  <Zap className="h-4 w-4" strokeWidth={3} />
                </div>
                <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  El Parley
                </span>
              </Link>
              <button
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Links */}
            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-1">
                {links.map((link) => {
                  const Icon = link.icon;
                  const active = pathname === link.href;
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-primary/8 hover:text-primary"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* CTA zona inferior */}
            <div className="border-t border-border/50 p-4 space-y-2">
              {!premium && (
                <Button asChild variant="value" size="sm" className="w-full">
                  <Link href="/premium">
                    <Sparkles className="h-3.5 w-3.5" />
                    Ir a Premium
                  </Link>
                </Button>
              )}
              {user ? (
                <Button asChild variant="ghost" size="sm" className="w-full">
                  <Link href="/dashboard">{user.email?.split("@")[0]}</Link>
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button asChild variant="ghost" size="sm" className="flex-1">
                    <Link href="/login">Entrar</Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1">
                    <Link href="/register">Crear cuenta</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
