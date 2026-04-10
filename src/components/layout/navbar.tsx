import Link from "next/link";
import { Zap, TrendingUp, Newspaper, Trophy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isPremiumUser } from "@/lib/utils/auth";
import { Badge } from "@/components/ui/badge";

const NAV_LINKS = [
  { href: "/", label: "Hoy", icon: Zap },
  { href: "/parlays", label: "Parlays", icon: TrendingUp },
  { href: "/blog", label: "Análisis", icon: Newspaper },
  { href: "/leaderboard", label: "Ranking", icon: Trophy },
];

export async function Navbar() {
  const user = await getCurrentUser();
  const premium = await isPremiumUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-black uppercase tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-value text-black">
              <Zap className="h-4 w-4" strokeWidth={3} />
            </div>
            ApuestaValue
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
            <div className="flex items-center gap-2">
              {premium && <Badge variant="premium">PRO</Badge>}
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">{user.email?.split("@")[0]}</Link>
              </Button>
            </div>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
