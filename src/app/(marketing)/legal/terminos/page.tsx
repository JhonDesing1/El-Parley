import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { LegalPage, Section } from "../_components";

export const metadata: Metadata = {
  title: "Términos de Uso — El Parley",
  description:
    "Términos y condiciones de uso de El Parley. Plataforma informativa de análisis de value bets y comparación de cuotas para Colombia y LATAM.",
};

export default function TerminosPage() {
  return (
    <LegalPage title="Términos de Uso" icon={<FileText className="h-5 w-5" />} updated="12 de abril de 2026">
      <Section title="1. Naturaleza del servicio">
        <p>
          El Parley (en adelante, &ldquo;la Plataforma&rdquo;) es un servicio informativo y analítico
          de carácter global. No somos una casa de apuestas, no aceptamos depósitos, no gestionamos
          fondos de usuarios y no intermediamos en la colocación de apuestas.
        </p>
        <p>
          Nuestra herramienta aplica modelos estadísticos (Poisson, Dixon-Coles, xG) para
          identificar oportunidades de valor matemático en las cuotas publicadas por operadores
          legalmente autorizados. Los resultados son informativos y no constituyen asesoramiento
          financiero ni garantía de ganancia.
        </p>
        <p>
          <strong>Aviso importante:</strong> La disponibilidad y legalidad de los servicios de
          apuestas deportivas varía según el país. Es responsabilidad exclusiva del usuario
          verificar que el uso de esta plataforma y de los operadores referenciados sea legal en
          su jurisdicción antes de actuar sobre cualquier análisis aquí publicado.
        </p>
      </Section>

      <Section title="2. Elegibilidad">
        <p>Para usar El Parley debes:</p>
        <ul>
          <li>Tener al menos <strong>18 años de edad</strong> (o la mayoría de edad legal aplicable en tu país, si esta es superior).</li>
          <li>
            Encontrarte en una jurisdicción donde el uso de servicios informativos de apuestas
            deportivas sea legal. En caso de duda, consulta la legislación vigente de tu país.
          </li>
          <li>No estar inscrito en ningún programa de autoexclusión activo en ningún operador.</li>
          <li>
            No residir en jurisdicciones donde el acceso a contenido relacionado con apuestas
            deportivas esté expresamente prohibido (ej. ciertos estados de EE.UU., países con
            prohibición total del juego).
          </li>
        </ul>
        <p>
          El Parley se reserva el derecho de restringir el acceso a usuarios de jurisdicciones
          donde la operación de este tipo de servicio informativo no esté permitida.
        </p>
      </Section>

      <Section title="3. Cuenta de usuario">
        <p>
          Al crear una cuenta aceptas proporcionar información veraz. Eres responsable de
          mantener la confidencialidad de tus credenciales. El Parley no se responsabiliza
          por accesos no autorizados derivados del uso negligente de tu contraseña.
        </p>
        <p>
          Puedes eliminar tu cuenta en cualquier momento desde el dashboard. Tras la eliminación,
          los datos personales serán anonimizados o borrados conforme a nuestra Política de
          Privacidad.
        </p>
      </Section>

      <Section title="4. Planes de suscripción">
        <p>
          El Parley ofrece un plan gratuito con acceso limitado y planes Premium con acceso
          completo a value bets de alta confianza, parlays y análisis avanzados. Los precios y
          beneficios específicos se detallan en la página de precios.
        </p>
        <p>
          Los pagos son procesados por Stripe (tarjeta internacional) o PayU (Colombia — PSE,
          efectivo, tarjeta local). Las suscripciones se renuevan automáticamente salvo que las
          canceles antes del próximo ciclo de facturación.
        </p>
        <p>
          <strong>Política de cancelación y reembolso:</strong> Puedes cancelar tu suscripción
          en cualquier momento desde el dashboard, con efecto al final del ciclo de facturación
          en curso. No se realizarán reembolsos una vez iniciado el período, salvo en los
          siguientes casos:
        </p>
        <ul>
          <li>Error técnico demostrable atribuible a El Parley que haya impedido el acceso al servicio.</li>
          <li>
            <strong>Usuarios en Colombia:</strong> conforme al artículo 47 de la Ley 1480 de 2011
            (Estatuto del Consumidor), tienes derecho de retracto dentro de los <strong>5 días hábiles</strong>{" "}
            siguientes a la contratación del servicio, siempre que no hayas hecho uso efectivo
            del mismo.
          </li>
          <li>
            <strong>Usuarios en la Unión Europea:</strong> de acuerdo con la Directiva 2011/83/UE,
            dispones de <strong>14 días naturales</strong> de desistimiento desde la contratación,
            salvo que hayas solicitado expresamente el inicio inmediato del servicio.
          </li>
        </ul>
        <p>
          Las solicitudes de reembolso deben enviarse a{" "}
          <strong>soporte@elparley.com</strong> indicando el motivo y el número de transacción.
        </p>
      </Section>

      <Section title="5. Limitación de responsabilidad">
        <p>
          El Parley proporciona análisis estadísticos con fines educativos e informativos
          exclusivamente. Las apuestas deportivas implican riesgo de pérdida económica. Ningún
          modelo matemático — por sofisticado que sea — garantiza resultados positivos.
        </p>
        <p>
          En ningún caso El Parley, sus directores, empleados o colaboradores serán
          responsables de pérdidas económicas derivadas de decisiones de apuesta basadas en
          el contenido de la Plataforma.
        </p>
        <p>
          La Plataforma no se responsabiliza por la disponibilidad, legalidad ni prácticas
          comerciales de los operadores de apuestas referenciados. Cada operador es una entidad
          independiente sujeta a su propia regulación.
        </p>
      </Section>

      <Section title="6. Propiedad intelectual">
        <p>
          Los modelos matemáticos, algoritmos, análisis generados, diseño y código fuente de
          El Parley son propiedad exclusiva de la Plataforma y están protegidos por las leyes
          de propiedad intelectual aplicables a nivel nacional e internacional. Queda prohibida
          su reproducción total o parcial sin autorización expresa por escrito.
        </p>
      </Section>

      <Section title="7. Modificaciones">
        <p>
          Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios
          sustanciales serán notificados por email con al menos <strong>7 días de antelación</strong>.
          El uso continuado de la Plataforma tras la notificación implica la aceptación de los
          nuevos términos.
        </p>
      </Section>

      <Section title="8. Ley aplicable y jurisdicción">
        <p>
          Estos términos se rigen por las leyes de la República de Colombia, con sede en Bogotá D.C.,
          sin perjuicio de las disposiciones de orden público o de protección al consumidor que
          resulten imperativamente aplicables en el país de residencia del usuario.
        </p>
        <p>
          Los usuarios ubicados en la Unión Europea, Reino Unido u otras jurisdicciones con
          normativa imperativa de protección al consumidor podrán acogerse a los mecanismos de
          resolución alternativa de disputas (ADR/ODR) previstos en sus respectivas legislaciones.
          La plataforma ODR de la UE está disponible en{" "}
          <strong>ec.europa.eu/consumers/odr</strong>.
        </p>
      </Section>
    </LegalPage>
  );
}
