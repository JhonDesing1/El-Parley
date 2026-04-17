import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/utils/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send } from "lucide-react";
import { TelegramLinkClient } from "./telegram-link-client";
import { TelegramPrefsClient } from "./telegram-prefs-client";

export const metadata = { title: "Bot Telegram — El Parley Pro" };

export default async function TelegramPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/telegram");

  const pro = await isProUser();
  if (!pro) redirect("/premium");

  const { data: profile } = await supabase
    .from("profiles")
    .select("telegram_chat_id, tg_value_bets, tg_results, tg_parlays")
    .eq("id", user.id)
    .single();

  const chatId = profile?.telegram_chat_id ?? null;
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "ElParleyBot";

  const prefs = {
    value_bets: profile?.tg_value_bets ?? true,
    results: profile?.tg_results ?? true,
    parlays: profile?.tg_parlays ?? true,
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Send className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Bot de Telegram</h1>
          <p className="text-sm text-muted-foreground">
            Recibe alertas de value bets directamente en Telegram
          </p>
        </div>
        <Badge className="ml-auto border-amber-500/50 bg-amber-500/10 text-amber-400">PRO</Badge>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">
            {chatId ? "Cuenta vinculada" : "Vincular cuenta"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TelegramLinkClient
            userId={user.id}
            botUsername={botUsername}
            currentChatId={chatId}
          />
        </CardContent>
      </Card>

      {chatId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurar alertas</CardTitle>
          </CardHeader>
          <CardContent>
            <TelegramPrefsClient initial={prefs} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
