"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  TrendingUp,
  LineChart,
  ClipboardList,
  Layers,
  Menu,
  Crown,
  Zap,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const navLinks = [
  { href: "/", label: "Hoy", icon: Zap },
  { href: "/value-bets", label: "Cuotas", icon: TrendingUp },
  { href: "/parlays", label: "Combinadas", icon: Layers },
  { href: "/analisis", label: "Análisis", icon: LineChart },
  { href: "/bankroll", label: "Bankroll", icon: Wallet },
  { href: "/mis-picks", label: "Mis Apuestas", icon: ClipboardList },
]

interface NavbarClientProps {
  isAuthenticated: boolean
  isPremium: boolean
}

export function NavbarClient({ isAuthenticated, isPremium }: NavbarClientProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 h-16 w-full border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 lg:px-6">
        {/* Logo con halo blanco amplio para que los colores resalten */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="El Parley"
            width={161}
            height={46}
            className="h-[46px] w-auto"
            priority
            style={{
              filter: [
                "drop-shadow(0 0 6px rgba(255, 255, 255, 0.95))",
                "drop-shadow(0 0 14px rgba(255, 255, 255, 0.8))",
                "drop-shadow(0 0 26px rgba(255, 255, 255, 0.6))",
                "drop-shadow(0 0 42px rgba(255, 255, 255, 0.35))",
              ].join(" "),
            }}
          />
          <span
            className="text-xl font-bold tracking-wide"
            style={{
              color: "#3D5A3E",
              textShadow:
                "0 0 8px rgba(255, 255, 255, 0.95), 0 0 18px rgba(255, 255, 255, 0.8), 0 0 32px rgba(255, 255, 255, 0.55)",
            }}
          >
            EL PARLEY
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <link.icon className="size-4" />
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop Right Side Buttons */}
        <div className="hidden items-center gap-2 md:flex">
          {isPremium ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Crown className="size-4" />
              Premium activo
            </span>
          ) : (
            <Button asChild size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/premium">
                <Crown className="size-4" />
                Premium
              </Link>
            </Button>
          )}
          {!isAuthenticated && (
            <>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:bg-secondary hover:text-foreground">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-border text-foreground hover:bg-secondary">
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </>
          )}
          {isAuthenticated && (
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Link href="/dashboard">Mi cuenta</Link>
            </Button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Menu className="size-6" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-full border-border bg-background sm:max-w-sm"
          >
            <SheetHeader className="border-b border-border pb-4">
              <SheetTitle className="flex items-center gap-2.5">
                <Image
                  src="/logo.png"
                  alt="El Parley"
                  width={138}
                  height={41}
                  className="h-[41px] w-auto"
                  style={{
                    filter: [
                      "drop-shadow(0 0 5px rgba(255, 255, 255, 0.95))",
                      "drop-shadow(0 0 12px rgba(255, 255, 255, 0.8))",
                      "drop-shadow(0 0 22px rgba(255, 255, 255, 0.6))",
                      "drop-shadow(0 0 36px rgba(255, 255, 255, 0.35))",
                    ].join(" "),
                  }}
                />
                <span
                  className="text-lg font-bold tracking-wide"
                  style={{
                    color: "#3D5A3E",
                    textShadow:
                      "0 0 7px rgba(255, 255, 255, 0.95), 0 0 15px rgba(255, 255, 255, 0.8), 0 0 28px rgba(255, 255, 255, 0.55)",
                  }}
                >
                  EL PARLEY
                </span>
              </SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-2 py-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <link.icon className="size-5" />
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-6">
              {isPremium ? (
                <span className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-bold uppercase tracking-wider text-primary">
                  <Crown className="size-4" />
                  Premium activo
                </span>
              ) : (
                <Button asChild className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/premium">
                    <Crown className="size-4" />
                    Premium
                  </Link>
                </Button>
              )}
              {!isAuthenticated ? (
                <>
                  <Button asChild variant="ghost" className="w-full text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <Link href="/login">Entrar</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full border-border text-foreground hover:bg-secondary">
                    <Link href="/register">Crear cuenta</Link>
                  </Button>
                </>
              ) : (
                <Button asChild variant="outline" className="w-full border-border text-foreground hover:bg-secondary">
                  <Link href="/dashboard">Mi cuenta</Link>
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
