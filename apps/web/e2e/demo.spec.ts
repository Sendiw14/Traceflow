import { expect, test } from "@playwright/test";
import { findTrace, hydrated, requireStack } from "./helpers";

test.beforeAll(requireStack);

// The demo journey must work identically under local-dev and under the public-demo profile.
const TARGETS = [
  ["local-dev", process.env.E2E_URL_LOCAL_DEV ?? "http://127.0.0.1:3100"],
  ["public-demo", process.env.E2E_URL_PUBLIC_DEMO ?? "http://127.0.0.1:3101"],
] as const;

for (const [profile, base] of TARGETS) {
  test.describe(`demo under ${profile}`, () => {
    test.use({ baseURL: base });

    test("banner is persistent and the page has no private/admin links", async ({ page }) => {
      for (const path of ["/demo", "/demo?service=orders"]) {
        await page.goto(path);
        await expect(page.getByTestId("demo.banner")).toContainText("Synthetic data — read-only demo");
        const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!));
        for (const h of hrefs) expect(h, `link ${h} on ${path}`).not.toMatch(/^\/(app|login)(\/|$|\?)/);
        await expect(page.getByRole("link", { name: /settings|onboarding/i })).toHaveCount(0);
      }
    });

    test("service investigation, then trace → span deep link survives reload", async ({ page }) => {
      await findTrace("&status=error");
      await page.goto("/demo");
      await hydrated(page);
      await page.getByTestId("demo.services.table").getByRole("link", { name: "orders" }).click();
      await expect(page).toHaveURL(/service=orders/);
      await expect(page.getByTestId("demo.service")).toContainText("Investigating orders");
      await expect(page.getByTestId("demo.operations")).toBeVisible();
      await page.goto("/demo?status=error");
      await page.getByTestId("traces.list.row").first().getByRole("link").first().click();
      await expect(page).toHaveURL(/\/demo\/traces\/[0-9a-f]{32}/);
      await expect(page.getByTestId("demo.banner")).toBeVisible();
      await hydrated(page);
      await page.getByTestId("trace.next-error").click();
      await expect(page.getByTestId("trace.inspector").getByText("status: error")).toBeVisible();
      const url = page.url();
      expect(url).toMatch(/span=[0-9a-f]{16}/);
      await page.reload();
      await expect(page.getByRole("treeitem", { selected: true })).toHaveCount(1);
      await expect(page.getByTestId("trace.inspector.title")).toBeVisible();
    });

    test("invalid and unknown trace ids are handled without private data", async ({ page }) => {
      await page.goto("/demo/traces/not-a-trace");
      await expect(page.getByTestId("system.404")).toBeVisible();
      await page.goto("/demo/traces/0123456789abcdef0123456789abcdef");
      await expect(page.getByTestId("trace.not-found")).toBeVisible();
      await expect(page.getByTestId("demo.banner")).toBeVisible();
    });
  });
}

test("public-demo serves the public site and docs", async ({ request }) => {
  const b = process.env.E2E_URL_PUBLIC_DEMO ?? "http://127.0.0.1:3101";
  for (const p of ["/", "/docs", "/docs/security", "/demo"]) expect((await request.get(`${b}${p}`)).status(), p).toBe(200);
});
