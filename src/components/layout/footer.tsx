import Link from "next/link";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/40 bg-muted/20">
      {/* Banner juego responsable */}
      <div className="border-b border-border/40 bg-amber-500/5">
        <div className="container flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Juega responsablemente.</strong> Apostar
            puede ser adictivo. Solo para mayores de 18 años. La disponibilidad de los
            operadores referenciados varía por país — verifica la legalidad en tu
            jurisdicción. Ayuda:{" "}
            <strong className="text-foreground">Colombia</strong> 106 / 01800-911-211 ·{" "}
            <strong className="text-foreground">Internacional</strong>{" "}
            <a
              href="https://www.begambleaware.org"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              BeGambleAware.org
            </a>
            {" "}·{" "}
            <a
              href="https://www.gamblingtherapy.org"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              GamblingTherapy.org
            </a>
          </p>
        </div>
      </div>

      <div className="container grid gap-8 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link href="/" className="relative inline-flex items-center gap-2.5">
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-24 w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 blur-2xl"
            />
            <Image
              src="/logo.png"
              alt="El Parley"
              width={161}
              height={46}
              className="relative h-[46px] w-auto"
            />
            <span
              className="relative text-xl font-bold tracking-wide"
              style={{ color: "#998728" }}
            >
              EL PARLEY
            </span>
          </Link>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            La plataforma de value betting #1 para Colombia y Latinoamérica.
            Estadísticas, comparador de cuotas y análisis matemático.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider">Producto</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground">Partidos hoy</Link></li>
            <li><Link href="/parlays" className="hover:text-foreground">Parlays</Link></li>
            <li><Link href="/premium" className="hover:text-foreground">Premium</Link></li>
            <li><Link href="/blog" className="hover:text-foreground">Análisis</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/legal/terminos" className="hover:text-foreground">Términos</Link></li>
            <li><Link href="/legal/privacidad" className="hover:text-foreground">Privacidad</Link></li>
            <li><Link href="/legal/juego-responsable" className="hover:text-foreground">Juego responsable</Link></li>
            <li><Link href="/legal/afiliados" className="hover:text-foreground">Disclosure afiliados</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/40">
        <div className="container py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} El Parley. Plataforma informativa. No aceptamos
          apuestas ni custodiamos fondos.
        </div>
      </div>
    </footer>
  );
}
