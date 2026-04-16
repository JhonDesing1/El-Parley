import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  convertInchesToTwip,
} from "docx";
import { writeFileSync } from "fs";

// ─── Helpers ───────────────────────────────────────────────────────────────

const COLORS = {
  primary: "1A56DB",   // azul
  green:   "057A55",
  red:     "C81E1E",
  yellow:  "9F580A",
  gray:    "6B7280",
  lightBg: "F3F4F6",
  headerBg:"1E3A5F",
  white:   "FFFFFF",
  border:  "D1D5DB",
};

const h1 = (text) =>
  new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    run: { color: COLORS.headerBg, bold: true, size: 36 },
  });

const h2 = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, color: COLORS.primary })],
    spacing: { before: 360, after: 120 },
    border: { bottom: { color: COLORS.primary, size: 4, style: BorderStyle.SINGLE } },
  });

const h3 = (text, color = COLORS.headerBg) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color })],
    spacing: { before: 240, after: 100 },
  });

const p = (text, opts = {}) =>
  new Paragraph({
    children: [new TextRun({ text, size: 22, color: "374151", ...opts })],
    spacing: { before: 80, after: 80 },
  });

const bullet = (text, level = 0) =>
  new Paragraph({
    children: [new TextRun({ text, size: 22, color: "374151" })],
    bullet: { level },
    spacing: { before: 60, after: 60 },
  });

const checkItem = (text, checked = false) =>
  new Paragraph({
    children: [
      new TextRun({ text: checked ? "☑ " : "☐ ", size: 22, bold: true, color: checked ? COLORS.green : COLORS.gray }),
      new TextRun({ text, size: 22, color: "374151" }),
    ],
    spacing: { before: 60, after: 60 },
    indent: { left: convertInchesToTwip(0.25) },
  });

const divider = () =>
  new Paragraph({
    border: { top: { color: COLORS.border, size: 6, style: BorderStyle.SINGLE } },
    spacing: { before: 200, after: 200 },
  });

const badge = (text, color) =>
  new TextRun({ text: ` ${text} `, color: COLORS.white, highlight: undefined, size: 20, bold: true, shading: { type: ShadingType.SOLID, color } });

// ─── Status Table ───────────────────────────────────────────────────────────

const statusCell = (text, color, bg = COLORS.white) =>
  new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 20, color })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: { type: ShadingType.SOLID, color: bg },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });

const dataCell = (text, bold = false) =>
  new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, size: 20, bold })] })],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });

const headerCell = (text) =>
  new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, color: COLORS.white })] })],
    shading: { type: ShadingType.SOLID, color: COLORS.headerBg },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });

const statusRow = (component, status, statusText, color, priority) =>
  new TableRow({
    children: [
      dataCell(component),
      statusCell(statusText, color),
      dataCell(priority),
    ],
  });

// ─── Document ───────────────────────────────────────────────────────────────

const doc = new Document({
  creator: "ApuestaValue",
  title: "Análisis Técnico ApuestaValue — Pre-lanzamiento",
  description: "Informe completo del estado del proyecto y checklist para producción",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22, color: "1F2937" } },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        },
      },
      children: [
        // ── PORTADA ──────────────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: "ApuestaValue", bold: true, size: 64, color: COLORS.primary })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 800, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Análisis Técnico Pre-Lanzamiento", size: 40, color: COLORS.gray })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Fecha: 11 de abril de 2026", size: 22, color: COLORS.gray, italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 600 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Estado general: ", size: 26, bold: true }),
            new TextRun({ text: "~85% completo", size: 26, bold: true, color: COLORS.primary }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 1200 },
        }),

        divider(),

        // ── 1. RESUMEN EJECUTIVO ─────────────────────────────────────────────
        h1("1. Resumen Ejecutivo"),
        p(
          "ApuestaValue es una plataforma full-stack de detección de value bets dirigida al mercado colombiano/LATAM. " +
          "Identifica oportunidades de apuesta matemáticamente rentables y parlays curados en múltiples casas de apuestas."
        ),
        p(
          "El proyecto cuenta con una arquitectura técnica sólida: Next.js 15 (App Router) + TypeScript + Supabase + " +
          "Tailwind/Shadcn + TanStack Query v5. La base de datos está correctamente diseñada con 17 tablas y políticas " +
          "RLS robustas. La lógica matemática de apuestas (Poisson + Kelly Criterion + método de Shin) es correcta y " +
          "tiene cobertura de tests."
        ),
        p(
          "Sin embargo, existen brechas críticas que impiden el lanzamiento directo a producción, principalmente en " +
          "gestión de cuota de API, sistema de tracking de picks y configuración de datos de producción."
        ),

        divider(),

        // ── 2. ESTADO POR COMPONENTE ─────────────────────────────────────────
        h1("2. Estado por Componente"),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                headerCell("Componente"),
                headerCell("Estado"),
                headerCell("Prioridad"),
              ],
              tableHeader: true,
            }),
            statusRow("Auth (magic link + Google OAuth)", "ok", "✅ Listo", COLORS.green, "Ready"),
            statusRow("Base de datos (17 tablas + RLS)", "warn", "⚠️ Casi listo", COLORS.yellow, "Alta"),
            statusRow("Lógica matemática (Kelly, Poisson, Value Bet)", "ok", "✅ Listo", COLORS.green, "Ready"),
            statusRow("UI / Frontend completo", "ok", "✅ Listo", COLORS.green, "Ready"),
            statusRow("Pagos Stripe", "ok", "✅ Listo", COLORS.green, "Ready"),
            statusRow("Pagos PayU", "warn", "⚠️ Parcial", COLORS.yellow, "Alta"),
            statusRow("Cron jobs en Vercel", "ok", "✅ Listo", COLORS.green, "Media"),
            statusRow("Tracking de afiliados", "ok", "✅ Listo", COLORS.green, "Ready"),
            statusRow("Blog auto-generado", "ok", "✅ Listo", COLORS.green, "Ready"),
            statusRow("SEO / JSON-LD", "ok", "✅ Listo", COLORS.green, "Ready"),
            statusRow("Sistema de picks / ROI tracker", "err", "❌ No implementado", COLORS.red, "Crítica"),
            statusRow("Leaderboard (vista materializada)", "err", "❌ SQL faltante", COLORS.red, "Crítica"),
            statusRow("Gestión de cuota API-Football", "err", "❌ No gestionada", COLORS.red, "Crítica"),
            statusRow("Plan Pro (flujo de compra)", "err", "❌ No implementado", COLORS.red, "Media"),
            statusRow("Edge Functions (deploy)", "warn", "⚠️ Manual", COLORS.yellow, "Alta"),
          ],
        }),

        divider(),

        // ── 3. PROBLEMAS CRÍTICOS ────────────────────────────────────────────
        h1("3. Problemas Críticos (bloquean el lanzamiento)"),

        // 3.1
        h2("3.1 API-Football excede el límite gratuito"),
        p(
          "El free tier de API-Football otorga 100 requests/día. Los cron jobs actuales consumen:"
        ),
        bullet("sync-odds (cada 10 min) → ~144 calls/día solo este endpoint"),
        bullet("sync-fixtures (cada 6h) → ~20-40 calls adicionales"),
        bullet("Total estimado: ~165-185 requests/día (excede el límite en 65-85%)"),
        p("IMPACTO: La plataforma deja de recibir datos actualizados de odds en menos de 24h de producción.", { bold: true, color: COLORS.red }),
        h3("Solución recomendada:", COLORS.green),
        bullet("Cambiar sync-odds a cada 30 min → 48 calls/día"),
        bullet("Limitar a ligas prioritarias: Liga BetPlay, Copa Colombia"),
        bullet("O contratar plan básico de API-Football ($19/mes) → 500 req/día"),

        // 3.2
        h2("3.2 Vista materializada del Leaderboard faltante"),
        p(
          "La migración 00003_functions.sql y el cron refresh-leaderboard llaman a " +
          "REFRESH MATERIALIZED VIEW leaderboard, pero el SQL de CREATE MATERIALIZED VIEW " +
          "no existe en ninguna de las 3 migraciones actuales."
        ),
        p("IMPACTO: Error en producción cada hora al intentar refrescar el leaderboard.", { bold: true, color: COLORS.red }),
        h3("Solución recomendada:", COLORS.green),
        bullet("Crear migración 00004_leaderboard_view.sql con la definición de la vista materializada"),
        bullet("Ejecutar npm run db:push para aplicarla al proyecto de Supabase"),

        // 3.3
        h2("3.3 No hay sistema de registro de picks / resultados"),
        p(
          "El dashboard muestra métricas como ROI 30d, win rate y total picks, pero no existe " +
          "interfaz para que los usuarios registren si una apuesta ganó o perdió. La tabla " +
          "user_parlays existe en la base de datos pero su UI está incompleta."
        ),
        p("IMPACTO: El dashboard de usuario muestra valores en cero, generando mala experiencia.", { bold: true, color: COLORS.red }),
        h3("Solución para MVP:", COLORS.green),
        bullet("Opción A (rápida): Ocultar el tracker de picks en v1, mostrar solo recomendaciones del sistema"),
        bullet("Opción B (completa): Implementar UI de registro de picks antes del lanzamiento (~3-4 días)"),
        bullet("El ROI del sistema sí se puede calcular automáticamente desde value_bets.result"),

        // 3.4
        h2("3.4 Credenciales PayU de sandbox hardcodeadas"),
        p(
          "En src/lib/payu/client.ts las credenciales de prueba están escritas directamente en el código. " +
          "Aunque las de producción se inyectan vía variables de entorno, el patrón es riesgoso y " +
          "puede causar confusión al desplegar."
        ),
        p("IMPACTO: Riesgo de usar credenciales incorrectas en producción; mala práctica de seguridad.", { bold: true, color: COLORS.yellow }),
        h3("Solución recomendada:", COLORS.green),
        bullet("Mover todas las credenciales PayU (sandbox y producción) a variables de entorno"),
        bullet("Usar PAYU_ENV=sandbox|production para seleccionar el conjunto correcto"),

        divider(),

        // ── 4. PROBLEMAS MEDIOS ──────────────────────────────────────────────
        h1("4. Problemas Medios (post-lanzamiento o v1.1)"),

        h2("4.1 Plan Pro sin flujo de compra"),
        p(
          "La página /premium anuncia el Plan Pro ($59.900/mes) con features como API REST, backtesting, " +
          "Telegram bot y webhooks. El botón dice 'Hablar con ventas' sin formulario ni integración, y " +
          "las features del Pro no están implementadas en el código."
        ),
        h3("Recomendación:", COLORS.primary),
        bullet("Eliminar el Plan Pro del pricing page en v1 o marcarlo como 'Próximamente'"),
        bullet("Evitar generar expectativas de features que no existen"),

        h2("4.2 Edge Functions requieren deploy manual"),
        p(
          "La función detect-value-bets en Supabase debe desplegarse con el CLI " +
          "(npx supabase functions deploy detect-value-bets) y este paso no está " +
          "automatizado en el pipeline de CI/CD. Si no se ejecuta, los value bets nunca se detectan."
        ),
        h3("Recomendación:", COLORS.primary),
        bullet("Agregar este paso explícito al DEPLOY.md y al checklist de cada deploy"),
        bullet("Temporalmente: mover la detección a una API route de Next.js hasta automatizar"),

        h2("4.3 Leaderboard vacío al inicio"),
        p(
          "Sin datos históricos de usuarios, el leaderboard estará completamente vacío al lanzar. " +
          "Esto da mala impresión a los primeros visitantes."
        ),
        h3("Recomendación:", COLORS.primary),
        bullet("Sembrar tipsters demo con estadísticas simuladas durante las primeras semanas"),
        bullet("O no mostrar el leaderboard hasta tener mínimo 30-50 usuarios activos"),

        h2("4.4 OneSignal sin manejo de errores"),
        p(
          "Si NEXT_PUBLIC_ONESIGNAL_APP_ID no está configurado en el entorno, " +
          "los componentes que lo usan pueden fallar silenciosamente o lanzar errores no manejados."
        ),
        h3("Recomendación:", COLORS.primary),
        bullet("Agregar un guard: if (!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) return null"),
        bullet("O desactivar las notificaciones push para la v1 del lanzamiento"),

        divider(),

        // ── 5. PUNTOS FUERTES ────────────────────────────────────────────────
        h1("5. Puntos Fuertes del Proyecto"),

        h2("5.1 Matemática de apuestas correcta y testeada"),
        p(
          "Los algoritmos implementados son matemáticamente sólidos:"
        ),
        bullet("Poisson + Dixon-Coles: modelo de goles estándar en la industria con ajuste de correlación"),
        bullet("Kelly Criterion (1/4 Kelly): sizing conservador, cap de 5% del bankroll"),
        bullet("Shin's method para remoción de vig: más sofisticado que el método multiplicativo simple"),
        bullet("Edge threshold ≥ 3%: umbral razonable para detectar value bets genuinas"),
        bullet("Cobertura de tests en vitest para todos los módulos matemáticos"),

        h2("5.2 Seguridad bien implementada"),
        bullet("RLS en Supabase: contenido premium correctamente protegido por tier"),
        bullet("Service role key nunca expuesta al cliente"),
        bullet("CRON_SECRET protege todos los endpoints de cron jobs"),
        bullet("Firma HMAC verificada en webhooks de Stripe y PayU"),
        bullet("IP hashing para tracking de afiliados (privacidad del usuario)"),
        bullet("Headers de seguridad en next.config.ts (X-Frame-Options, CSP, etc.)"),

        h2("5.3 Arquitectura escalable"),
        bullet("App Router con RSC: renders en servidor para SEO y performance"),
        bullet("TanStack Query v5: cache inteligente en cliente"),
        bullet("Supabase Edge Functions para operaciones costosas"),
        bullet("Doble procesador de pagos: Stripe (global) + PayU (Colombia COP)"),
        bullet("pg_cron nativo en Supabase para tareas de base de datos"),

        divider(),

        // ── 6. NOTA SOBRE APIs DE PRUEBA ────────────────────────────────────
        h1("6. Nota sobre APIs y Credenciales de Prueba"),
        p(
          "El proyecto actualmente usa APIs en modo sandbox/prueba. Esto afecta directamente " +
          "la calidad de los datos mostrados:"
        ),
        bullet("API-Football (prueba): Las odds pueden ser ficticias, históricas o incompletas"),
        bullet("Stripe (test keys): Los pagos no se procesan realmente — usar tarjetas de prueba"),
        bullet("PayU (sandbox hardcodeado): Pagos en entorno de prueba de PayU"),
        bullet("Supabase: Verificar que el proyecto no sea el free tier con límites de operaciones"),
        p(
          "IMPORTANTE: Antes del lanzamiento, reemplazar TODAS las credenciales de prueba por " +
          "credenciales de producción reales. Los datos de odds en producción serán significativamente " +
          "diferentes y más precisos que los de prueba.",
          { bold: true, color: COLORS.red }
        ),

        divider(),

        // ── 7. CHECKLIST ─────────────────────────────────────────────────────
        h1("7. Checklist Pre-Lanzamiento"),

        h2("🔴 Crítico — Debe completarse antes del lanzamiento"),
        checkItem("Cambiar vercel.json: sync-odds de */10 a */30 (o limitar ligas)"),
        checkItem("Crear migración SQL para CREATE MATERIALIZED VIEW leaderboard"),
        checkItem("Mover credenciales PayU sandbox a variables de entorno (.env)"),
        checkItem("Desplegar Edge Function detect-value-bets en Supabase"),
        checkItem("Eliminar Plan Pro del pricing page (o marcar como 'Próximamente')"),
        checkItem("Decidir: ocultar pick tracker en v1 O implementarlo completamente"),

        new Paragraph({ spacing: { before: 120 } }),

        h2("🟡 Importante — Credenciales y configuración de producción"),
        checkItem("Configurar API-Football con clave de producción (verificar plan y límites)"),
        checkItem("Configurar NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de producción"),
        checkItem("Configurar STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET de producción"),
        checkItem("Configurar credenciales PayU de producción (merchant ID, API key, account ID)"),
        checkItem("Configurar NEXT_PUBLIC_SITE_URL con el dominio real"),
        checkItem("Configurar afiliados con IDs reales: BETPLAY_AFF, WPLAY_AFF, CODERE_AFF, etc."),
        checkItem("Verificar que pg_cron esté habilitado en el proyecto de Supabase"),
        checkItem("Registrar webhook de Stripe apuntando al dominio de producción"),
        checkItem("Registrar IPN de PayU apuntando al dominio de producción"),
        checkItem("Configurar CRON_SECRET con valor aleatorio seguro"),
        checkItem("Configurar NEWS_API_KEY para el blog automático"),

        new Paragraph({ spacing: { before: 120 } }),

        h2("🟢 Recomendado — Antes de lanzamiento público"),
        checkItem("Agregar datos demo al leaderboard (tipsters ficticios)"),
        checkItem("Agregar guard de null para OneSignal cuando APP_ID no esté configurado"),
        checkItem("Verificar que las 3 migraciones SQL aplican sin errores en Supabase"),
        checkItem("Probar flujo completo de pago Stripe en staging"),
        checkItem("Probar flujo completo de pago PayU sandbox end-to-end"),
        checkItem("Verificar que el cron de detección de value bets genera resultados reales"),
        checkItem("Probar que el blog auto-generado funciona con value bets reales"),
        checkItem("Revisar SEO: meta tags, sitemap.xml, robots.txt en dominio de producción"),
        checkItem("Configurar Google Analytics / PostHog con proyecto de producción"),

        new Paragraph({ spacing: { before: 120 } }),

        h2("🔵 Opcional — Post-lanzamiento (v1.1)"),
        checkItem("Implementar UI completa de registro de picks y cálculo de ROI"),
        checkItem("Implementar Plan Pro con flujo de compra real"),
        checkItem("Automatizar deploy de Edge Functions en pipeline CI/CD"),
        checkItem("Implementar alertas de cuota de API (notificar al 80% del límite)"),
        checkItem("Configurar OneSignal para notificaciones push de value bets"),
        checkItem("Agregar retry logic en cron jobs con errores de API"),
        checkItem("Implementar features del Plan Pro: API REST, Telegram bot, backtesting"),

        divider(),

        // ── 8. ESTIMACIÓN ─────────────────────────────────────────────────────
        h1("8. Estimación para Lanzamiento"),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                headerCell("Tarea"),
                headerCell("Esfuerzo estimado"),
                headerCell("Bloqueante"),
              ],
              tableHeader: true,
            }),
            new TableRow({
              children: [
                dataCell("Ajustar cron jobs (vercel.json)"),
                dataCell("30 minutos"),
                dataCell("Sí"),
              ],
            }),
            new TableRow({
              children: [
                dataCell("Migración leaderboard view"),
                dataCell("1-2 horas"),
                dataCell("Sí"),
              ],
            }),
            new TableRow({
              children: [
                dataCell("Mover credenciales PayU a .env"),
                dataCell("1 hora"),
                dataCell("Sí"),
              ],
            }),
            new TableRow({
              children: [
                dataCell("Deploy Edge Functions Supabase"),
                dataCell("30 minutos"),
                dataCell("Sí"),
              ],
            }),
            new TableRow({
              children: [
                dataCell("Remover Plan Pro del pricing"),
                dataCell("30 minutos"),
                dataCell("Sí"),
              ],
            }),
            new TableRow({
              children: [
                dataCell("Configurar credenciales producción"),
                dataCell("2-4 horas"),
                dataCell("Sí"),
              ],
            }),
            new TableRow({
              children: [
                dataCell("Testing end-to-end staging"),
                dataCell("4-8 horas"),
                dataCell("Sí"),
              ],
            }),
            new TableRow({
              children: [
                dataCell("Pick tracker UI completo (si se elige Opción B)"),
                dataCell("3-4 días"),
                dataCell("No"),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 200, after: 80 } }),
        p(
          "Con los ítems críticos resueltos, el lanzamiento puede lograrse en 2-3 días de trabajo. " +
          "Todos los cambios son puntuales — no requieren reescrituras de arquitectura.",
          { bold: true }
        ),

        divider(),

        new Paragraph({
          children: [
            new TextRun({ text: "Generado por Claude Code para ApuestaValue · Abril 2026", size: 18, color: COLORS.gray, italics: true }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
        }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync("ApuestaValue_Analisis_Prelanzamiento.docx", buffer);
console.log("✅ Documento generado: ApuestaValue_Analisis_Prelanzamiento.docx");
