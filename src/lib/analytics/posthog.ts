/**
 * PostHog server-side client (Node SDK).
 * Usar solo en Server Components, API routes y Server Actions.
 * No importar en código "use client".
 */
import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!_client) {
    _client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

/** Captura un evento server-side (crons, webhooks, server actions). */
export function captureServer(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const ph = getPostHogServer();
  if (!ph) return;
  ph.capture({ distinctId, event, properties });
  // flush inmediato para serverless (Vercel)
  void ph.flush();
}
