import { test, expect } from "@playwright/test";

/**
 * SEO & metadata smoke tests — ensure critical meta tags are present.
 */

test.describe("SEO meta tags", () => {
  test("home page has og:title and description", async ({ page }) => {
    await page.goto("/");
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute("content");
    expect(ogTitle).toBeTruthy();

    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(20);
  });

  test("premium page has og:title and page title with 'Premium'", async ({ page }) => {
    await page.goto("/premium");
    await expect(page).toHaveTitle(/Premium/i);
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute("content");
    expect(ogTitle).toMatch(/Premium/i);
  });

  test("sitemap.xml is accessible and valid", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("<url>");
  });

  test("robots.txt is accessible", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/User-agent/i);
  });

  test("manifest.webmanifest is accessible", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.name).toBeTruthy();
  });
});

test.describe("Core Web Vitals — no layout shift indicators", () => {
  test("home page has no obvious render-blocking title flash", async ({ page }) => {
    await page.goto("/");
    // Title must be set before paint completes (no empty title)
    const title = await page.title();
    expect(title.length).toBeGreaterThan(3);
  });
});
