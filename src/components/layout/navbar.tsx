"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Zap,
  TrendingUp,
  Newspaper,
  ClipboardList,
  BookOpen,
  Menu,
  Crown,
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
  { href: "/parlays", label: "Parlays", icon: TrendingUp },
  { href: "/blog", label: "Análisis", icon: Newspaper },
  { href: "/mis-picks", label: "Mis Picks", icon: ClipboardList },
  { href: "/bankroll", label: "Bankroll", icon: BookOpen },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 h-16 w-full border-b border-zinc-800 bg-zinc-950/90 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/90">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 lg:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Zap className="size-7 fill-amber-500 text-amber-500" />
          <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-xl font-bold text-transparent">
            El Parley
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100"
            >
              <link.icon className="size-4" />
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop Right Side Buttons */}
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild size="sm" className="gap-1.5 border border-amber-500/30 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 hover:from-amber-400 hover:to-amber-500">
            <Link href="/premium">
              <Crown className="size-4" />
              Premium
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="bg-zinc-100 text-zinc-950 hover:bg-zinc-200">
            <Link href="/register">Crear cuenta</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
            >
              <Menu className="size-6" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-full border-zinc-800 bg-zinc-950 sm:max-w-sm"
          >
            <SheetHeader className="border-b border-zinc-800 pb-4">
              <SheetTitle className="flex items-center gap-2">
                <Zap className="size-6 fill-amber-500 text-amber-500" />
                <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-lg font-bold text-transparent">
                  El Parley
                </span>
              </SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-2 py-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-zinc-300 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100"
                >
                  <link.icon className="size-5" />
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-800 pt-6">
              <Button asChild className="w-full gap-2 border border-amber-500/30 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 hover:from-amber-400 hover:to-amber-500">
                <Link href="/premium">
                  <Crown className="size-4" />
                  Premium
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild className="w-full bg-zinc-100 text-zinc-950 hover:bg-zinc-200">
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
