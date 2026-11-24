import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// operator-prod server with valid but fake auth env (unreachable auth DB); no real GitHub sign-in is possible here.
const PROD = process.env.E2E_URL_OPERATOR_PROD ?? "http://127.0.0.1:3102";
const MISCONFIGURED = process.env.E2E_URL_OPERATOR_PROD_NOAUTH ?? "http://127.0.0.1:3105";
const LOCAL = process.env.E2E_URL_LOCAL_DEV ?? "http://127.0.0.1:3100";
const TRACE = "0123456789abcdef0123456789abcdef";

test.describe("operator-prod, unauthenticated, auth database unreachable", () => {
  test.use({ baseURL: PROD });

  test("every /app route redirects to /login with the path preserved and renders no data", async ({ request }) => {
    const paths = ["/app", "/app/traces", `/app/traces/${TRACE}?span=0123456789abcdef`, "/app/services/orders", "/app/map", "/app/analytics", "/app/onboarding", "/app/settings"];
    for (const p of paths) {
      const res = await request.get(p, { maxRedirects: 0 });
      expect([302, 307], p).toContain(res.status());
      expect(res.headers()["location"], p).toBe(`/login?next=${encodeURIComponent(p)}`);
      expect(res.headers()["cache-control"], p).toContain("no-store");
      const body = await res.text();
      expect(body, p).not.toMatch(/trace_id|Requests|Error rate|retention/i);
    }
  });

  test("login renders the button; states for denied, error, expired, signed out", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expect(page.getByTestId("login.github-button")).toHaveText("Sign in with GitHub");
    await page.goto("/login?error=denied");
    await expect(page.getByTestId("login.denied")).toHaveText("This GitHub account is not allowed on this deployment.");
    await page.goto("/login?error=state_mismatch");
    await expect(page.getByTestId("login.error")).toBeVisible();
    await expect(page.getByTestId("login.denied")).toHaveCount(0);
    await page.goto("/login?reason=expired&next=/app/map");
    await expect(page.getByTestId("login.expired")).toContainText("Your session expired. Sign in to continue to /app/map.");
    await page.goto("/login?signedout=1");
    await expect(page.getByTestId("login.signed-out")).toHaveText("You have signed out.");
  });

  test("return path: only /app paths are shown or used; others fall back", async ({ page }) => {
    await page.goto("/login?reason=expired&next=//evil.example/app");
    await expect(page.getByTestId("login.expired")).toHaveText("Your session expired. Sign in to continue.");
    await page.goto("/login?reason=expired&next=https://evil.example");
    await expect(page.getByTestId("login.expired")).not.toContainText("evil");
    await page.goto("/login?next=/app/traces%3Frange%3D6h");
    await expect(page.getByText("/app/traces?range=6h")).toBeVisible();
  });

  test("starting sign-in when the auth backend is unavailable shows an error and allows retry", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const btn = page.getByTestId("login.github-button");
    await btn.click();
    await expect(page.getByTestId("login.send-error")).toContainText("Could not start sign-in");
    await expect(btn).toBeEnabled();
    expect(page.url()).toMatch(/\/login$/); // never navigated anywhere
  });

  test("auth endpoints answer without leaking details when unauthenticated", async ({ request }) => {
    const res = await request.get("/api/auth/get-session");
    expect(res.status()).not.toBe(200); // no session without a working auth database
    expect(await res.text()).not.toMatch(/postgres|nobody|fake-client|secret|ECONNREFUSED/i);
  });

  test("axe on /login states and 375 px reflow", async ({ page }) => {
    for (const p of ["/login", "/login?error=denied", "/login?reason=expired&next=/app/traces", "/login?signedout=1"]) {
      await page.goto(p);
      await page.getByRole("heading", { level: 1 }).waitFor();
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), p).toEqual([]);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login?error=denied");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe("operator-prod without auth env (misconfigured) fails closed", () => {
  test.use({ baseURL: MISCONFIGURED });
  test("/app redirects, /login says not configured and shows no env detail", async ({ request, page }) => {
    const res = await request.get("/app", { maxRedirects: 0 });
    expect([302, 307]).toContain(res.status());
    await page.goto("/login");
    await expect(page.getByTestId("login.not-configured")).toHaveText("Sign-in is not configured on this deployment.");
    await expect(page.getByTestId("login.github-button")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toMatch(/TRACEFLOW_|GITHUB_|required/);
    expect((await request.post("/api/auth/sign-in/social", { data: { provider: "github" } })).status()).toBe(404);
  });
});

test.describe("local-dev is unchanged", () => {
  test.use({ baseURL: LOCAL });
  test("/app renders without sign-in, no sign-out control, /login is 404", async ({ page, request }) => {
    const res = await request.get("/app", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByTestId("shell.sign-out")).toHaveCount(0);
    expect((await request.get("/login")).status()).toBe(404);
  });
});
