import { expect, test } from "@playwright/test";
import { api, findTrace, hydrated, requireStack, tabTo, windowQuery, type Schemas } from "./helpers";

test.beforeAll(requireStack);

test("BFF: the browser never talks to trace-api and the token never reaches the page", async ({ page }) => {
  const api = new URL(process.env.TRACE_API_URL!);
  const hosts: string[] = [];
  page.on("request", (r) => hosts.push(new URL(r.url()).host));
  const html: string[] = [];
  page.on("response", async (r) => { if (r.request().resourceType() === "document") html.push(await r.text()); });
  for (const p of ["/app", "/app/traces", "/app/map", "/app/settings"]) await page.goto(p);
  expect(hosts).not.toContain(api.host);
  expect(html.some((h) => h.includes(process.env.TRACEFLOW_SERVICE_TOKEN!))).toBe(false);
});

test("J-02 slow span: overview exemplar → trace with the slowest server span selected", async ({ page }) => {
  const ov = await api<Schemas["Overview"]>(`/v1/overview?${windowQuery(3600)}`);
  const ex = ov.totals.exemplars;
  expect(ex.slowest_trace_id, "need server spans in the last hour").toBeTruthy();
  await page.goto("/app");
  await page.getByTestId("overview.kpi.p95").getByRole("link", { name: "View example" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/traces/[0-9a-f]{32}\\?span=[0-9a-f]{16}`));
  // The exemplar is the slowest at query time; new traffic may supersede it, so assert shape and selection, not identity.
  await expect(page.getByTestId("trace.inspector.title")).toBeVisible();
  await expect(page.getByRole("treeitem", { selected: true })).toHaveCount(1);
  await expect(page.getByTestId("trace.duration")).toBeVisible();
});

test("J-03 error span, keyboard only", async ({ page }) => {
  await findTrace("&status=error");
  await page.goto("/app/traces?status=error");
  await expect(page.getByTestId("traces.list.row").first()).toBeVisible();
  await hydrated(page);
  await page.locator("body").click({ position: { x: 1, y: 1 } }); // reset focus to the document, then keyboard only
  await tabTo(page, 'a[data-trace]');
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/traces\/[0-9a-f]{32}/);
  await expect(page.locator('[data-testid="trace.tree.node"], [data-testid="trace.waterfall.row"]').first()).toBeVisible();
  await hydrated(page);
  await tabTo(page, '[data-testid="trace.next-error"]');
  await page.keyboard.press("Enter");
  const selected = page.getByRole("treeitem", { selected: true });
  await expect(selected).toHaveAttribute("data-error", "true");
  await expect(selected).toBeFocused();
  await expect(page.getByTestId("trace.inspector").getByText("status: error")).toBeVisible();
  // Arrow navigation moves focus; Enter selects; Escape closes the inspector and keeps focus on the row.
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("treeitem", { selected: true })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("treeitem", { selected: true })).toHaveCount(0);
  await expect(page.getByTestId("trace.inspector")).toContainText("Select a span");
});

test("J-04 map → trace: select an edge and open a supporting trace", async ({ page }) => {
  const dep = await api<Schemas["DependencyGraph"]>(`/v1/dependencies?${windowQuery(3600)}`);
  expect(dep.edges.length, "need cross-service edges in the last hour").toBeGreaterThan(0);
  await page.goto("/app/map");
  await hydrated(page);
  // Keyboard model on the graph itself.
  const graph = page.getByTestId("map.graph");
  await graph.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("map.details.node")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("map.details.node")).toHaveCount(0);
  // Edge table is the canonical alternative: select an edge, follow evidence.
  await page.getByTestId("map.edge-table.row").first().getByRole("button").click();
  const details = page.getByTestId("map.details.edge");
  await expect(details).toContainText("→");
  await details.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/app\/traces\/[0-9a-f]{32}/);
  await expect(page.getByTestId("trace.summary")).toBeVisible();
});

test("traces: URL-synced filters, clear, and paging without duplicates", async ({ page }) => {
  await page.goto("/app/traces?status=error&service=gateway");
  await expect(page.getByTestId("traces.filters.status")).toHaveValue("error");
  await expect(page.getByTestId("traces.filters.chips")).toContainText("status=error");
  await page.getByTestId("traces.filters.clear").click();
  await expect(page).toHaveURL(/\/app\/traces$/);
  await expect(page.getByTestId("traces.filters.chips")).toHaveCount(0);
  const more = page.getByTestId("traces.pager.more");
  if (await more.count()) {
    await more.click();
    const ids = await page.locator("a[data-trace]").evaluateAll((as) => as.map((a) => a.getAttribute("data-trace")));
    expect(new Set(ids).size).toBe(ids.length);
  } else {
    await expect(page.getByTestId("traces.pager.end")).toBeVisible(); // only one page: honest end state
  }
});

test("trace views share selection and the missing-parent group is labelled", async ({ page }) => {
  const missing = (await api<Schemas["TraceList"]>(`/v1/traces?${windowQuery(86400)}&limit=50`)).items.find((t) => t.completeness.orphan_count > 0);
  test.skip(!missing, "no trace with a missing parent in the last 24 h (demo `missing-parent` scenario not run) — NOT TESTED");
  await page.goto(`/app/traces/${missing!.trace_id}`);
  await expect(page.getByTestId("trace.notice.missing-parent")).toBeVisible();
  await expect(page.getByText("Parent span not received").first()).toBeVisible();
});

test("service detail: known service renders operations; unknown service is a not-found state", async ({ page }) => {
  await page.goto("/app/services/orders");
  await expect(page.getByTestId("service.operations")).toBeVisible();
  await page.goto("/app/services/definitely-not-a-service");
  await expect(page.getByTestId("service.not-found")).toBeVisible();
});

test("analytics: compare adds a previous-period series and the table view lists values", async ({ page }) => {
  await page.goto("/app/analytics?compare=1");
  await expect(page.getByRole("button", { name: /p95 \(previous period\)/ })).toBeVisible();
  await page.getByTestId("chart.analytics-latency.toggle").click();
  await expect(page.getByTestId("chart.analytics-latency.table")).toBeVisible();
});
