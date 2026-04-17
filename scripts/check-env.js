#!/usr/bin/env node
/**
 * Valida que las variables de entorno críticas estén presentes antes del build.
 * Se ejecuta como `prebuild` en package.json.
 *
 * En modo dev (NODE_ENV !== 'production') solo advierte; en producción falla el build.
 */

const isProd = process.env.NODE_ENV === "production";

// ─── Vars obligatorias en CUALQUIER entorno ────────────────────────────────
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
];

// ─── Vars obligatorias solo en producción ─────────────────────────────────
const REQUIRED_PROD = [
  // Cron auth
  "CRON_SECRET",
  // Al menos un proveedor de pago debe estar configurado
  // (se valida por grupo más abajo)
  // APIs externas
  "API_FOOTBALL_KEY",
];

// ─── Grupos: al menos 1 de cada grupo debe estar presente en prod ─────────
// Stripe y PayU deshabilitados — se usa MercadoPago
const PAYMENT_PROVIDERS = [
  ["MERCADOPAGO_ACCESS_TOKEN"],
];

// ─── Vars opcionales (solo advertencia) ───────────────────────────────────
const OPTIONAL = [
  "ODDS_API_KEY",
  "NEWS_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",
  "NEXT_PUBLIC_ONESIGNAL_APP_ID",
  "ONESIGNAL_REST_API_KEY",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_BETPLAY_AFF",
  "NEXT_PUBLIC_WPLAY_AFF",
  "NEXT_PUBLIC_CODERE_AFF",
  "NEXT_PUBLIC_RIVALO_AFF",
  "NEXT_PUBLIC_1XBET_AFF",
  "PAYU_RESPONSE_URL",
  "PAYU_NOTIFICATION_URL",
];

const missing = [];
const warnings = [];

// Verificar requeridas siempre
for (const key of REQUIRED) {
  if (!process.env[key]) missing.push(key);
}

// Verificar requeridas en producción
if (isProd) {
  for (const key of REQUIRED_PROD) {
    if (!process.env[key]) missing.push(key);
  }

  // Al menos 1 proveedor de pago completo debe estar configurado
  const hasPaymentProvider = PAYMENT_PROVIDERS.some((group) =>
    group.every((key) => process.env[key])
  );
  if (!hasPaymentProvider) {
    missing.push(
      "(ningún proveedor de pago completo: Stripe, PayU o MercadoPago)"
    );
  }

  // CRON_SECRET debe tener al menos 32 caracteres
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && cronSecret.length < 32) {
    missing.push("CRON_SECRET (debe tener al menos 32 caracteres)");
  }
}

// Verificar opcionales
for (const key of OPTIONAL) {
  if (!process.env[key]) warnings.push(key);
}

// ─── Salida ───────────────────────────────────────────────────────────────
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

console.log(bold("\n🔍 Verificando variables de entorno...\n"));

if (missing.length > 0) {
  console.error(red(bold("✖ Variables FALTANTES (el build fallará en producción):")));
  for (const key of missing) {
    console.error(red(`  • ${key}`));
  }
}

if (warnings.length > 0) {
  console.warn(yellow(`\n⚠  Variables opcionales no configuradas (${warnings.length}):`));
  for (const key of warnings) {
    console.warn(yellow(`  • ${key}`));
  }
}

if (missing.length === 0) {
  console.log(green("✔ Todas las variables obligatorias están presentes.\n"));
} else {
  console.log();
}

if (isProd && missing.length > 0) {
  console.error(red(bold("Build cancelado. Configura las variables faltantes en Vercel.\n")));
  process.exit(1);
}
