import type { Metadata } from "next";
import { DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BOOKMAKERS } from "@/config/bookmakers";
import { LegalPage, Section } from "../_components";

export const metadata: Metadata = {
  title: "Disclosure de Afiliados — El Parley",
  description:
    "Transparencia sobre las relaciones comerciales de afiliación de El Parley con operadores de apuestas deportivas en Colombia y otros países.",
};

export default function AfiliadosPage() {
  return (
    <LegalPage
      title="Disclosure de Afiliados"
      icon={<DollarSign className="h-5 w-5" />}
      updated="12 de abril de 2026"
    >
      <Section title="¿Qué es un enlace de afiliado?">
        <p>
          Algunos de los enlaces a casas de apuestas que aparecen en El Parley son{" "}
          <strong>enlaces de afiliado</strong>. Cuando haces clic en uno de estos enlaces y te
          registras o depositas en el operador correspondiente, El Parley puede recibir una
          comisión por parte de ese operador. Esta comisión es pagada por la casa de apuestas y{" "}
          <strong>no tiene ningún costo adicional para ti</strong>.
        </p>
      </Section>

      <Section title="Impacto en nuestros análisis">
        <p>
          Las relaciones de afiliación <strong>no influyen en nuestros análisis matemáticos</strong>.
          Las value bets son detectadas por un modelo estadístico automatizado (Poisson + xG)
          que evalúa todas las cuotas disponibles sin favorecer ningún operador.
        </p>
        <p>
          La selección del bookmaker en una value bet se basa exclusivamente en cuál ofrece la
          cuota más alta para esa selección en ese momento, independientemente de si tenemos
          acuerdo de afiliación con ese operador o no.
        </p>
      </Section>

      <Section title="Operadores con acuerdo de afiliación">
        <p>
          A la fecha de actualización de este documento, El Parley mantiene acuerdos de
          afiliación con los siguientes operadores:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.values(BOOKMAKERS).map((bm) => (
            <Card key={bm.slug} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold text-foreground">{bm.name}</p>
                <p className="text-xs text-muted-foreground">
                  Comisión: Revenue share o CPA
                </p>
              </div>
              <span className="rounded-full border border-value/30 bg-value/10 px-2.5 py-0.5 text-xs font-bold text-value">
                Afiliado
              </span>
            </Card>
          ))}
        </div>
        <p className="mt-4">
          <strong>Nota para usuarios internacionales:</strong> los operadores listados están
          principalmente licenciados por <strong>Coljuegos</strong> para operar en Colombia y
          pueden no estar disponibles, autorizados o ser legales en tu país de residencia.{" "}
          Es tu responsabilidad verificar la legalidad de cada operador en tu jurisdicción
          antes de registrarte o depositar.
        </p>
      </Section>

      <Section title="Seguimiento de clics">
        <p>
          Cuando haces clic en un enlace de afiliado, registramos los siguientes datos con
          fines de facturación y análisis:
        </p>
        <ul>
          <li>Hash de IP (nunca la IP en texto plano).</li>
          <li>Operador al que se redirigió.</li>
          <li>Sección de la plataforma desde la que se hizo clic.</li>
          <li>Timestamp del clic.</li>
        </ul>
        <p>
          No rastreamos ninguna actividad dentro del sitio del operador (depósitos, apuestas,
          retiros). Esa información solo la maneja el operador conforme a sus propias políticas.
        </p>
      </Section>

      <Section title="Nuestro compromiso de objetividad">
        <p>
          El Parley se financia principalmente a través de suscripciones Premium y
          comisiones de afiliado. Para mantener la confianza de nuestros usuarios, nos
          comprometemos a:
        </p>
        <ul>
          <li>
            Nunca alterar los resultados del modelo matemático para favorecer a un operador
            afiliado.
          </li>
          <li>
            Mostrar siempre la mejor cuota disponible, incluso si el operador que la ofrece
            no tiene acuerdo de afiliación con nosotros.
          </li>
          <li>
            Señalar claramente los enlaces de afiliado en la interfaz con el texto
            &ldquo;Abrir en [Bookmaker]&rdquo; o similar.
          </li>
          <li>
            Actualizar este documento cuando se establezcan o terminen nuevos acuerdos de
            afiliación.
          </li>
        </ul>
      </Section>

      <Section title="Regulación y cumplimiento">
        <p>
          Este disclosure cumple con los requerimientos de transparencia establecidos por:
        </p>
        <ul>
          <li>
            <strong>Superintendencia de Industria y Comercio (SIC)</strong> — Colombia.
          </li>
          <li>
            <strong>Federal Trade Commission (FTC) — Guides 16 C.F.R. Part 255</strong> —
            para audiencias en Estados Unidos.
          </li>
          <li>
            <strong>CAP Code / ASA</strong> — para audiencias en el Reino Unido.
          </li>
          <li>
            <strong>Directiva 2005/29/CE sobre prácticas comerciales desleales</strong> —
            para audiencias en la Unión Europea.
          </li>
        </ul>
        <p>
          Si tienes preguntas sobre nuestras relaciones comerciales o deseas reportar un
          posible conflicto de interés, escríbenos a <strong>legal@elparley.com</strong>.
        </p>
      </Section>
    </LegalPage>
  );
}
