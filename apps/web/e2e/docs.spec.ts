import { expect, test, type Page } from "@playwright/test";

const DOCS = ["/docs", "/docs/getting-started", "/docs/instrumentation", "/docs/architecture", "/docs/deployment", "/docs/security"];

async function links(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!));
}

for (const path of DOCS) {
  test(`docs ${path}: banner, heading, and every link resolves`, async ({ page, request }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("docs.version-banner")).toContainText("V1, in development");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const hrefs = [...new Set(await links(page))];
    for (const h of hrefs) {
      if (h.startsWith("#")) {
        expect(await page.locator(`[id="${h.slice(1)}"]`).count(), `anchor ${h} on ${path}`).toBe(1);
      } else if (h.startsWith("/")) {
        const [pathname, hash] = h.split("#");
        const r = await request.get(pathname!);
        expect(r.status(), `${h} linked from ${path}`).toBe(200);
        if (hash) expect((await r.text()).includes(`id="${hash}"`), `anchor ${h}`).toBe(true);
      } else {
        expect(h, `external link on ${path}`).toMatch(/^https:\/\/github\.com\/Sendiw14\/Traceflow/);
      }
    }
  });
}

test("docs nav marks the current page and prev/next follow the order", async ({ page }) => {
  await page.goto("/docs/instrumentation");
  await expect(page.getByTestId("docs.nav").getByRole("link", { name: "Instrumentation" })).toHaveAttribute("aria-current", "page");
  const pn = page.getByTestId("docs.prevnext");
  await expect(pn.getByRole("link", { name: /Getting started/ })).toBeVisible();
  await expect(pn.getByRole("link", { name: /Architecture/ })).toBeVisible();
});

test("copy buttons copy the code and announce it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/docs/getting-started");
  await page.getByTestId("docs.gs.copy-up").click();
  await expect(page.getByTestId("docs.gs.copy-up")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("make up");
});

test("docs content: commands exist in the Makefile, deployment says hosted profiles are not built, security states M6 and ingest default", async ({ page }) => {
  await page.goto("/docs/getting-started");
  const text = await page.getByTestId("docs.article").innerText();
  for (const c of ["make env", "make up", "make down", "docker compose run --rm load"]) expect(text).toContain(c);
  await page.goto("/docs/deployment");
  const dep = await page.getByTestId("docs.article").innerText();
  expect(dep).toContain("Not built yet");
  expect(dep).toMatch(/not built\. There is no TLS reverse proxy/);
  expect(dep).not.toMatch(/compose\.production\.yaml/);
  await page.goto("/docs/security");
  const sec = await page.getByTestId("docs.article").innerText();
  expect(sec).toContain("Sign-in lands in milestone M6");
  expect(sec).toContain("Remote OTLP ingestion is off by default");
});
