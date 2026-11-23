import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { findTrace, requireStack } from "./helpers";

test.beforeAll(requireStack);

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `axe violations on ${path}`).toEqual([]);
}

for (const path of ["/app", "/app/traces", "/app/traces?status=error", "/app/services", "/app/services/orders", "/app/map", "/app/analytics", "/app/analytics?compare=1&service=orders", "/app/onboarding", "/app/settings"]) {
  test(`axe: ${path}`, async ({ page }) => scan(page, path));
}

test("axe: trace detail (waterfall, inspector open, tree, table)", async ({ page }) => {
  const t = await findTrace("&status=error");
  await page.goto(`/app/traces/${t.trace_id}`);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  const run = async (label: string) => {
    const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), `axe: ${label}`).toEqual([]);
  };
  await run("waterfall");
  await page.getByTestId("trace.next-error").click();
  await run("inspector open");
  await page.getByTestId("trace.view.tree").click();
  await run("tree");
  await page.getByTestId("trace.view.table").click();
  await run("table");
});
