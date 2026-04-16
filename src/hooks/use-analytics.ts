"use client";

/**
 * Hook wrapper de PostHog para eventos de negocio.
 * Uso:
 *   const { track } = useAnalytics();
 *   track("value_bet_clicked", { edge: 0.07, market: "1x2" });
 */
import { usePostHog } from "posthog-js/react";

export type AnalyticsEvent =
  | "value_bet_clicked"
  | "parlay_viewed"
  | "parlay_saved"
  | "affiliate_link_clicked"
  | "premium_upgrade_started"
  | "premium_upgrade_completed"
  | "match_detail_viewed"
  | "blog_post_viewed"
  | "register_completed"
  | "login_completed"
  | "builder_leg_added"
  | "builder_leg_removed";

export function useAnalytics() {
  const ph = usePostHog();

  function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
    ph?.capture(event, properties);
  }

  function identify(userId: string, traits?: Record<string, unknown>) {
    ph?.identify(userId, traits);
  }

  function reset() {
    ph?.reset();
  }

  return { track, identify, reset };
}
