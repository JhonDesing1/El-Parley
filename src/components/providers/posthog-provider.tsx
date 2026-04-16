"use client";

import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// ─── Boot ─────────────────────────────────────────────────────

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";
  const [ph, setPh] = useState<typeof import("posthog-js").default | null>(null);

  useEffect(() => {
    if (!key) return;
    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: false,
        loaded: (p) => {
          if (process.env.NODE_ENV === "development") p.debug(false);
        },
      });
      setPh(posthog);
    });
  }, [key, host]);

  if (!key || !ph) return <>{children}</>;

  return <PHProvider client={ph}>{children}</PHProvider>;
}

// ─── Pageview tracker ─────────────────────────────────────────

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();
  const last = useRef<string>("");

  useEffect(() => {
    const url =
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    if (url === last.current) return;
    last.current = url;
    ph?.capture("$pageview", { $current_url: window.location.href });
  }, [pathname, searchParams, ph]);

  return null;
}
