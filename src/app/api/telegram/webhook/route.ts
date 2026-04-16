import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/telegram/webhook
 *
 * Webhook que Telegram llama cuando un usuario envía un mensaje al bot.
 * Registra el chat_id del usuario en su perfil para poder enviarle alertas.
 *
 * Flow:
 *   1. Usuario abre el bot con ?start=<user_id>
 *   2. Telegram envía un update de tipo /start con payload=<user_id>
 *   3. Este endpoint vincula el chat_id al user_id
 *
 * Para registrar el webhook con Telegram:
 *   POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
 *   { "url": "https://tu-dominio.com/api/telegram/webhook" }
 */
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const message = update.message;
  if (!message?.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  // Comando /start con payload de user_id
  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    const userId = parts[1]?.trim();

    if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) {
      await sendTelegramMessage(botToken, chatId,
        "Hola! Para vincular tu cuenta, ve a El Parley → Dashboard → Bot Telegram y haz clic en el enlace.");
      return NextResponse.json({ ok: true });
    }

    const supabase = createAdminClient();

    // Verificar que el usuario tiene Pro
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("tier, status")
      .eq("user_id", userId)
      .eq("tier", "pro")
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (!subscription) {
      await sendTelegramMessage(botToken, chatId,
        "Tu cuenta no tiene una suscripción Pro activa. Actualiza en elparley.com/premium");
      return NextResponse.json({ ok: true });
    }

    await supabase
      .from("profiles")
      .update({ telegram_chat_id: chatId })
      .eq("id", userId);

    await sendTelegramMessage(botToken, chatId,
      "Tu cuenta de El Parley está vinculada. Recibirás alertas de value bets aquí.");
  }

  return NextResponse.json({ ok: true });
}

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
  };
}
