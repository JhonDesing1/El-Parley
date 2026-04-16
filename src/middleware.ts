import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isKnownBadBot } from "@/lib/security/bot-detection";

// ─── Rate-limit rules for public/sensitive API routes ────────────────────────
// [path prefix, max requests, window in ms]
const RATE_LIMIT_RULES: Array<[string, number, number]> = [
  // Affiliate clicks: unauthenticated, writes to DB — tight limit
  ["/api/track/affiliate", 30, 60_000],
  // Checkout: authenticated but limit to prevent session-stuffing
  ["/api/checkout", 10, 60_000],
  ["/api/checkout-payu", 10, 60_000],
];

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  // 1. Block known malicious bots on all API routes
  if (isApiRoute) {
    const ua = request.headers.get("user-agent");
    if (isKnownBadBot(ua)) {
      return new NextResponse(null, { status: 403 });
    }
  }

  // 2. Per-IP rate limiting on configured routes
  if (isApiRoute) {
    const ip = getClientIp(request);
    for (const [prefix, limit, windowMs] of RATE_LIMIT_RULES) {
      if (pathname.startsWith(prefix)) {
        const result = checkRateLimit(`${ip}:${prefix}`, limit, windowMs);
        if (!result.allowed) {
          const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
          return new NextResponse(JSON.stringify({ error: "Too Many Requests" }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(limit),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(result.resetAt),
            },
          });
        }
        break; // Only apply the first matching rule
      }
    }
  }

  // 3. Supabase session refresh + protected-route redirect
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
