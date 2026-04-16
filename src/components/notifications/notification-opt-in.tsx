"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Banner de opt-in para push notifications.
 * Se muestra una vez al usuario autenticado después de 10 segundos.
 * Solo si el browser soporta notificaciones y no ha dado respuesta aún.
 */
export function NotificationOptIn({ userId }: { userId: string }) {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    const dismissed = sessionStorage.getItem("notif_dismissed");
    if (dismissed) return;

    const timer = setTimeout(() => setShow(true), 10_000);
    return () => clearTimeout(timer);
  }, []);

  async function handleAllow() {
    setStatus("loading");
    try {
      const { default: OneSignal } = await import("react-onesignal");
      await OneSignal.Slidedown.promptPush();
      const perm = await OneSignal.Notifications.requestPermission();
      if (perm) {
        const playerId = await OneSignal.User.PushSubscription.id;
        if (playerId && userId) {
          // Guardar player_id en Supabase para enviar notificaciones dirigidas
          await fetch("/api/notifications/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ player_id: playerId }),
          });
        }
        setStatus("granted");
        setTimeout(() => setShow(false), 2000);
      } else {
        setStatus("denied");
      }
    } catch {
      setStatus("denied");
    }
  }

  function dismiss() {
    sessionStorage.setItem("notif_dismissed", "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-sm sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-xs">
      <Card className="border-primary/30 bg-card/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Alertas de value bets</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recibe notificaciones en tiempo real cuando detectamos un edge &gt;5%.
            </p>
          </div>
          <button onClick={dismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          {status === "granted" ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-value/10 py-2 text-xs font-bold text-value">
              <Bell className="h-3.5 w-3.5" />
              ¡Alertas activadas!
            </div>
          ) : (
            <>
              <Button
                size="sm"
                className="flex-1 text-xs"
                onClick={handleAllow}
                disabled={status === "loading"}
              >
                {status === "loading" ? "Activando…" : "Activar alertas"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 text-xs"
                onClick={dismiss}
              >
                <BellOff className="mr-1 h-3.5 w-3.5" />
                No, gracias
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
