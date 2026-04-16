import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Phone, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LegalPage, Section } from "../_components";

export const metadata: Metadata = {
  title: "Juego Responsable — El Parley",
  description:
    "Recursos y herramientas para apostar de manera responsable. Líneas de ayuda nacionales e internacionales, señales de alerta y cómo establecer límites.",
};

export default function JuegoResponsablePage() {
  return (
    <LegalPage title="Juego Responsable" icon={<Heart className="h-5 w-5" />} updated="12 de abril de 2026">

      {/* Banner de emergencia */}
      <Card className="border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-bold text-foreground">¿Necesitas ayuda ahora?</p>
            <p className="mt-0.5 text-muted-foreground">
              <strong className="text-foreground">Colombia:</strong> Línea 106 (Bogotá) ·{" "}
              01800-911-211 (nacional, gratuita 24/7).{" "}
              <strong className="text-foreground">Internacional:</strong>{" "}
              <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                BeGambleAware.org
              </a>{" "}
              · <a href="https://www.gamblingtherapy.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                GamblingTherapy.org
              </a>
            </p>
          </div>
        </div>
      </Card>

      <Section title="Apuesta con cabeza">
        <p>
          Las apuestas deportivas deben ser una actividad de entretenimiento, no una fuente de
          ingresos. El Parley utiliza matemáticas para identificar valor estadístico, pero
          ningún modelo garantiza ganancias. Existe siempre la posibilidad de perder el dinero
          apostado.
        </p>
        <p>
          Solo apuesta dinero que puedas permitirte perder sin que afecte tu calidad de vida,
          el pago de deudas o las necesidades de tu familia.
        </p>
      </Section>

      <Section title="Señales de alerta — ludopatía">
        <p>
          Considera buscar ayuda si reconoces alguna de estas señales en ti mismo o en alguien
          cercano:
        </p>
        <ul>
          <li>Apostar más de lo que tenías planeado, o con dinero destinado a otros gastos.</li>
          <li>Pensar constantemente en las apuestas: próximos partidos, cuotas, estrategias.</li>
          <li>Necesitar apostar cantidades cada vez mayores para sentir emoción.</li>
          <li>Intentar recuperar pérdidas (&ldquo;cazar pérdidas&rdquo;).</li>
          <li>Mentir a familiares o amigos sobre la actividad de juego.</li>
          <li>Sentir irritabilidad o ansiedad cuando no puedes apostar.</li>
          <li>Descuidar el trabajo, los estudios o las relaciones personales por el juego.</li>
        </ul>
      </Section>

      <Section title="Herramientas de autocontrol">
        <p>
          El Parley no procesa apuestas directamente, pero te recomendamos usar las
          herramientas disponibles en los operadores con quienes apuestes:
        </p>
        <ul>
          <li>
            <strong>Límites de depósito diarios/semanales/mensuales</strong> — establece un
            tope antes de empezar.
          </li>
          <li>
            <strong>Autoexclusión temporal o permanente</strong> — disponible en todos los
            operadores licenciados. En Colombia, la gestiona Coljuegos.
          </li>
          <li>
            <strong>Enfriamiento (&ldquo;cool-off&rdquo;)</strong> — pausa de 24h a 6 semanas sin cerrar
            la cuenta.
          </li>
          <li>
            <strong>Registro de apuestas</strong> — lleva un control de lo que gastas e ingresas
            realmente.
          </li>
        </ul>
      </Section>

      <Section title="Recursos de ayuda — Colombia">
        <div className="space-y-3">
          <ResourceLink
            name="LÍNEA 106 — Bogotá"
            desc="Línea gratuita de atención de crisis en salud mental (incluyendo adicciones). Disponible 24/7."
            href="tel:106"
            label="Llamar al 106"
          />
          <ResourceLink
            name="Línea Nacional 01800-911-211"
            desc="Atención gratuita desde cualquier punto del país. Salud mental y adicciones."
            href="tel:01800911211"
            label="Llamar gratis"
          />
          <ResourceLink
            name="Ludopatia.org.co"
            desc="Organización colombiana especializada en prevención y tratamiento de la adicción al juego."
            href="https://ludopatia.org.co"
            label="Visitar sitio"
            external
          />
          <ResourceLink
            name="Coljuegos — Juego Responsable"
            desc="El ente regulador colombiano ofrece información y trámites de autoexclusión."
            href="https://www.coljuegos.gov.co"
            label="Visitar Coljuegos"
            external
          />
        </div>
      </Section>

      <Section title="Recursos de ayuda — Internacional">
        <div className="space-y-3">
          <ResourceLink
            name="BeGambleAware (Global)"
            desc="Plataforma líder de ayuda con acceso a asesoramiento en línea, chat y teléfono en múltiples idiomas."
            href="https://www.begambleaware.org"
            label="Visitar sitio"
            external
          />
          <ResourceLink
            name="Gambling Therapy (Global)"
            desc="Servicio gratuito de apoyo online para el juego problemático, disponible en español y otros idiomas."
            href="https://www.gamblingtherapy.org"
            label="Visitar sitio"
            external
          />
          <ResourceLink
            name="Gamblers Anonymous — Latinoamérica"
            desc="Programa de 12 pasos con grupos de apoyo en Colombia, México, Argentina y más países de LATAM."
            href="https://www.gamblersanonymous.org"
            label="Más información"
            external
          />
          <ResourceLink
            name="Jugadores Anónimos — España"
            desc="Red de grupos de ayuda y recursos para hispanohablantes en España y referidos internacionales."
            href="https://www.jugadoresanonimos.org"
            label="Visitar sitio"
            external
          />
          <ResourceLink
            name="GamCare (Reino Unido)"
            desc="Línea de ayuda y chat 24/7 para el juego problemático en el Reino Unido."
            href="https://www.gamcare.org.uk"
            label="Visitar sitio"
            external
          />
          <ResourceLink
            name="National Problem Gambling Helpline (EE.UU.)"
            desc="Línea de ayuda gratuita 1-800-522-4700, disponible 24/7 para usuarios en Estados Unidos."
            href="https://www.ncpgambling.org/help-treatment/national-helpline-1-800-522-4700/"
            label="Más información"
            external
          />
        </div>
      </Section>

      <Section title="Nuestro compromiso">
        <p>
          El Parley está comprometido con el juego responsable a nivel global. Por ello:
        </p>
        <ul>
          <li>Solo permitimos el acceso a mayores de 18 años (o la mayoría de edad legal de cada país si es superior).</li>
          <li>No dirigimos publicidad a personas en programas de autoexclusión.</li>
          <li>Incluimos advertencias de juego responsable en todos nuestros correos y páginas.</li>
          <li>
            Los operadores referenciados en Colombia cuentan con licencia de{" "}
            <strong>Coljuegos</strong>; los de otros países con sus respectivos entes reguladores.
          </li>
          <li>
            Si detectamos patrones de uso que puedan indicar comportamiento problemático,
            podemos contactarte proactivamente con información de recursos de ayuda.
          </li>
        </ul>
      </Section>

    </LegalPage>
  );
}

function ResourceLink({
  name,
  desc,
  href,
  label,
  external = false,
}: {
  name: string;
  desc: string;
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
      >
        {label}
        {external && <ExternalLink className="h-3 w-3" />}
      </a>
    </Card>
  );
}
