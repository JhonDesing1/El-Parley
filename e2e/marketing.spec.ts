import { test, expect } from "@playwright/test";

/**
 * Public marketing pages — no auth required.
 */

test.describe("Home page", () => {
  test("loads and shows hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/El Parley/i);
    // Hero always contains the main headline
    await expect(page.locator("text=matemáticas").first()).toBeVisible();
  });

  test("shows 'Próximos Partidos' section", async ({ page }) => {
    await page.goto("/");
    // Section shows either the matches grid header or the empty state card
    const matchHeader = page.locator("text=Hoy y mañana");
    const emptyState = page.locator("text=Sin partidos cargados");
    await expect(matchHeader.or(emptyState).first()).toBeVisible({ timeout: 15_000 });
  });

  test("feature cards render", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Value Bets matemáticas")).toBeVisible();
    await expect(page.locator("text=Comparador multi-casa")).toBeVisible();
    await expect(page.locator("text=Parlays de alta probabilidad")).toBeVisible();
  });

  test("navbar links are present", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav").first();
    await expect(nav).toBeVisible();
  });
});

test.describe("Premium page", () => {
  test("renders all three plan cards", async ({ page }) => {
    await page.goto("/premium");
    await expect(page).toHaveTitle(/Premium/i);
    // Use heading role to avoid strict mode violation with "Free" appearing multiple times
    await expect(page.locator("h3", { hasText: "Free" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "Premium" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "Pro" })).toBeVisible();
  });

  test("premium plan shows Mercado Pago subscribe button", async ({ page }) => {
    await page.goto("/premium");
    await expect(page.locator("text=Suscribirse")).toBeVisible();
  });

  test("pro plan shows 'Próximamente' disabled button", async ({ page }) => {
    await page.goto("/premium");
    const proBtn = page.locator("button", { hasText: "Próximamente" });
    await expect(proBtn).toBeVisible();
    await expect(proBtn).toBeDisabled();
  });

  test("shows declined payment alert when ?payment=declined", async ({ page }) => {
    await page.goto("/premium?payment=declined");
    await expect(page.locator("text=El pago fue rechazado")).toBeVisible();
  });

  test("shows error alert when ?payment=error", async ({ page }) => {
    await page.goto("/premium?payment=error");
    await expect(
      page.locator("text=Ocurrió un error procesando el pago"),
    ).toBeVisible();
  });
});

test.describe("Legal / blog pages", () => {
  test("legal pages resolve without 500", async ({ page }) => {
    const legalPaths = ["/legal/terminos", "/legal/privacidad", "/legal/cookies"];
    for (const path of legalPaths) {
      const response = await page.goto(path);
      // Accept 200 or 404 (not yet built) but NOT 500
      expect(response?.status(), `${path} returned 500`).not.toBe(500);
    }
  });

  test("leaderboard page resolves without 500", async ({ page }) => {
    const response = await page.goto("/leaderboard");
    expect(response?.status()).not.toBe(500);
  });

  test("blog index resolves without 500", async ({ page }) => {
    const response = await page.goto("/blog");
    expect(response?.status()).not.toBe(500);
  });
});
