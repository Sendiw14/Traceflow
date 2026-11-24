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
    const widths = [360, 375, 768, 1024, 1440], CAP = 1500, rows = [];
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
  } else if (mode === "dense") {
    const res = [];
    const probe = async (label, url, throttle, interact) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
      await page.addInitScript(() => {
        window.__long = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: "longtask", buffered: true });
        window.__lcp = 0; new PerformanceObserver((l) => l.getEntries().forEach((e) => { window.__lcp = Math.round(e.startTime); })).observe({ type: "largest-contentful-paint", buffered: true });
      });
      const t0 = Date.now();
      await page.goto(url, { waitUntil: "load" }); await page.getByRole("heading", { level: 1 }).first().waitFor();
      const ttHeading = Date.now() - t0;
      await page.waitForLoadState("networkidle");
      const base = await page.evaluate(() => ({ rows: document.querySelectorAll("tbody tr").length, nodes: document.getElementsByTagName("*").length, long: window.__long.slice(), lcp: window.__lcp, nav: (({ responseEnd, domContentLoadedEventEnd, loadEventEnd }) => ({ responseEnd: Math.round(responseEnd), dcl: Math.round(domContentLoadedEventEnd), load: Math.round(loadEventEnd) }))(performance.getEntriesByType("navigation")[0]) }));
      const extra = interact ? await interact(page) : {};
      // scroll jank: frame deltas while scrolling the document for ~2 s
      const frames = await page.evaluate(async () => {
        const d = []; let last = performance.now(); let y = 0; const end = performance.now() + 2000;
        await new Promise((res) => { const tick = (t) => { d.push(t - last); last = t; y += 60; window.scrollTo(0, y); if (t < end) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
        d.sort((a, b) => a - b); return { n: d.length, p50: +d[Math.floor(d.length * 0.5)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), max: +d[d.length - 1].toFixed(1), over50: d.filter((x) => x > 50).length };
      });
      res.push({ label, cpuThrottle: throttle, headingMs: ttHeading, ...base, long: base.long.length ? base.long : "none", longTotalMs: base.long.reduce((a, b) => a + b, 0), ...extra, scrollFrames: frames });
      await ctx.close();
    };
    const sortClick = async (page) => {
      const t = await page.evaluate(async () => { const b = [...document.querySelectorAll("thead th button")].find((x) => x.textContent?.includes("Duration")); const s = performance.now(); b.click(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return +(performance.now() - s).toFixed(1); });
      return { sortClickToPaintMs: t };
    };
    const mapKeys = async (page) => {
      await page.getByTestId("map.graph").focus();
      const t = await page.evaluate(async () => { const g = document.querySelector('[data-testid="map.graph"]'); const s = performance.now(); g.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return +(performance.now() - s).toFixed(1); });
      return { arrowKeyToPaintMs: t, nodes: await page.getByTestId("map.node").count(), edges: await page.getByTestId("map.edge").count() };
    };
    for (const th of [1, 4]) {
      await probe("traces limit=200 (24h)", `${A}/app/traces?range=24h&limit=200`, th, sortClick);
      await probe("traces limit=50 (baseline)", `${A}/app/traces?range=24h`, th, sortClick);
      await probe("map (3 demo services)", `${A}/app/map`, th, mapKeys);
    }
    out(res);
  } else if (mode === "keyboard") {
    const log = [];
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
    const desc = () => page.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return { body: true };
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      const visible = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
      return { tag: e.tagName.toLowerCase(), role: e.getAttribute("role") ?? "", name: (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 48), testid: e.getAttribute("data-testid") ?? "", indicator: visible, inView: r.top >= 0 && r.bottom <= innerHeight + 1 };
    });
    const tabUntil = async (pred, max, trail) => {
      for (let i = 0; i < max; i++) { await page.keyboard.press("Tab"); const d = await desc(); trail.push(d); if (pred(d)) return true; }
      return false;
    };
    const journey = async (name, start, steps) => {
      const trail = []; await page.goto(`${A}${start}`); await settle(page); // no click: keyboard starts at the top of the document
      const notes = []; await steps(trail, notes);
      const noIndicator = trail.filter((d) => !d.body && !d.indicator).map((d) => `${d.tag}:${d.name || d.testid}`);
      const offscreen = trail.filter((d) => !d.body && !d.inView).length;
      log.push({ journey: name, tabStops: trail.length, firstStops: trail.slice(0, 6).map((d) => `${d.tag}${d.role ? "[" + d.role + "]" : ""}: ${d.name || d.testid}`), stopsWithoutVisibleIndicator: noIndicator, stopsOutsideViewportWhenFocused: offscreen, notes });
    };
    await journey("skip link + landmarks (/app/traces)", "/app/traces", async (t, n) => {
      await page.keyboard.press("Tab"); const d = await desc(); t.push(d); n.push(`first stop: ${d.name}`);
      await page.keyboard.press("Enter"); const m = await page.evaluate(() => document.activeElement?.id); n.push(`after Enter focus id: ${m}`);
      await page.keyboard.press("Tab"); t.push(await desc());
    });
    await journey("J-02 slow span", "/app", async (t, n) => {
      const ok = await tabUntil((d) => d.name === "View example" && d.inView !== undefined, 80, t); n.push(`reached a 'View example' link: ${ok} after ${t.length} Tabs`);
      await page.keyboard.press("Enter"); await page.waitForURL(/\/app\/traces\/[0-9a-f]{32}\?span=/); await settle(page);
      n.push(`landed on trace with span param; selected rows: ${await page.getByRole("treeitem", { selected: true }).count()}`);
      const sel = await page.getByTestId("trace.inspector.title").innerText(); n.push(`inspector title: ${sel}`);
    });
    await journey("J-03 error span", "/app/traces?status=error", async (t, n) => {
      const ok = await tabUntil((d) => d.tag === "a" && /^Trace [0-9a-f]{32}/.test(d.name), 80, t); n.push(`reached first trace link: ${ok} after ${t.length} Tabs`);
      await page.keyboard.press("Enter"); await page.waitForURL(/\/app\/traces\/[0-9a-f]{32}/); await settle(page);
      const ok2 = await tabUntil((d) => d.testid === "trace.next-error", 80, t); n.push(`reached 'Next error span': ${ok2}; total stops ${t.length}`);
      await page.keyboard.press("Enter"); const f = await desc(); t.push(f); n.push(`after Enter focus is on ${f.role} '${f.name}' (error row: ${await page.evaluate(() => document.activeElement?.getAttribute("data-error"))})`);
      await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowUp"); await page.keyboard.press("Enter");
      const b0 = t.length; const insp = await tabUntil((d) => d.name === "Close", 12, t); n.push(`Tab from the tree reaches the inspector Close button: ${insp} (${t.length - b0} Tabs, no trap); then Shift+Tab x${t.length - b0} to return`);
      for (let i = 0; i < t.length - b0; i++) await page.keyboard.press("Shift+Tab");
      n.push(`inspector: ${(await page.getByTestId("trace.inspector").innerText()).split("\n").slice(0, 4).join(" | ")}`);
      await page.keyboard.press("Escape"); n.push(`after Escape selected rows: ${await page.getByRole("treeitem", { selected: true }).count()}, focus on ${(await desc()).role}`);
    });
    await journey("J-04 map → trace", "/app/map", async (t, n) => {
      const ok = await tabUntil((d) => d.testid === "map.graph", 40, t); n.push(`reached graph widget: ${ok} after ${t.length} Tabs`);
      await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter"); n.push(`node details: ${(await page.getByTestId("map.details").innerText()).split("\n").slice(0, 3).join(" | ")}`);
      await page.keyboard.press("Escape");
      const t0 = t.length; await page.keyboard.press("Tab"); const next = await desc(); t.push(next); n.push(`one Tab after the graph moves to: ${next.tag} '${next.name}' (graph is a single stop; no trap)`);
      const ok2 = await tabUntil((d) => d.tag === "button" && /Select edge/.test(d.name), 60, t); n.push(`reached edge-table select button: ${ok2} (+${t.length - t0} Tabs)`);
      await page.keyboard.press("Enter"); n.push(`edge details: ${(await page.getByTestId("map.details").innerText()).split("\n").slice(0, 3).join(" | ")}`);
      const fwd = await tabUntil((d) => d.tag === "a" && /Supporting trace/.test(d.name), 8, t); n.push(`supporting-trace link reachable with forward Tab (8 stops): ${fwd}`);
      let back = false;
      if (!fwd) { for (let i = 0; i < 25 && !back; i++) { await page.keyboard.press("Shift+Tab"); const d = await desc(); t.push(d); back = d.tag === "a" && /Supporting trace/.test(d.name); if (back) n.push(`supporting-trace link found going BACKWARD after ${i + 1} Shift+Tab: details panel sits before the edge table in DOM order`); } }
      if (fwd || back) { await page.keyboard.press("Enter"); await page.waitForURL(/\/app\/traces\/[0-9a-f]{32}/, { timeout: 8000 }); n.push("opened supporting trace with Enter"); }
    });
    await journey("docs getting-started: tab order and copy buttons", "/docs/getting-started", async (t, n) => {
      await tabUntil((d) => d.testid === "docs.gs.copy-up", 60, t); n.push(`copy button reachable after ${t.length} Tabs`);
    });
    out(log);
  } else if (mode === "aria") {
    mkdirSync(`${SHOTS}/../a11y-snapshots`, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
    const save = async (name, loc) => { const y = await loc.ariaSnapshot(); writeFileSync(`${SHOTS}/../a11y-snapshots/${name}.yml`, y + "\n"); return y.split("\n").length; };
    const counts = {};
    await page.goto(`${A}/app/traces/${f.trace}?span=${f.span}`); await settle(page);
    counts["trace-waterfall"] = await save("trace-waterfall", page.getByTestId("trace.waterfall"));
    counts["trace-inspector"] = await save("trace-inspector", page.getByTestId("trace.inspector"));
    await page.goto(`${A}/app/map`); await settle(page);
    counts["map-graph"] = await save("map-graph", page.getByTestId("map.graph"));
    counts["map-edge-table"] = await save("map-edge-table", page.getByTestId("map.edge-table"));
    await page.goto(`${A}/app`); await settle(page);
    counts["overview-latency-chart"] = await save("overview-latency-chart", page.getByTestId("chart.latency"));
    const live = await page.evaluate(() => [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')].map((e) => `${e.tagName.toLowerCase()}${e.getAttribute("role") ? "[" + e.getAttribute("role") + "]" : ""}${e.getAttribute("aria-live") ? "[live=" + e.getAttribute("aria-live") + "]" : ""}: "${(e.textContent ?? "").trim().slice(0, 60)}"`));
    out({ snapshotLines: counts, overviewLiveRegions: live });
  } else {
    throw new Error(`unknown mode ${mode}`);
  }
  await browser.close();
}
await main(process.argv[2] ?? "");
