"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  TrendingUp,
  Newspaper,
  ClipboardList,
  Layers,
  Menu,
  Crown,
  Zap,
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
  { href: "/blog", label: "Análisis", icon: Newspaper },
  { href: "/mis-picks", label: "Mis Picks", icon: ClipboardList },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 h-16 w-full border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 lg:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="El Parley" width={140} height={40} className="h-10 w-auto" priority />
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
          <Button asChild size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/premium">
              <Crown className="size-4" />
              Premium
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="border-border text-foreground hover:bg-secondary">
            <Link href="/register">Crear cuenta</Link>
          </Button>
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
              <SheetTitle className="flex items-center">
                <Image src="/logo.png" alt="El Parley" width={120} height={36} className="h-9 w-auto" />
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
              <Button asChild className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/premium">
                  <Crown className="size-4" />
                  Premium
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full text-muted-foreground hover:bg-secondary hover:text-foreground">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild variant="outline" className="w-full border-border text-foreground hover:bg-secondary">
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
