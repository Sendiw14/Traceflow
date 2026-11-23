import { expect, test } from "@playwright/test";
import { findTrace, requireStack } from "./helpers";

test.beforeAll(requireStack);
test.use({ viewport: { width: 375, height: 812 } });

// Page-level horizontal scroll is a WCAG 1.4.10 (reflow) failure; wide tables/waterfall must scroll inside their own container.
for (const path of ["/app", "/app/traces", "/app/services", "/app/services/orders", "/app/map", "/app/analytics", "/app/onboarding", "/app/settings"]) {
  test(`375 px: no page-level horizontal scroll on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, "horizontal overflow in px").toBeLessThanOrEqual(0);
  });
}

test("375 px: trace detail and the map graph toggle", async ({ page }) => {
  const t = await findTrace("&status=error");
  await page.goto(`/app/traces/${t.trace_id}`);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.goto("/app/map");
  await expect(page.getByTestId("map.graph-wrap")).toBeHidden(); // graph is behind a button below 768 px
  await page.getByRole("button", { name: "Show graph" }).click();
  await expect(page.getByTestId("map.graph-wrap")).toBeVisible();
  await expect(page.getByTestId("map.edge-table")).toBeVisible(); // table alternative is always present
});
