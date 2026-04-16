import { test, expect } from "@playwright/test";

/**
 * Auth flows — login, register, and route protection.
 */

test.describe("Login page", () => {
  test("renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Bienvenido de vuelta")).toBeVisible();
    await expect(page.locator("text=Continuar con Google")).toBeVisible();
    await expect(
      page.locator("input[type='email']"),
    ).toBeVisible();
    await expect(
      page.locator("button", { hasText: "Enviar link mágico" }),
    ).toBeVisible();
  });

  test("link to register page works", async ({ page }) => {
    await page.goto("/login");
    await page.click("text=Regístrate gratis");
    await expect(page).toHaveURL(/\/register/);
  });

  test("magic link form — submit triggers loading state then shows result", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "test-e2e@example.com");

    const submitBtn = page.locator("button[type='submit']");
    await submitBtn.click();

    // Loading state must appear
    await expect(submitBtn).toBeDisabled({ timeout: 3_000 });

    // After Supabase responds, one of these states must be visible
    // (success card OR inline error message)
    const successCard = page.locator("text=Revisa tu correo");
    const errorMsg = page.locator(".text-destructive");

    await expect(successCard.or(errorMsg)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Register page", () => {
  test("renders correctly", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("text=Crea tu cuenta gratis")).toBeVisible();
    await expect(page.locator("text=Registrarse con Google")).toBeVisible();
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(
      page.locator("button", { hasText: "Crear cuenta gratis" }),
    ).toBeVisible();
  });

  test("link to login page works", async ({ page }) => {
    await page.goto("/register");
    await page.click("text=Entra aquí");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Route protection — unauthenticated redirects", () => {
  // These match the paths in src/lib/supabase/middleware.ts
  const protectedRoutes = [
    "/dashboard",
    "/parlays/builder",
    "/premium/content",
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      // Middleware redirects to /login?next=<route>
      await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
    });
  }

  test("redirect preserves intended destination in ?next param", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("next=");
  });
});
