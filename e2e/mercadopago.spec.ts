import { test, expect } from "@playwright/test";

/**
 * MercadoPago integration smoke tests.
 *
 * These tests verify the surface area of the checkout and webhook endpoints
 * without triggering real payments. Full payment flow requires MP sandbox credentials.
 *
 * Checkout:  GET /api/checkout-mp?plan=monthly|yearly
 * Webhook:   POST /api/webhooks/mp?topic=payment&id=<payment_id>
 */

// ---------------------------------------------------------------------------
// Checkout endpoint
// ---------------------------------------------------------------------------

test.describe("Checkout MP — GET /api/checkout-mp", () => {
  test("unauthenticated request redirects to /login", async ({ request }) => {
    const response = await request.get("/api/checkout-mp", {
      maxRedirects: 0,
    });
    // Must redirect (not error)
    expect([301, 302, 303, 307, 308], `Got ${response.status()}`).toContain(
      response.status(),
    );
    const location = response.headers()["location"] ?? "";
    expect(location, "Should redirect to /login").toContain("/login");
  });

  test("unauthenticated with ?plan=monthly still redirects to /login", async ({
    request,
  }) => {
    const response = await request.get("/api/checkout-mp?plan=monthly", {
      maxRedirects: 0,
    });
    expect([301, 302, 303, 307, 308]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/login");
  });

  test("unauthenticated with ?plan=yearly still redirects to /login", async ({
    request,
  }) => {
    const response = await request.get("/api/checkout-mp?plan=yearly", {
      maxRedirects: 0,
    });
    expect([301, 302, 303, 307, 308]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/login");
  });

  test("unauthenticated with invalid plan defaults to monthly (redirects to /login)", async ({
    request,
  }) => {
    // Invalid plan falls back to monthly — auth check still fires first
    const response = await request.get("/api/checkout-mp?plan=lifetime", {
      maxRedirects: 0,
    });
    expect([301, 302, 303, 307, 308]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/login");
  });

  test("POST returns 405 (endpoint is GET-only)", async ({ request }) => {
    const response = await request.post("/api/checkout-mp", { data: {} });
    expect(response.status()).toBe(405);
  });

  test("PUT returns 405", async ({ request }) => {
    const response = await request.put("/api/checkout-mp", { data: {} });
    expect(response.status()).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// Webhook IPN endpoint
// ---------------------------------------------------------------------------

test.describe("Webhook MP — POST /api/webhooks/mp", () => {
  test("POST without params returns 200 and { received: true }", async ({
    request,
  }) => {
    // No topic or id — webhook silently ignores and ACKs
    const response = await request.post("/api/webhooks/mp", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ received: true });
  });

  test("POST with topic=merchant_order is ignored (not a payment)", async ({
    request,
  }) => {
    const response = await request.post(
      "/api/webhooks/mp?topic=merchant_order&id=123456",
      {
        data: {},
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ received: true });
  });

  test("POST with topic=payment but no id is ignored", async ({ request }) => {
    const response = await request.post("/api/webhooks/mp?topic=payment", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ received: true });
  });

  test("POST with type=payment (IPN v2 format) but no id is ignored", async ({
    request,
  }) => {
    // MP IPN v2 sends 'type' instead of 'topic'
    const response = await request.post("/api/webhooks/mp?type=payment", {
      data: { action: "payment.created" },
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ received: true });
  });

  test("POST with topic=payment and data.id in query string returns 200", async ({
    request,
  }) => {
    // MP IPN v2 sends data.id in query string — endpoint handles gracefully
    // Will attempt MP API call and return 200 regardless (error is caught internally)
    const response = await request.post(
      "/api/webhooks/mp?topic=payment&data.id=99999999",
      {
        data: {},
        headers: { "Content-Type": "application/json" },
      },
    );
    // Endpoint always returns 200 to prevent MP retries — even on internal errors
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ received: true });
  });

  test("GET returns 405 (endpoint is POST-only)", async ({ request }) => {
    const response = await request.get("/api/webhooks/mp");
    expect(response.status()).toBe(405);
  });

  test("PUT returns 405", async ({ request }) => {
    const response = await request.put("/api/webhooks/mp", { data: {} });
    expect(response.status()).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// Cancel subscription endpoint
// ---------------------------------------------------------------------------

test.describe("Subscription cancel — POST /api/subscription/cancel", () => {
  test("unauthenticated request returns 401", async ({ request }) => {
    const response = await request.post("/api/subscription/cancel", {
      data: {},
    });
    expect([401, 403]).toContain(response.status());
  });

  test("GET returns 405 (endpoint is POST-only)", async ({ request }) => {
    const response = await request.get("/api/subscription/cancel");
    expect(response.status()).toBe(405);
  });
});
