"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, CheckCircle2, Unlink } from "lucide-react";

export function TelegramLinkClient({
  userId,
  botUsername,
  currentChatId,
}: {
  userId: string;
  botUsername: string;
  currentChatId: string | null;
}) {
  const [chatId, setChatId] = useState(currentChatId);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El usuario abre el bot con su user_id como start payload
  const botUrl = `https://t.me/${botUsername}?start=${userId}`;

  async function handleUnlink() {
    setUnlinking(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/unlink", { method: "POST" });
      if (!res.ok) throw new Error("Error al desvincular");
      setChatId(null);
    } catch {
      setError("No se pudo desvincular la cuenta de Telegram.");
    } finally {
      setUnlinking(false);
    }
  }

  if (chatId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>Cuenta de Telegram vinculada correctamente.</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Chat ID: <span className="font-mono">{chatId}</span>
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-red-400 hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400"
          onClick={handleUnlink}
          disabled={unlinking}
        >
          <Unlink className="h-4 w-4" />
          Desvincular
        </Button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Para recibir alertas en Telegram, sigue estos pasos:
      </p>
      <ol className="space-y-2 text-sm">
        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-400">
            1
          </span>
          <span>
            Haz clic en el botón de abajo para abrir el bot de Telegram.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-400">
            2
          </span>
          <span>
            Presiona <strong>Iniciar</strong> o <strong>Start</strong> en el bot.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-400">
            3
          </span>
          <span>
            El bot vinculará automáticamente tu cuenta de El Parley.
          </span>
        </li>
      </ol>
      <Button asChild variant="outline" size="sm" className="gap-2">
        <a href={botUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />
          Abrir bot en Telegram
        </a>
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
