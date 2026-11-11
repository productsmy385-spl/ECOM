import { expect, test, type Page } from "@playwright/test";

const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3301";
/** A demo product with no required options, so it can go straight into the bag. */
const SIMPLE_PRODUCT = process.env.E2E_PRODUCT_SLUG ?? "classic-wooden-photo-frame";

/** Fails the test on CSP violations, uncaught errors and horizontal page overflow. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to (load|connect|execute|frame)/i.test(m.text())) problems.push(`CSP: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return {
    async assertClean() {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(1);
      expect(problems).toEqual([]);
    },
  };
}

test("home page shows the brand, products and sends security headers", async ({ page }) => {
  const w = watch(page);
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  const h = res!.headers();
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  await expect(page).toHaveTitle(/Adira/i);
  await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
  // Not "networkidle": on real domains Clerk keeps polling, so the network never goes idle.
  await page.waitForLoadState("load");
  await page.waitForTimeout(2_000);
  await w.assertClean();
});

test("shop lists products and opens a product page", async ({ page }) => {
  const w = watch(page);
  await page.goto("/shop");
  const first = page.locator('a[href^="/products/"]').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/products\//);
  await expect(page.locator("h1")).toBeVisible();
  await w.assertClean();
});

test("a guest can add a frame to the bag and see it in the cart", async ({ page }) => {
  const w = watch(page);
  const res = await page.goto(`/products/${SIMPLE_PRODUCT}`);
  test.skip(res?.status() === 404, `demo product ${SIMPLE_PRODUCT} not present`);
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to your bag" })).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Your bag" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Items" })).toContainText(/frame/i);
  await expect(page.getByRole("complementary", { name: "Order summary" })).toContainText("₹");
  await w.assertClean();
});

test("search overlay finds products", async ({ page, isMobile }) => {
  test.skip(isMobile, "the overlay trigger sits in the desktop header");
  await page.goto("/");
  await page.getByRole("button", { name: "Search" }).first().click();
  const box = page.getByRole("dialog", { name: "Search the store" }).locator("input").first();
  await box.fill("frame");
  await box.press("Enter");
  await expect(page).toHaveURL(/q=frame/);
  await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
});

test("sign-in page loads Clerk without CSP violations", async ({ page }) => {
  const w = watch(page);
  await page.goto("/login");
  await expect(page.locator(".cl-rootBox, .cl-signIn-root, [data-clerk-component]").first()).toBeVisible({ timeout: 30_000 });
  await w.assertClean();
});

test("unknown pages return 404", async ({ page }) => {
  const res = await page.goto("/products/this-frame-does-not-exist");
  expect(res?.status()).toBe(404);
});

test.describe("admin", () => {
  test("signed-out visitors are sent to the admin sign-in, which loads cleanly", async ({ page }) => {
    const w = watch(page);
    const res = await page.goto(`${ADMIN}/admin/reports`);
    expect(res?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator(".cl-rootBox, .cl-signIn-root, [data-clerk-component]").first()).toBeVisible({ timeout: 30_000 });
    await w.assertClean();
  });

  test("admin APIs refuse signed-out requests", async ({ request }) => {
    const res = await request.get(`${ADMIN}/admin/api/reports/sales?format=csv`);
    expect(res.status()).toBe(401);
  });
});
