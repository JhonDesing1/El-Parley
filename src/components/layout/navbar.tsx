import Link from "next/link";
import { Zap, TrendingUp, Newspaper, Sparkles, ClipboardList, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser, getUserTier } from "@/lib/utils/auth";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/layout/mobile-nav";

const NAV_LINKS = [
  { href: "/", label: "Hoy", icon: Zap },
  { href: "/parlays", label: "Parlays", icon: TrendingUp },
  { href: "/blog", label: "Análisis", icon: Newspaper },
];

const AUTH_NAV_LINKS = [
  { href: "/mis-picks", label: "Mis Picks", icon: ClipboardList },
  { href: "/bankroll", label: "Bankroll", icon: BookOpen },
];

export async function Navbar() {
  const user = await getCurrentUser();
  const tier = await getUserTier();
  const premium = tier === "premium" || tier === "pro";
  const pro = tier === "pro";

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/85 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-black uppercase tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground glow-primary">
              <Zap className="h-4 w-4" strokeWidth={3} />
            </div>
            <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              El Parley
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-primary/8 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
            {user &&
              AUTH_NAV_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-primary/8 hover:text-primary"
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {!premium && (
            <Button asChild variant="value" size="sm" className="hidden sm:inline-flex">
              <Link href="/premium">
                <Sparkles className="h-3.5 w-3.5" />
                Premium
              </Link>
            </Button>
          )}
          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              {pro && <Badge className="border-amber-500/50 bg-amber-500/10 text-amber-400">PRO</Badge>}
              {!pro && premium && <Badge variant="premium">PREMIUM</Badge>}
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">{user.email?.split("@")[0]}</Link>
              </Button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </div>
          )}
          {/* Menú móvil — visible solo en pantallas < md */}
          <MobileNav user={user} premium={premium} tier={tier} />
        </div>
      </div>
    </header>
  );
}
