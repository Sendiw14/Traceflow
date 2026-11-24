# UI Acceptance Evidence (M7-UI)

**Branch:** `m7-ui` · **Date:** 2026-11-25 · **Owner:** Sonnet · **Spec:** §9.4, §16.3
**Environment (actual):** macOS arm64 developer laptop (10 CPU), Node v24.11.1 (CI uses 26), Next.js 16.4.6 production build served by the standalone server (`output: "standalone"`; `next start` is not supported with it), Chromium 1255 from Playwright, live local stack at `127.0.0.1:18080` (trace-api + PostgreSQL + demo traffic every 15 s, several thousand traces in the 24 h window). Loopback networking, no TLS, no CDN.
**Not claimed:** WCAG conformance, field performance, cross-browser support, screen-reader behaviour. Everything below is what was run, with its limits.

Reproduce: `pnpm build`, start the standalone server(s) as in `e2e/serve.sh`, then `sh scripts/lighthouse.sh` and `node scripts/ui-acceptance.mjs bundle|shots|dense|keyboard|aria` (needs `TRACE_API_URL`, `TRACEFLOW_SERVICE_TOKEN`; `/login` needs an operator-prod server with fake auth env on :3102).

## 1. Lab web performance (Lighthouse 12.8.2) — lab, not field

Presets: **mobile** = Lighthouse default (Moto G Power emulation, simulated Slow 4G, 4× CPU slowdown); **desktop** = Lighthouse desktop preset. Single run per cell (no median of several), `throttlingMethod: simulate`. Targets (spec §9.4): LCP ≤ 2.5 s, CLS ≤ 0.1. TBT is the lab proxy for INP (no INP in lab).

| Route | Preset | Perf score | LCP | CLS | TBT | FCP | Targets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | mobile | 99 | 2.12 s | 0 | 27 ms | 0.76 s | LCP ✅ CLS ✅ |
| `/docs` | mobile | 99 | 2.18 s | 0 | 23 ms | 0.76 s | ✅ ✅ |
| `/docs/getting-started` | mobile | 99 | 2.04 s | 0 | 30 ms | 0.76 s | ✅ ✅ |
| `/demo` | mobile | 98 | 2.25 s | 0 | 91 ms | 0.91 s | ✅ ✅ |
| `/` | desktop | 100 | 0.47 s | 0 | 0 ms | 0.21 s | ✅ ✅ |
| `/docs` | desktop | 100 | 0.47 s | 0 | 0 ms | 0.21 s | ✅ ✅ |
| `/docs/getting-started` | desktop | 100 | 0.47 s | 0 | 0 ms | 0.21 s | ✅ ✅ |
| `/demo` | desktop | 100 | 0.58 s | 0 | 0 ms | 0.27 s | ✅ ✅ |

**Finding fixed during the run:** the first mobile run measured **CLS 0.186 on `/docs` and `/docs/getting-started`** (score 90), above the 0.1 target. Cause: the docs sidebar chose between "open sidebar" and "collapsed menu" with a hydration-time state flip (`useSyncExternalStore`), so mobile pages rendered the wide layout and then shifted. Fixed in `d27656c` (both variants server-rendered, switched by CSS only): CLS 0.000, score 99. Mobile LCP sits at 2.0–2.25 s on the simulated slow-4G profile, so there is about 0.3 s of headroom, not a large margin. `/demo` LCP is the largest and depends on live API latency (≈ 30 ms here).
**Limits:** no field data; one run per cell; loopback server (no real network or TLS); `/demo` timing includes only the demo API on the same machine; the private `/app` routes were not Lighthouse-tested (no public target in the spec).

## 2. Bundle size (first-load JavaScript per route)

Next.js 16 (Turbopack) no longer prints the "First Load JS" table, so this was measured: cold load in Chromium, summing `encodedDataLength` (gzip transfer size) of every script response until network idle (`scripts/ui-acceptance.mjs bundle`). Server responses were confirmed `Content-Encoding: gzip`.

| Route | JS (gzip, KB) | JS files | CSS (gzip, KB) | Largest JS file |
| --- | --- | --- | --- | --- |
| `/` | 152.0 | 11 | 6.5 | 70.5 KB |
| `/docs`, `/docs/getting-started`, `/docs/instrumentation`, `/docs/architecture`, `/docs/deployment` | 150.3 | 12 | 6.5 | 70.5 KB |
| `/docs/security` | 149.3 | 11 | 6.5 | 70.5 KB |
| `/demo` | 149.0 | 11 | 6.5 | 70.5 KB |
| `/demo/traces/[id]` | 149.8 | 11 | 6.5 | 70.5 KB |
| `/app` | 149.0 | 11 | 6.5 | 70.5 KB |
| `/app/traces` | 146.4 | 11 | 6.5 | 70.5 KB |
| `/app/traces/[id]` | 150.4 | 11 | 6.5 | 70.5 KB |
| `/app/services` | 145.3 | 11 | 6.5 | 70.5 KB |
| `/app/services/[name]` | 149.0 | 11 | 6.5 | 70.5 KB |
| `/app/map` | 148.5 | 11 | 6.5 | 70.5 KB |
| `/app/analytics` | 146.4 | 11 | 6.5 | 70.5 KB |
| `/app/onboarding` | 143.3 | 11 | 6.5 | 70.5 KB |
| `/app/settings` | 144.5 | 11 | 6.5 | 70.5 KB |
| `/login` | 140.4 | 8 | 6.5 | 70.5 KB |

**Nothing is over 200 kB gzip** (maximum 152 KB). About 140 KB is the framework baseline shared by every route (React runtime + Next client, the 70.5 KB chunk is the React runtime); page-specific code is 3–12 KB. No charting or graph library is shipped (charts and the map are hand-written SVG). Limit: transfer size on a warm loopback server; the browser may also fetch prefetched route payloads that are not counted here.

## 3. Responsive screenshots

`docs/testing/screenshots/<route>/<width>.png` — 20 route variants × 360, 375, 768, 1024, 1440 px (100 images), plus `zoom200.png` for `/app/traces/[id]` (`app-trace`), `/demo` and `/docs/getting-started` (a 1280 px window at 200% zoom is a 640 CSS-px viewport; captured at 640 px, device scale 2). Full-page captures, **cropped to the top 1500 px** to keep the repository small (`overflow.json` records the real page height and horizontal overflow of every capture). Routes: `home`, `docs`, `docs-getting-started`, `docs-instrumentation`, `docs-architecture`, `docs-deployment`, `docs-security`, `demo`, `demo-trace`, `app-overview`, `app-traces`, `app-trace` (error trace, inspector open), `app-services`, `app-service`, `app-map`, `app-analytics`, `app-onboarding`, `app-settings`, `login`, `login-denied` (operator-prod with fake auth env). Data is the live demo stack, so numbers differ between runs.

**Horizontal overflow:** the final capture set has **0 px page-level horizontal overflow in all 103 captures**. The first capture run found real overflow: `/app` and `/app/services/[name]` overflowed by **262 px at 768 px and 6 px at 1024 px** (grid children without `min-w-0`, so wide tables stretched the column). Fixed in `33dc65b`; tables now scroll inside their own container. Wide tables (traces, edges, services) still scroll horizontally *inside* their wrapper at 768 px by design.

## 4. Dense data

Method: `node scripts/ui-acceptance.mjs dense`, Chromium, 1280×800, cold load, `?range=24h&limit=200` (a `limit` query parameter, 1–200, was added to `/app/traces`; default stays 50). Long tasks via `PerformanceObserver`; sort click → two animation frames; scroll jank = frame deltas while scrolling the document for 2 s. Measured unthrottled and with a 4× CPU slowdown (a mid-range-device proxy).

| Case | CPU | Rows / DOM nodes | Load (response end → load) | LCP | Long tasks (>50 ms) | Interaction | Scroll frames (p95 / max / >50 ms) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Traces, `limit=200` | 1× | 200 / 4 802 | 312 → 318 ms | 488 ms | none | sort by Duration → paint **34 ms** | 16.7 / 16.8 / 0 |
| Traces, `limit=200` | 4× | 200 / 4 802 | 99 → 158 ms | 472 ms | 2 (63, 129 ms) | sort → paint **115 ms** | 16.7 / 16.8 / 0 |
| Traces, `limit=50` (baseline) | 1× | 50 / 1 292 | 85 → 86 ms | 368 ms | none | sort → paint 17 ms | 16.7 / 16.8 / 0 |
| Traces, `limit=50` (baseline) | 4× | 50 / 1 292 | 80 → 137 ms | 420 ms | 2 (63, 82 ms) | sort → paint 40 ms | 16.7 / 16.8 / 0 |
| Map, 3 demo services, 2 edges | 1× | 3 nodes | 78 → 83 ms | 356 ms | none | arrow key → paint 31 ms | 16.7 / 16.8 / 0 |
| Map, 3 demo services, 2 edges | 4× | 3 nodes | 72 → 131 ms | 408 ms | 2 (61, 70 ms) | arrow key → paint 19 ms | 16.7 / 16.8 / 0 |

Reading: 200 rows render without long tasks at full speed and without dropped frames while scrolling. With a 4× slowdown, one long task of 129 ms occurs at load and sorting 200 rows takes 115 ms to paint (just over the 100 ms mark; INP in the field would be affected on slow phones). The 200-row table is not virtualised (≈ 24 DOM nodes per row); the spec's "decide virtualisation by measurement" gets the answer **not needed at 200 rows on this hardware, revisit if rows × columns grow or INP data says otherwise**. Rows above 200 are never rendered at once (the API caps `limit` at 200 and "Load more" appends).
**NOT TESTED: map with 50 nodes.** The demo has 3 services, and no 50-service data exists. Proposal: extend the Go load generator (or `services/trace-api/tests/perf`, which already builds OTLP requests) with a mode that emits N services (`svc-01…svc-50`) calling each other in a layered pattern with 1–3 callees each, seeded with a fixed random seed, ingested into a scratch database; then run the same probe on `/app/map` and confirm the ">50 nodes → table first" rule and layout time. Also NOT TESTED: lists above 200 rows after several "Load more" clicks, and a 5 000-span trace (lite mode, large-trace banner).

## 5. Accessibility (details and findings in `docs/design/accessibility-matrix.md` §M7)

- **axe-core** (WCAG 2.0/2.1/2.2 A and AA rule tags): `pnpm test:e2e` a11y spec = 22 checks (landing incl. after interaction, six docs pages, `/demo` ×2 and demo trace with inspector, ten `/app` variants, trace detail with inspector/tree/table), `/login` four states in the login spec: **no violations on the final build** (full suite 93 passed). axe finds only a subset of issues; it does not establish conformance.
- **Keyboard-only pass** (scripted focus trace plus reading the results; J-02, J-03, J-04, skip link, docs): see the matrix.
- **Screen reader:** **NOT TESTED with VoiceOver** (see matrix for why). A Playwright accessibility-tree dump of the waterfall/tree, inspector, edge table, graph and chart is in `docs/testing/a11y-snapshots/`; it shows roles and names, not what a screen reader announces.

## 6. Visual review (spec §16.3: target vs actual)

Reviewed by looking at the screenshots listed under "Seen". Everything else was only checked for overflow/axe, **not** visually inspected, and is marked as such.

| Route | Target (page matrix / identity) | Actual | Inconsistencies | Status |
| --- | --- | --- | --- | --- |
| `/` | White-first editorial hero, two CTAs, trace illustration, journey, features, walkthrough | Seen at 1440: serif H1, eyebrow, CTAs, bar-reveal trace, tabs, cards all as designed | Hero illustration bars are all full-width-ish because the real `normal` trace is a nested chain (accurate, but visually uniform) | Seen; listed |
| `/docs/getting-started` | Readable prose, code with copy, collapsible nav/TOC on mobile | Seen at 375: banner, "Docs menu", "On this page", code with scrollable overflow | **Bullets and numbers were missing** (list-style reset) → fixed in `c3f5e49`; inline `code` padding makes "( docker compose )" look spaced | Fixed; minor listed |
| `/app` | KPIs, three charts, top services, recent traces, health | Seen at 1440 | Full-width latency chart scales its labels up (11 px text becomes ≈ 19 px) while the half-width charts keep ≈ 11 px: inconsistent axis type size between charts | Seen; **listed, not fixed** |
| `/app/traces` | Filter bar, chips, sortable table, pager | Seen at 768 | Content column is only 548 px beside the 220 px sidebar, so the table shows 5 columns and scrolls inside its wrapper | Seen; listed |
| `/app/traces/[id]` | Waterfall + inspector side by side, axis labelled | Seen at 1024 before and after | **At 1024 the inspector squeezed the waterfall: duration column and axis labels clipped** → inspector now stacks below under 1320 px (`c3f5e49`); stacked, the inspector sits below the fold after selecting a span | Fixed; listed |
| `/app/map` | Layered graph, legend, details, edge table | Seen at 1024 | The *Details* panel sits above the edge table, so after selecting an edge with the keyboard the evidence links are *before* the focus point (see keyboard notes) | Seen; **listed, not fixed** |
| `/demo` | Violet synthetic banner, overview + services + traces | Seen at 200% zoom (640 CSS px) | none material at this width | Seen |
| `/login`, `/login-denied` | Centered card, states | Screenshots taken; **not visually inspected** | — | NOT reviewed |
| `/docs/*` (other five), `/demo/traces/[id]`, `/app/services`, `/app/services/[name]`, `/app/analytics`, `/app/onboarding`, `/app/settings` | per page matrix | Screenshots taken at 5 widths; **not visually inspected** beyond zero overflow and axe | unknown | NOT reviewed |

Cross-route consistency items noticed: chart axis type size varies with chart width (above); `View example` links in KPI tiles are small text links; the public header and the app sidebar use different navigation patterns by design.

## 7. What was not done

VoiceOver/NVDA/TalkBack passes; Firefox and Safari (Chromium only); real mobile devices; field Core Web Vitals; Lighthouse on private routes; 50-node map and > 200-row/5 000-span scenarios; human usability sessions (spec §1.3, ≥ 3 participants); contrast re-audit of every state (only the token pairs in `docs/design/tools/contrast.py` plus axe's colour-contrast rule on rendered pages).
