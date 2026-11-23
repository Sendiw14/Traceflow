import { expect, type Page } from "@playwright/test";
import type { components } from "../src/lib/api/generated/schema";

export type Schemas = components["schemas"];

// Test-harness access to trace-api (Node, never the browser) to discover real fixtures and compute expectations.
const API = process.env.TRACE_API_URL;
const TOKEN = process.env.TRACEFLOW_SERVICE_TOKEN;

export function requireStack() {
  if (!API || !TOKEN) throw new Error("E2E needs the real stack: set TRACE_API_URL and TRACEFLOW_SERVICE_TOKEN (see docs/workflow/integration-log.md M5).");
}

export async function api<T>(path: string): Promise<T> {
  requireStack();
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`trace-api ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export const windowQuery = (seconds: number) => {
  const to = BigInt(Date.now()) * 1_000_000n;
  return `from=${to - BigInt(seconds) * 1_000_000_000n}&to=${to}`;
};

/** A real trace matching the filter in the last 24 h (newest first), or fail with guidance. */
export async function findTrace(filter = ""): Promise<Schemas["TraceSummary"]> {
  const r = await api<Schemas["TraceList"]>(`/v1/traces?${windowQuery(86400)}&limit=50${filter}`);
  const t = r.items[0];
  if (!t) throw new Error(`No trace for filter "${filter}". Generate traffic first (compose traffic service or demo load).`);
  return t;
}

/** Press Tab until the focused element satisfies `match`; fails after `max` presses (keyboard-only navigation). */
export async function tabTo(page: Page, match: string, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const ok = await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, match);
    if (ok) return;
  }
  throw new Error(`Never focused ${match} within ${max} Tab presses`);
}

export async function expectNoStore(page: Page, path: string) {
  const res = await page.request.get(path);
  expect(res.status(), path).toBe(200);
  expect(res.headers()["cache-control"], path).toBe("private, no-store");
}

/** Client components attach handlers after load; wait for the network to settle before keyboard input. */
export async function hydrated(page: Page) {
  await page.waitForLoadState("networkidle");
}
