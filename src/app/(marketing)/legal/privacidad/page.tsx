import type { Metadata } from "next";
import { Shield } from "lucide-react";
import { LegalPage, Section } from "../_components";

export const metadata: Metadata = {
  title: "Política de Privacidad — El Parley",
  description:
    "Cómo El Parley recopila, usa y protege tus datos personales conforme a la Ley 1581 de 2012 (Colombia), el RGPD (UE) y normativas internacionales de privacidad.",
};

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de Privacidad" icon={<Shield className="h-5 w-5" />} updated="12 de abril de 2026">
      <Section title="1. Responsable del tratamiento">
        <p>
          El Parley es el responsable del tratamiento de los datos personales que recopila a
          través de su plataforma web, accesible globalmente. Si tienes preguntas sobre el uso
          de tus datos, puedes contactarnos en <strong>privacidad@elparley.com</strong>.
        </p>
      </Section>

      <Section title="2. Datos que recopilamos">
        <p>Recopilamos únicamente los datos necesarios para prestar el servicio:</p>
        <ul>
          <li>
            <strong>Datos de cuenta:</strong> dirección de email, nombre de usuario (opcional),
            foto de perfil (opcional, si usas Google OAuth).
          </li>
          <li>
            <strong>Datos de uso:</strong> partidos consultados, value bets visualizadas,
            parlays guardados, preferencias de liga.
          </li>
          <li>
            <strong>Datos de pago:</strong> no almacenamos datos de tarjeta. El procesamiento lo
            realizan Stripe, PayU y Mercado Pago, sujetos a sus propias políticas de privacidad
            y normas PCI-DSS.
          </li>
          <li>
            <strong>Datos de navegación:</strong> dirección IP (hasheada, nunca en texto plano),
            tipo de navegador, páginas visitadas, duración de sesión — para análisis de uso y
            seguridad.
          </li>
          <li>
            <strong>Clics de afiliado:</strong> registramos qué bookmaker visitaste y desde qué
            sección, para fines de facturación de comisiones. No se registra ninguna apuesta ni
            actividad posterior en el sitio del operador.
          </li>
        </ul>
      </Section>

      <Section title="3. Finalidades del tratamiento">
        <ul>
          <li>Prestación del servicio de análisis y comparación de cuotas.</li>
          <li>Gestión de tu cuenta y suscripción.</li>
          <li>Procesamiento de pagos y prevención de fraude.</li>
          <li>Mejora del producto mediante análisis de uso agregado.</li>
          <li>Envío de comunicaciones transaccionales (confirmación de pago, cambios de cuenta).</li>
          <li>
            Envío de notificaciones de value bets y resúmenes de picks (solo si das tu
            consentimiento explícito).
          </li>
        </ul>
      </Section>

      <Section title="4. Base legal del tratamiento">
        <p>El tratamiento de tus datos se basa en:</p>
        <ul>
          <li>
            <strong>Ejecución del contrato:</strong> los datos necesarios para proveerte el
            servicio.
          </li>
          <li>
            <strong>Consentimiento:</strong> notificaciones push y emails de marketing.
          </li>
          <li>
            <strong>Interés legítimo:</strong> seguridad, prevención de fraude y mejora del
            servicio.
          </li>
          <li>
            <strong>Obligación legal:</strong> conservación de registros de facturación conforme
            a la normativa tributaria aplicable.
          </li>
        </ul>
      </Section>

      <Section title="5. Transferencias internacionales de datos">
        <p>
          El Parley es un servicio de alcance global. Tus datos pueden ser procesados o
          almacenados en servidores ubicados fuera de tu país de residencia. En todos los casos
          aplicamos las garantías adecuadas:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> (base de datos y autenticación) — servidores en US East;
            acogido a las cláusulas contractuales tipo de la UE (SCCs).
          </li>
          <li>
            <strong>Stripe</strong> (pagos internacionales) — acogido a las SCCs y certificado
            bajo los marcos de privacidad UE-EE.UU.
          </li>
          <li>
            <strong>PayU</strong> (pagos Colombia) — operación conforme a la Ley 1581 de 2012
            y acuerdos de procesamiento de datos.
          </li>
          <li>
            <strong>Mercado Pago</strong> (pagos Colombia y LATAM) — operación conforme a la
            Ley 1581 de 2012 (Colombia) y normativas locales de cada país donde opera; sujeto
            a certificación PCI-DSS y sus propios acuerdos de procesamiento de datos.
          </li>
          <li>
            <strong>Vercel</strong> (infraestructura de hosting) — servidores globales; acogido
            a las SCCs.
          </li>
          <li>
            <strong>PostHog</strong> (analítica de producto) — datos anonimizados y
            pseudonimizados; acogido a las SCCs.
          </li>
        </ul>
        <p>
          No vendemos ni alquilamos tus datos personales a terceros bajo ninguna circunstancia.
        </p>
      </Section>

      <Section title="6. Tus derechos">
        <p>
          Independientemente de tu país de residencia, reconocemos los siguientes derechos:
        </p>
        <ul>
          <li>Acceder a los datos que tenemos sobre ti.</li>
          <li>Rectificar datos incorrectos o incompletos.</li>
          <li>Suprimir tus datos (&ldquo;derecho al olvido&rdquo;).</li>
          <li>Oponerte al tratamiento o solicitar su limitación.</li>
          <li>Portabilidad: recibir tus datos en formato estructurado y legible por máquina.</li>
          <li>Retirar el consentimiento en cualquier momento, sin efecto retroactivo.</li>
        </ul>
        <p>
          <strong>Usuarios en Colombia</strong> — Ley 1581 de 2012 (Habeas Data): puedes
          ejercer estos derechos ante la Superintendencia de Industria y Comercio (SIC) si
          consideras que tus derechos han sido vulnerados.
        </p>
        <p>
          <strong>Usuarios en la UE/EEA/Reino Unido</strong> — RGPD / UK GDPR: tienes
          derecho a presentar reclamaciones ante la autoridad de control de tu país (p. ej.,
          AEPD en España, ICO en Reino Unido, CNIL en Francia).
        </p>
        <p>
          <strong>Usuarios en otros países:</strong> aplicamos como mínimo los estándares del
          RGPD con carácter voluntario para garantizar un nivel de protección equivalente.
        </p>
        <p>
          Para ejercer cualquier derecho, elimina tu cuenta desde el dashboard o escríbenos a{" "}
          <strong>privacidad@elparley.com</strong>. Respondemos en un máximo de{" "}
          <strong>15 días hábiles</strong>.
        </p>
      </Section>

      <Section title="7. Retención de datos">
        <p>
          Conservamos tus datos mientras tu cuenta esté activa. Tras eliminar tu cuenta, los
          datos personales se anonimizarán en un plazo de <strong>30 días</strong>. Los registros
          de facturación se conservan <strong>5 años</strong> por obligación legal tributaria
          (plazo aplicable en Colombia; puede variar en otras jurisdicciones conforme a la ley
          local).
        </p>
      </Section>

      <Section title="8. Cookies">
        <p>
          El Parley utiliza cookies estrictamente necesarias para la sesión de usuario y el
          correcto funcionamiento de la plataforma. No utilizamos cookies de publicidad
          comportamental de terceros ni redes de retargeting.
        </p>
        <p>
          Los usuarios en la UE/EEA verán un aviso de consentimiento de cookies conforme a la
          Directiva ePrivacy. Puedes gestionar tus preferencias en cualquier momento desde la
          configuración de tu navegador.
        </p>
      </Section>

      <Section title="9. Cambios en esta política">
        <p>
          Podemos actualizar esta política periódicamente. Te notificaremos por email ante
          cambios sustanciales con al menos 7 días de antelación. La versión vigente siempre
          estará disponible en esta página con la fecha de última actualización.
        </p>
      </Section>
    </LegalPage>
  );
}
