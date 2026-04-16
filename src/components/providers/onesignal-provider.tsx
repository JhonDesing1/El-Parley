"use client";

import { useEffect, useRef } from "react";

/**
 * Inicializa OneSignal Web SDK.
 * Solo carga si NEXT_PUBLIC_ONESIGNAL_APP_ID está configurado.
 * OneSignal muestra el prompt nativo del browser — no necesitamos
 * UI adicional a menos que el usuario quiera personalizar cuándo mostrar.
 */
function OneSignalInit() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!;

    // Carga dinámica para no bloquear el bundle principal
    import("react-onesignal").then(({ default: OneSignal }) => {
      OneSignal.init({
        appId,
        allowLocalhostAsSecureOrigin: process.env.NODE_ENV === "development",
        notifyButton: { enable: false, prenotify: false, showCredit: false, text: {} as any }, // usamos nuestro propio botón de opt-in
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: "push",
                autoPrompt: false, // no mostrar automáticamente — respetamos UX
                text: {
                  actionMessage:
                    "Recibe alertas instantáneas de value bets de alta confianza.",
                  acceptButton: "Activar alertas",
                  cancelButton: "No, gracias",
                },
                delay: {
                  pageViews: 3,  // mostrar solo después de 3 páginas vistas
                  timeDelay: 30, // y 30 segundos en la página
                },
              },
            ],
          },
        },
      }).catch(() => {
        // Silencio si OneSignal falla — no rompemos la app
      });
    }).catch(() => {});
  }, []);

  return null;
}

export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) return <>{children}</>;

  return (
    <>
      <OneSignalInit />
      {children}
    </>
  );
}
