#!/usr/bin/env node
// M7 UI acceptance tooling (lab measurements; not part of the Playwright suite).
//   node scripts/ui-acceptance.mjs bundle|shots|dense|keyboard|aria
// Needs: local-dev web on :3100 (E2E-style env: TRACE_API_URL, TRACEFLOW_SERVICE_TOKEN for fixture discovery),
// operator-prod web with fake auth env on :3102 (for /login). Outputs JSON on stdout; shots go to docs/testing/screenshots.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(here, "../../../docs/testing/screenshots");
const A = process.env.E2E_URL_LOCAL_DEV ?? "http://127.0.0.1:3100";
const P = process.env.E2E_URL_OPERATOR_PROD ?? "http://127.0.0.1:3102";
const API = process.env.TRACE_API_URL, TOK = process.env.TRACEFLOW_SERVICE_TOKEN;
if (!API || !TOK) throw new Error("set TRACE_API_URL and TRACEFLOW_SERVICE_TOKEN");
const api = async (p) => (await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${TOK}` } })).json();
const now = BigInt(Date.now()) * 1_000_000n;
const win = (s) => `from=${now - BigInt(s) * 1_000_000_000n}&to=${now}`;

async function fixtures() {
  const l = await api(`/v1/traces?${win(86400)}&status=error&limit=5`);
  const t = l.items[0];
  const d = await api(`/v1/traces/${t.trace_id}?detail=full`);
  const errSpan = d.spans.find((s) => s.status.code === "error")?.span_id ?? d.spans[0].span_id;
  return { trace: t.trace_id, span: errSpan };
}

function routes(f) {
  return [
    ["home", A, "/"], ["docs", A, "/docs"], ["docs-getting-started", A, "/docs/getting-started"], ["docs-instrumentation", A, "/docs/instrumentation"],
    ["docs-architecture", A, "/docs/architecture"], ["docs-deployment", A, "/docs/deployment"], ["docs-security", A, "/docs/security"],
    ["demo", A, "/demo"], ["demo-trace", A, `/demo/traces/${f.trace}?span=${f.span}`],
    ["app-overview", A, "/app"], ["app-traces", A, "/app/traces"], ["app-trace", A, `/app/traces/${f.trace}?span=${f.span}`],
    ["app-services", A, "/app/services"], ["app-service", A, "/app/services/orders"], ["app-map", A, "/app/map"],
    ["app-analytics", A, "/app/analytics"], ["app-onboarding", A, "/app/onboarding"], ["app-settings", A, "/app/settings"],
    ["login", P, "/login"], ["login-denied", P, "/login?error=denied"],
  ];
}
const out = (o) => console.log(JSON.stringify(o, null, 1));
const settle = async (page) => { await page.waitForLoadState("networkidle"); await page.waitForTimeout(400); };

async function main(mode) {
  const f = await fixtures();
  const browser = await chromium.launch();
  if (mode === "bundle") {
    const rows = [];
    for (const [name, base, path] of routes(f)) {
      const ctx = await browser.newContext(); const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page); await cdp.send("Network.enable");
      const kinds = new Map(), sizes = new Map();
      cdp.on("Network.responseReceived", (e) => kinds.set(e.requestId, { type: e.type, url: e.response.url }));
      cdp.on("Network.loadingFinished", (e) => sizes.set(e.requestId, e.encodedDataLength));
      await page.goto(base + path); await settle(page);
      let js = 0, css = 0, jsFiles = 0, biggest = { url: "", bytes: 0 };
      for (const [id, k] of kinds) {
        const b = sizes.get(id) ?? 0;
        if (k.type === "Script") { js += b; jsFiles++; if (b > biggest.bytes) biggest = { url: k.url.split("/").pop(), bytes: b }; }
        if (k.type === "Stylesheet") css += b;
      }
      rows.push({ route: name, jsKB: +(js / 1024).toFixed(1), jsFiles, cssKB: +(css / 1024).toFixed(1), biggestJs: `${biggest.url} ${(biggest.bytes / 1024).toFixed(1)}KB` });
      await ctx.close();
    }
    out(rows);
  } else if (mode === "shots") {
    const widths = [360, 375, 768, 1024, 1440], CAP = 2600, rows = [];
    for (const [name, base, path] of routes(f)) {
      mkdirSync(`${SHOTS}/${name}`, { recursive: true });
      for (const w of widths) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 } }); const page = await ctx.newPage();
        await page.goto(base + path); await page.getByRole("heading", { level: 1 }).first().waitFor(); await settle(page);
        const m = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, h: document.documentElement.scrollHeight }));
        await page.screenshot({ path: `${SHOTS}/${name}/${w}.png`, fullPage: true, ...(m.h > CAP ? { clip: { x: 0, y: 0, width: w, height: CAP } } : {}) });
        rows.push({ route: name, width: w, overflowPx: m.over, pageHeight: m.h, capped: m.h > CAP });
        await ctx.close();
      }
    }
    for (const [name, base, path] of routes(f).filter((r) => ["app-trace", "demo", "docs-getting-started"].includes(r[0]))) {
      const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
      await page.goto(base + path); await page.getByRole("heading", { level: 1 }).first().waitFor(); await settle(page);
      const m = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, h: document.documentElement.scrollHeight }));
      await page.screenshot({ path: `${SHOTS}/${name}/zoom200.png`, fullPage: true, ...(m.h > CAP ? { clip: { x: 0, y: 0, width: 640, height: CAP } } : {}) });
      rows.push({ route: name, width: "zoom200 (640 css px @2x)", overflowPx: m.over, pageHeight: m.h, capped: m.h > CAP });
      await ctx.close();
    }
    writeFileSync(`${SHOTS}/overflow.json`, JSON.stringify(rows, null, 1));
    out(rows.filter((r) => r.overflowPx > 0).length ? rows.filter((r) => r.overflowPx > 0) : "no horizontal overflow in any capture");
  } else {
    throw new Error(`unknown mode ${mode}`);
  }
  await browser.close();
}
await main(process.argv[2] ?? "");
