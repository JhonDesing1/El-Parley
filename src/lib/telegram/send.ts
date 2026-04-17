/**
 * Helper para enviar mensajes de Telegram a usuarios Pro vinculados.
 *
 * Reglas:
 *  - Quiet hours: 10 pm – 7 am hora Colombia (UTC-5, sin DST)
 *  - Cada tipo de alerta respeta la preferencia individual del usuario
 *  - Los errores de Telegram nunca propagan — no bloquean el cron
 */

import { createAdminClient } from "@/lib/supabase/server";

export type AlertType = "value_bets" | "results" | "parlays";

const PREF_COL: Record<AlertType, "tg_value_bets" | "tg_results" | "tg_parlays"> = {
  value_bets: "tg_value_bets",
  results: "tg_results",
  parlays: "tg_parlays",
};

/** Devuelve true si la hora actual (Colombia, UTC-5) está en el rango 22:00-06:59. */
function isQuietHours(): boolean {
  const colombiaHour = (new Date().getUTCHours() - 5 + 24) % 24;
  return colombiaHour >= 22 || colombiaHour < 7;
}

/** Envía un mensaje de texto a un chat_id. Silencia errores. */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch {
    // No propagamos errores para no bloquear el cron
  }
}

/**
 * Notifica a todos los usuarios Pro con telegram_chat_id vinculado
 * que tengan habilitado el tipo de alerta dado.
 *
 * Respeta quiet hours (10 pm – 7 am Colombia).
 */
export async function notifyProUsers(
  text: string,
  alertType: AlertType,
): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  if (isQuietHours()) return;

  const supabase = createAdminClient();
  const prefCol = PREF_COL[alertType];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, telegram_chat_id")
    .not("telegram_chat_id", "is", null)
    .eq(prefCol, true);

  if (!profiles?.length) return;

  // Solo usuarios Pro activos
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("tier", "pro")
    .in("status", ["active", "trialing"])
    .in(
      "user_id",
      profiles.map((p) => p.id),
    );

  if (!subs?.length) return;

  const proIds = new Set(subs.map((s) => s.user_id));
  const recipients = profiles.filter(
    (p) => p.telegram_chat_id && proIds.has(p.id),
  );

  await Promise.allSettled(
    recipients.map((p) => sendTelegramMessage(p.telegram_chat_id!, text)),
  );
}
