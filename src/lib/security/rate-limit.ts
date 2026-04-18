/**
 * Hybrid rate limiter — distributed (Upstash Redis) when credentials are
 * configured, in-memory sliding window as a local/dev fallback.
 *
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel to
 * enable distributed limiting across all edge replicas.
 *
 * Usage (async):
 *   const result = await rateLimit(`${ip}:${prefix}`, limit, windowMs);
 *   if (!result.allowed) return 429;
 */

// ─── Shared result type ───────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in current window. */
  remaining: number;
  /** Unix timestamp (ms) when the window resets. */
  resetAt: number;
}

// ─── In-memory fallback (Edge-safe, no external deps) ────────────────────────

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();
let cleanupTick = 0;

function maybeCleanup(now: number): void {
  if (++cleanupTick < 500) return;
  cleanupTick = 0;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

function checkRateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  maybeCleanup(now);

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ─── Upstash Redis distributed limiter ───────────────────────────────────────

// Lazy-import to avoid crashing when Upstash env vars are absent.
// Instances are cached per (limit, windowMs) pair so we don't rebuild them
// on every request.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const upstashCache = new Map<string, any>();

async function checkRateLimitUpstash(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const cacheKey = `${limit}:${windowMs}`;

  if (!upstashCache.has(cacheKey)) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    const windowSec = Math.ceil(windowMs / 1000);
    upstashCache.set(
      cacheKey,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
        prefix: "elparley:rl",
      }),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const limiter = upstashCache.get(cacheKey) as any;
  const { success, remaining, reset } = await limiter.limit(key);

  return {
    allowed: success,
    remaining,
    resetAt: reset,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** True when Upstash credentials are present in the environment. */
function isUpstashConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/**
 * Check and record a request against the rate limit.
 * Uses Upstash Redis in production (when env vars are set) and falls back
 * to in-memory for local development.
 *
 * @param key       Identifier — typically `"ip:route"` or just an IP.
 * @param limit     Maximum requests allowed per window.
 * @param windowMs  Window duration in milliseconds.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (isUpstashConfigured()) {
    return checkRateLimitUpstash(key, limit, windowMs);
  }
  return checkRateLimitInMemory(key, limit, windowMs);
}

/**
 * @deprecated Use the async `rateLimit()` instead.
 * Kept for backwards compatibility — synchronous in-memory only.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  return checkRateLimitInMemory(key, limit, windowMs);
}
