import { expect, test } from "@playwright/test";
import { expectNoStore, requireStack } from "./helpers";

test.beforeAll(requireStack);

test("home links to the app, which renders the overview", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "TRACEFLOW" })).toBeVisible();
  await page.getByRole("link", { name: "Open the application shell" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
});

const ROUTES = ["/app", "/app/traces", "/app/services", "/app/map", "/app/analytics", "/app/onboarding", "/app/settings"];

test("every app route is served private, no-store", async ({ page }) => {
  for (const r of ROUTES) await expectNoStore(page, r);
});

test("nav lists only routes that exist and marks the current one", async ({ page, request }) => {
  await page.goto("/app/services");
  const nav = page.getByRole("navigation", { name: "Primary" });
  const hrefs = await nav.getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!).filter((h) => h.startsWith("/app")));
  expect(hrefs.sort()).toEqual([...ROUTES].sort());
  for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);
  await expect(nav.getByRole("link", { name: "Services" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current", "page");
});

test("invalid trace id shows the 404 view without calling the API", async ({ page }) => {
  const seen: string[] = [];
  page.on("request", (r) => seen.push(r.url()));
  await page.goto("/app/traces/not-a-trace-id");
  await expect(page.getByTestId("system.404")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  expect(seen.some((u) => u.includes("/v1/"))).toBe(false); // BFF-only; nothing to observe browser-side, kept as a guard
});
