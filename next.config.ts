import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000, // 30 días — logos y escudos rara vez cambian
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "crests.football-data.org" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
  async headers() {
    // Content-Security-Policy — whitelists known third-party origins.
    // `unsafe-inline` for scripts is required by Next.js App Router hydration
    // (inline JSON blobs). A nonce-based CSP would remove this need but requires
    // middleware integration; see Next.js docs on CSP + nonces for a future upgrade.
    const csp = [
      "default-src 'self'",
      // Next.js inline scripts + OneSignal
      "script-src 'self' 'unsafe-inline' https://cdn.onesignal.com https://onesignal.com",
      // Tailwind injects inline styles at runtime
      "style-src 'self' 'unsafe-inline'",
      // Image CDNs already listed in remotePatterns + data URIs for placeholders
      "img-src 'self' data: blob: https://media.api-sports.io https://crests.football-data.org https://*.supabase.co https://flagcdn.com https://onesignal.com",
      // Web fonts
      "font-src 'self' data:",
      // XHR / fetch / WebSocket destinations
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://app.posthog.com https://us.i.posthog.com https://eu.i.posthog.com https://onesignal.com https://api.onesignal.com",
      // No Flash / Java plugins
      "object-src 'none'",
      // Prevent <base> tag hijacking
      "base-uri 'self'",
      // Restrict where forms can POST
      "form-action 'self'",
      // Block all framing of our pages (redundant with X-Frame-Options but belt+suspenders)
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        // Páginas HTML — nunca cachear en CDN (Cloudflare, etc.)
        // Los assets estáticos de Next.js tienen content-hash propio y se cachean por separado
        source: "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      {
        // Assets estáticos con content-hash: se pueden cachear agresivamente
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
