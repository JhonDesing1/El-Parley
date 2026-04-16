import { test, expect } from "@playwright/test";

/**
 * API endpoint smoke tests — verify endpoints respond with expected status codes
 * without triggering actual side-effects where possible.
 */

const CRON_SECRET = process.env.CRON_SECRET ?? "";

test.describe("Cron endpoints — authorization", () => {
  const cronRoutes = [
    "/api/cron/sync-fixtures",
    "/api/cron/sync-live-odds",
    "/api/cron/detect-value-bets",
    "/api/cron/sync-results",
    "/api/cron/expire-subscriptions",
    "/api/cron/cleanup-odds",
    "/api/cron/refresh-leaderboard",
  ];

  for (const route of cronRoutes) {
    test(`${route} returns 401 without secret`, async ({ request }) => {
      const response = await request.get(route);
      expect(
        response.status(),
        `${route} should be protected`,
      ).toBe(401);
    });
  }

  if (CRON_SECRET) {
    for (const route of cronRoutes) {
      test(`${route} returns 200 with valid secret`, async ({ request }) => {
        const response = await request.get(route, {
          headers: { Authorization: `Bearer ${CRON_SECRET}` },
        });
        // Accept 200 (ok) or 202 (accepted/no-op when no data)
        expect([200, 202], `${route} returned ${response.status()}`).toContain(
          response.status(),
        );
      });
    }
  }
});

test.describe("Affiliate tracking endpoint", () => {
  test("GET without params returns 400 (invalid bookmaker)", async ({ request }) => {
    // Route only accepts GET with ?book= query param
    const response = await request.get("/api/track/affiliate");
    expect(response.status()).toBe(400);
  });

  test("GET with invalid book returns 400", async ({ request }) => {
    const response = await request.get("/api/track/affiliate?book=fakebook");
    expect(response.status()).toBe(400);
  });

  test("GET with valid book redirects to bookmaker (302)", async ({ request }) => {
    // Valid bookmaker slug — the route redirects to affiliate URL
    const response = await request.get("/api/track/affiliate?book=betplay", {
      maxRedirects: 0,
    });
    expect([301, 302, 307, 308]).toContain(response.status());
  });

  test("POST returns 405 (route is GET-only)", async ({ request }) => {
    const response = await request.post("/api/track/affiliate", {
      data: {},
    });
    expect(response.status()).toBe(405);
  });
});

test.describe("Stripe webhook endpoint", () => {
  test("POST without signature returns 400", async ({ request }) => {
    const response = await request.post("/api/webhooks/stripe", {
      data: { type: "checkout.session.completed" },
      headers: { "content-type": "application/json" },
    });
    // Without a valid Stripe-Signature header, the webhook should reject the request
    expect([400, 401]).toContain(response.status());
  });
});

test.describe("PayU webhook endpoint", () => {
  test("POST with empty form data always returns 200 (PayU retry prevention)", async ({
    request,
  }) => {
    // PayU sends application/x-www-form-urlencoded — must use form encoding.
    // The route always returns 200 even for invalid signature to prevent retries.
    const response = await request.post("/api/webhooks/payu", {
      form: { sign: "invalid", reference_sale: "test", value: "0", currency: "COP", state_pol: "4" },
    });
    expect(response.status()).toBe(200);
  });
});

test.describe("Notifications endpoint", () => {
  test("GET /api/notifications returns 401 for unauthenticated request", async ({
    request,
  }) => {
    const response = await request.get("/api/notifications");
    expect([401, 403, 404]).toContain(response.status());
  });
});
