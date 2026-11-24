import { expect, test } from "@playwright/test";

const LOCAL = process.env.E2E_URL_LOCAL_DEV ?? "http://127.0.0.1:3100";
const OPERATOR = process.env.E2E_URL_OPERATOR_PROD ?? "http://127.0.0.1:3102";
const GITHUB = "https://github.com/Sendiw14/Traceflow";

test.describe("landing", () => {
  test.use({ baseURL: LOCAL });

  test("both CTAs are real links and the structure is complete", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home.cta-demo")).toHaveAttribute("href", "/demo");
    await expect(page.getByTestId("home.cta-github")).toHaveAttribute("href", GITHUB);
    for (const id of ["hero", "journey-section", "features", "walkthrough", "architecture", "getting-started", "oss", "faq", "final-cta"]) await expect(page.getByTestId(`home.${id}`)).toBeVisible();
    await expect(page.getByTestId("footer")).toBeVisible();
  });

  test("no invented claims: no metrics, users, logos or production-ready assertion", async ({ page }) => {
    await page.goto("/");
    const text = (await page.locator("body").innerText()).toLowerCase();
    for (const bad of ["trusted by", "customers", "uptime", "sla", "% faster", "millions", "enterprise-grade", "battle-tested", "blazing"]) expect(text, bad).not.toContain(bad);
    // "production-ready" may appear only as the FAQ question, answered "No".
    const faq = page.getByTestId("home.faq.item").filter({ hasText: "production-ready" });
    await faq.locator("summary").click();
    await expect(faq).toContainText("No. V1 is in development");
    expect(text.match(/production-ready/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  test("hero: Skip animation is the first focusable control in the hero and stops the animation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    let first = "";
    for (let i = 0; i < 30 && !first; i++) {
      await page.keyboard.press("Tab");
      first = await page.evaluate(() => (document.activeElement?.closest("[data-testid='home.hero']") ? document.activeElement.getAttribute("data-testid") ?? "" : ""));
    }
    expect(first).toBe("home.hero.skip");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("home.hero.line")).toHaveAttribute("data-static", "true");
    const name = await page.locator("[data-testid='home.hero.line'] .bar").first().evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("none");
  });

  test("reduced motion: no hero animation at all", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: LOCAL, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    const names = await page.locator(".bar").evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n).toBe("none");
    await ctx.close();
  });

  test("journey: tabs follow arrow keys, Home and End, and the panel changes", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(5);
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("0.8 s");
    await page.keyboard.press("End");
    await expect(tabs.nth(4)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("parent span not received");
    await page.keyboard.press("Home");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  });

  test("every internal link on the landing page resolves", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = [...new Set(await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!)))];
    for (const h of hrefs) {
      if (h.startsWith("#")) expect(await page.locator(`[id="${h.slice(1)}"]`).count(), h).toBe(1);
      else if (h.startsWith("/")) expect((await request.get(h.split("#")[0]!)).status(), h).toBe(200);
      else expect(h).toMatch(/^https:\/\/github\.com\/Sendiw14\/Traceflow/);
    }
    expect(hrefs.some((h) => h.startsWith("/login"))).toBe(false);
  });

  test("copy button copies the getting-started commands", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("home.start.copy").click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("make env\nmake up");
  });
});

test.describe("landing under operator-prod", () => {
  test.use({ baseURL: OPERATOR });
  test("no demo link or CTA is rendered (the route is 404 here)", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.getByTestId("home.cta-demo")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /demo/i })).toHaveCount(0);
    await expect(page.getByTestId("home.cta-docs")).toBeVisible();
    expect((await request.get("/demo")).status()).toBe(404);
  });
});
