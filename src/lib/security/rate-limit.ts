/**
 * In-memory sliding window rate limiter.
 *
 * Runs in the Edge Runtime (Next.js middleware) — uses only plain JS, no Node APIs.
 * The Map lives for the lifetime of the edge worker process, which Vercel keeps warm
 * between requests, making this effective against sustained abuse.
 *
 * Limitation: not shared across multiple edge instances. For strict distributed
 * rate limiting, replace with Upstash Redis + @upstash/ratelimit.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();
let cleanupTick = 0;

/** Periodically evict expired entries to prevent unbounded memory growth. */
function maybeCleanup(now: number): void {
  if (++cleanupTick < 500) return;
  cleanupTick = 0;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in current window. */
  remaining: number;
  /** Unix timestamp (ms) when the window resets. */
  resetAt: number;
}

/**
 * Check and record a request against the rate limit.
 *
 * @param key       Identifier — typically `"ip:route"` or just an IP.
 * @param limit     Maximum requests allowed per window.
 * @param windowMs  Window duration in milliseconds.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  maybeCleanup(now);

  const entry = store.get(key);

  // New or expired window
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  // Window active — over limit
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Window active — within limit
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
