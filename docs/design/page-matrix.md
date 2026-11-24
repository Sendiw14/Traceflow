# TRACEFLOW — Page Matrix (M1-D2)

**Status:** DRAFT 0.1.0 (2026-11-22) · **Owner:** Sonnet · **Spec:** §8.1, §8.2, §10, §11 · **API:** `api/openapi.yaml` **0.2.0-draft** (main `ffd5b3c`; re-reviewed, see `openapi-consumer-review.md` §5)
All results/gates are **NOT TESTED** (no code exists). R-IDs reference `openapi-consumer-review.md`; the 0.2.0 re-review resolved them (outcome noted inline as ✔).

## 0. Shared rules (apply to every route; not repeated below)

**Routes are exactly the 19 below + 3 system views. No other link may exist anywhere.** V2+ features get no nav entry (spec §1.5, §8).

**Data path.** Browser → Next.js BFF (server-side session check) → trace-api (`/v1/*`, bearer service token). The browser never sees trace-api. BFF naming is owned in `apps/web` at M2; this matrix names the **OpenAPI operationId** consumed. All private responses `Cache-Control: private, no-store`; no Next.js data/route cache for `/app/*`; bfcache-safe (`pagehide` clears private DOM/state; `/app/*` served with `no-store` so back after logout re-requests and hits 401 → `/login`).

**URL is state** (shareable, validated, defaults): `range=15m|1h|6h|24h|7d` (default `1h`) **or** absolute `from`/`to` ISO-8601 UTC (ms precision; max 7 d, mapped to ns strings for API); `service=<name>`; `status=any|error|ok_or_unset`; `min_duration=<n><us|ms|s>`; `cursor=<opaque>`; `sort`/`dir` (client-side table sorts only); `tz=utc|local`; `span=<spanId>`; `q=` (client-side filter on small lists). Invalid values → inline notice "Using default" + corrected URL (replace, no history spam). Relative `range` is resolved to absolute `from/to` **once per navigation/refresh tick** and shared by all panels on the page (time-window consistency, §11).

**Global shell regions (all `/app/*`, and `/demo*` minus admin):** `header` (wordmark, breadcrumb, route title as `<h1>` in main), `time-range` control, `service-scope` selector (where relevant), `freshness` indicator ("Updated 4 s ago · last span received 12:03:07 UTC"; polling pauses when hidden; no overlapping requests; manual refresh button), `sampling-caveat` strip (persistent one-liner: "Observed spans only; sampling is not reconstructed." with "Learn more" → `/docs/architecture#sampling`).

**Four mandatory states per data region:**
| State | Pattern | Test hook |
| --- | --- | --- |
| Loading | Skeleton matching final layout (no spinners > 400 ms alone), `aria-busy="true"`, status text "Loading traces…" in a polite live region once | `data-state="loading"` |
| Empty | Distinguish **no data at all** (never ingested → link to `/app/onboarding`) vs **no match** (filters; shows active chips + "Clear filters") vs **empty window** ("No spans in this window; last span received …"). Never a cartoon. | `data-state="empty-nodata\|empty-nomatch\|empty-window"` |
| Error | Problem `title`+`detail`, `code`-specific copy, request correlation hint, **Retry** button, stale data kept dimmed *only* if prior success (labelled "Showing data from 12:03:07") | `data-state="error"` |
| Partial | Data present but caveats: incomplete trace, estimate duration, insufficient samples, clock skew, truncated attributes, late arrivals; each as an inline notice with icon+text | `data-state="partial"` |

Problem-code → copy: `invalid_parameter`/`window_too_large`/`cursor_*` → "This view's link has invalid settings" + reset; `unauthorized` → session-expired view; `forbidden` → read-only notice; `not_found` → route 404 variant; `query_timeout` → "Query took too long — narrow the time range" + retry; `storage_unavailable`/`internal` → "TRACEFLOW can't reach its database" + retry with `Retry-After` countdown.

**Test-ID scheme.** DOM: `data-testid="<route>.<region>[.<item>]"` (kebab-case, e.g. `traces.list.row`). Test cases (Playwright/Vitest): `UX-<route>-NN`, a11y `A11Y-<route>-NN`; e.g. `UX-TRACES-01`. Each route below lists case stems; numbered fully at M5.

**Keyboard baseline (all routes):** skip link → `main`; landmarks (banner, nav, main, complementary); roving focus inside composite widgets (table, tree, tablist) with `Tab` entering/leaving once; `Esc` closes overlay and returns focus to the trigger; no keyboard traps; `?` is *not* bound (no hidden shortcuts V1). Visible focus ring always.

**Mobile baseline (<768):** single column; filters in a sheet; tables become stacked rows; no hover-only affordance; waterfall time area gets inner scroll **and** tree-first default (see `/app/traces/[traceId]`).

---

## 1. Public editorial site

### `/` — Home
| Aspect | Spec |
| --- | --- |
| Regions | `nav` (wordmark, Docs, Demo, GitHub — only real links), `hero` (H1, 2 CTAs: Explore live demo → `/demo`, View GitHub → repo URL; trace-line illustration), `problem`, `journey` (interactive synthetic request journey), `features`, `walkthrough` (waterfall + map visuals), `architecture` (diagram → links `/docs/architecture`), `getting-started` (code sample + copy), `oss`, `faq`, `final-cta`, `footer` |
| Data | **No live API.** Build-time static JSON generated from the repository synthetic fixture (same data model as API `TraceDetail`); marked "Synthetic example". Hero line-draw derived from that trace. No numbers not present in the fixture. |
| States | Loading: content is static HTML, readable immediately (JS enhances). Empty: n/a. Error: if journey JS fails → static figure + text description. Partial: n/a. |
| Keyboard | Journey: steps are a `tablist` or button group (arrow keys), play/pause + "Skip animation" first in tab order inside hero; FAQ = disclosure buttons (`Enter/Space`); all CTAs real links. |
| Mobile | Illustration under headline, static after 1 play; journey becomes vertical stepper; FAQ full-width. |
| Reduced motion | No line-draw, no staged entry, no autoplay; journey advances only on user action (see `motion-spec.md`). |
| Test IDs | `home.hero`, `home.cta-demo`, `home.cta-github`, `home.journey.step`, `home.faq.item`; cases `UX-HOME-01..` link resolution, `A11Y-HOME-*`, reduced-motion screenshot, 5-viewport screenshots |

### `/docs` · `/docs/getting-started` · `/docs/instrumentation` · `/docs/architecture` · `/docs/deployment` · `/docs/security`
| Aspect | Spec |
| --- | --- |
| Regions | `docs-nav` (sidebar tree, version banner), `content` (MDX), `toc` ("On this page"), `prev-next`, `code` blocks with `copy-button`, `callout` |
| Data | Static MDX; versions from package metadata. `/docs/architecture` and `/docs/security` derive diagrams from ADR/threat-model text (content owner: docs; rendering: Sonnet). |
| States | Loading n/a (static). Error: 404 view for unknown slug. Empty n/a. Partial: "Version banner: docs for vX; newer exists" only if real. |
| Keyboard | Sidebar as `nav` list with `aria-current="page"`; TOC links anchor-scroll and move focus to heading; copy button announces "Copied" via live region; code blocks `tabindex=0` when scrollable. |
| Mobile | Sidebar → disclosure at top ("Docs menu"); TOC collapses to `<details>`. |
| Test IDs | `docs.nav`, `docs.toc`, `docs.code.copy`; cases `UX-DOCS-01` (every link resolves — link checker), `UX-DOCS-02` copy, `A11Y-DOCS-*`. Doc *content correctness* (installation actually works) is the DEPLOY-01 gate, not this matrix. |

### `/login`
| Aspect | Spec |
| --- | --- |
| Regions | `signin-card` (GitHub button), `status` (live region), `notice` (denied/error/session-expired), `return-path` (hidden, validated same-origin relative path starting `/app`) |
| Data | No trace-api. BFF auth routes (ADR-0005). Profile `local-dev` shows "Local development — no sign-in required" button (guarded; not rendered in `operator-prod`). |
| States | Loading: button → "Redirecting to GitHub…" disabled, `aria-busy`. Empty n/a. Error: OAuth error / state mismatch / network → message + retry. Denied: "This GitHub account is not allowed on this deployment" (no account enumeration beyond that; no allowlist contents). Session expired: banner "Your session expired. Sign in to continue to <path>". Signed-out confirmation: "You have signed out." |
| Keyboard | Single primary action; focus lands on `h1` on load of error/denied state; Enter activates. |
| Mobile | Centered card, 44 px button. |
| Test IDs | `login.github-button`, `login.notice`; cases `AUTH-01/02` E2E incl. back/forward after logout shows no private DOM, open-redirect rejection. |

### `/demo`
| Aspect | Spec |
| --- | --- |
| Regions | `demo-banner` (violet, persistent: "Synthetic data — read-only demo. No real traffic."), shell as `/app` but nav limited to: Overview (this page), Traces (inline section), Services (inline section); **no** settings/onboarding/map link unless the public-demo profile serves them (decided: ingestion status and settings are 404 in public-demo, ✔R-17). `overview` panels, `traces` list+filters, `service` quick-investigation. |
| Data | Same operationIds as app, served by public-demo BFF against the synthetic deployment: `getOverview`, `listTraces`, `listServices`, `getService`, `getServerLatency`. `updateSettings` never called (403 in profile). |
| States | As `/app` + default windows work: demo data is re-stamped hourly relative to now (✔R-16 decision (a)); if the job is stale the standard empty-window state applies. |
| Keyboard / Mobile | As `/app`, `/app/traces`. |
| Test IDs | `demo.banner`, `demo.overview.*`, `demo.traces.*`; cases `DEMO-01` isolation (no private creds/network path) E2E, `UX-DEMO-*`. |

### `/demo/traces/[traceId]`
Identical regions/states/keyboard to `/app/traces/[traceId]` (shared component), plus `demo-banner`; breadcrumb root "Demo". Invalid `traceId` format (not 32 lowercase hex) → client-side 404 view without API call. Test: `UX-DEMO-TRACE-*`, deep link works after refresh without auth.

---

## 2. Authenticated application (`/app/*`)

### `/app` — Overview
| Aspect | Spec |
| --- | --- |
| Regions | `scope-bar` (time range, service scope), `health` (ingestion health + caveat), `kpi` (requests, error rate, p50/p95/p99, trace count), `latency-chart`, `error-chart`, `throughput-chart`, `top-services` (relevant services table), `recent-traces` |
| Data | `getOverview(from,to,service?)` → `totals: ServerStats` (`request_count, error_count, error_fraction, latency.{p50,p95,p99}, population.{sample_count,note}, exemplars?`), `trace_count` (now required), `top_services[]` (ranked by request_count desc, name asc), `top_services[]: ServiceSummary`, `recent_traces[]: TraceSummary`, `freshness.{generated_at,last_span_received_at}`. Charts: `getServerLatency(from,to,service?,bucket_seconds)` → `points[].{bucket_start_unix_nano, partial, stats: BucketStats\|null}` (BucketStats = `sample_count, request_count, error_count, error_fraction, latency`; population only on `overall`), `overall`, `freshness`; series is dense and capped at 2 000 points (UI uses ≤ 288). Last bucket with `partial=true` drawn hatched + labelled "still filling", excluded from line. Throughput = `request_count / bucket_seconds`. Health: `getIngestionStatus(from,to)` → `spans_received/accepted/duplicate/rejected/conflict`, `requests{status:count}`, `last_request_at`, `freshness`. **`/demo` does not call `getIngestionStatus` (404 in public-demo): the `health` region is omitted there**, replaced by the synthetic banner. KPI "worst-case" links use `totals.exemplars` (`slowest_trace_id`+`slowest_span_id` → `/app/traces/[id]?span=…`, `latest_error_*` likewise); null → link hidden, not disabled. |
| Bucket rule | UI picks `bucket_seconds` so ≤ ~300 points: ≤1h→60 (≤60 pts), ≤6h→300 (≤72), ≤24h→300 (≤288), ≤7d→3600 (≤168); `bucket_seconds` is an enum so these are the only values used. |
| Polling | `getOverview` every 5 s while visible; series + ingestion every 30 s; abort previous in-flight; pause hidden; "paused" indicator. |
| Loading | KPI/chart/table skeletons; keep prior values dimmed during refresh (no flash). |
| Empty | No data ever (`last_request_at` null) → onboarding CTA; empty window → "No spans between X and Y". |
| Error | Per-panel error (a failing chart does not blank KPIs). |
| Partial | `Percentiles` null → "needs N samples (n=…)" not 0; `error_fraction` null → "—"; gaps for null buckets; `population.note` under every aggregate; badge "≈ estimate" where duration basis estimate (recent traces). |
| Keyboard | KPI cards are not interactive; charts: focusable plot with arrow-key point navigation announcing value+time (see a11y matrix); top-services is a sortable table; rows link to `/app/services/[name]`; recent-trace rows link to trace. |
| Mobile | KPIs 2×2, charts full-width with "View as table" toggle default off but present; tables → stacked rows. |
| Test IDs | `overview.kpi.*`, `overview.chart.latency`, `overview.top-services.row`, `overview.recent-traces.row`, `overview.freshness`; cases `UX-OVERVIEW-*` vs reference fixture (**data oracle owned by Opus: AC-DATA-03**), journey J-02 start. |

### `/app/onboarding`
| Aspect | Spec |
| --- | --- |
| Regions | `quickstart` (steps), `collector-config` (copyable YAML — static), `connection-status`, `first-trace` guided journey, `troubleshooting` |
| Data | `getIngestionStatus(from=now−15m,to=now)` polled 3 s while the page is visible and no span ever seen; `spans_accepted>0` → success state; first-trace link = `latest_trace_id` ✔R-12 (null → no link); `first_span_received_at` distinguishes "never" from "quiet now". |
| States | Waiting ("No data yet — listening"), connected ("Received N spans at 12:03:07"), errors by `reject_reasons` keyed by enum `RejectReason` (`invalid_id, invalid_timestamp, invalid_span, conflicting_replay, trace_span_limit`; unknown key → generic text) (map known reasons → advice), `requests["4xx/5xx"]` shown with text; collector-side drops caveat text. API unavailable → Error + retry. |
| Keyboard | Steps are an ordered list; copy buttons; status region polite live updates (announce transitions only, not each poll). |
| Mobile | Single column; YAML scroll inner. |
| Test IDs | `onboarding.config.copy`, `onboarding.status`; cases `UX-ONBOARD-*`, DEPLOY-01 first-run (clean compose). |

### `/app/traces`
| Aspect | Spec |
| --- | --- |
| Regions | `filters` (time range, service selector, status, min duration; chips; clear), `list` (accessible sortable table), `pager` (cursor), `result-meta` ("50 traces · newest first · 12:00–13:00 UTC") |
| Data | `listTraces(from,to,service?,status,min_duration_nano?,cursor?,limit=50)` → `items[]: TraceSummary` (`trace_id, start_unix_nano, duration.{value_nano,basis}, root{service_name,name}\|null, span_count, error_span_count, service_names[], completeness.{root_count,orphan_count,has_clock_skew}`), `next_cursor`, `freshness`. `status=error` ⇔ `error_span_count>0`; `service` = "traces involving this service" (any span) — chip/label copy uses that wording. `service_names` capped at 50 with `service_count` → "+N" chip uses `service_count − shown`. Service selector options from `listServices`. |
| Columns | Start (UTC/local), Root operation (`root` null → "root not received" + warning icon), Services (chips, +N), Duration (`≈` prefix when `observed_range_estimate`; negative duration → "clock skew"), Spans, Errors (icon + count), Status badge (Error if `error_span_count>0`, else OK), Completeness badge. |
| Sorting | Server order is fixed (start desc, id desc, per ADR-0004). **Column sorting is only across the loaded page and labelled "sorted within loaded rows"** (do not imply global sort; accepted limitation ✔R-9). |
| Paging | "Load more" appends next page (preserve focus on first new row; announce "50 more traces loaded"); cursor kept out of shareable URLs (stateless, no lifetime ✔R-10; deep links land on page 1). Max 200 rows rendered before virtualization decision (measure >200, spec §9.4). |
| States | Loading skeleton rows; empty-nodata/empty-nomatch (chips + clear)/empty-window; error + retry; partial rows flagged individually. |
| Keyboard | Filters first in tab order; table is a native `<table>` with sortable `<button>` headers (`aria-sort`); each row's trace ID cell is the single link (row click is a progressive enhancement, not the only path); `Enter` opens trace. |
| Mobile | Filter drawer; rows stack to: root op / services / duration · errors · time; same link. |
| Test IDs | `traces.filters.*`, `traces.list`, `traces.list.row`, `traces.pager.more`; cases `UX-TRACES-01` URL deep-link, `-02` filter sync, `-03` clear, `-04` paging no dup/skip (**AC-API-02**), `-05` states. |

### `/app/traces/[traceId]`
| Aspect | Spec |
| --- | --- |
| Regions | `header` (trace ID + copy, root op, start/end, duration (+basis), status, span/service counts, `freshness`, provenance text "Observed spans; sampling not reconstructed"), `notices` (missing-parent, multi-root, clock-skew, late-arrival "may change", truncated), `view-toggle` (Waterfall · Tree · Table), `waterfall` (time axis, rows, bars), `tree` (collapsible parent/child), `inspector` (focused span: IDs, kind, status+message, timestamps+duration, service/resource/scope, attributes, events, links, dropped counts, quality flags), `raw-json` (when implemented — **not rendered until it exists**) |
| Data | `getTrace(traceId, detail=full\|lite)` (+`getSpan(traceId, spanId)` for the focused span in lite mode) → `summary`, `detail`, `truncation` (`{spans_total, spans_returned}`\|null), `spans[]` (`span_id, parent_span_id, parent_present, name, kind, start/end_unix_nano, duration_nano (signed), status.{code,message}, service_name, resource_ref→resources[], scope_ref→scopes[], `attribute_count, event_count, link_count` (always present), `attributes[], events[], links[]` (**full mode only**; absent in lite), dropped, quality.{negative_duration,zero_duration,truncated}`), `resources[]`, `scopes[]`, `freshness`. Cross-trace link targets (`links[].trace_id`) → `/app/traces/[id]` (may 404 — handled). |
| Derived (client) | Tree from `parent_span_id`; orphans (`parent_present=false`) placed under a synthetic **"Parent span not received"** group at root level, never merged under invented parents; multi-root traces show each root. Depth, self-time **not shown** (not in API; would be inference). Time axis = [min start, max end] of non-negative-duration spans (negative durations excluded from scaling and drawn as a fixed-width marker with "clock skew"). |
| Waterfall rules | Axis labels with units and ticks; bar min width 2 px; concurrent spans on separate rows; zero-duration = 2 px tick with label; error = error fill + ✕ icon + 2 px border; selected = outline + `signal-tint` row; **axis never rescales while the user has a span focused**; late-arrival refresh (poll 10 s only while page visible and `last_received_at` changing within 60 s) updates data in place with a "Trace updated · +3 spans" indicator and does not move the viewport/focus. |
| States | Loading skeleton waterfall; **404** (single meaning ✔R-8) → "Trace not found. It may not have arrived yet, may be outside retention, or the ID is wrong." + retry + back; Error; Partial = notices above. **Lite mode** (client threshold TBD at M4, starting guess ~1 000 spans): waterfall/tree built from lite spans; inspector calls `getSpan` on selection (loading/error state inside the inspector; counts show "3 events" before load). `truncation` non-null → persistent banner "Showing N of M spans (response cap)" and trace marked partial. Very large (> 5 000 spans, **measure at M4**): default to Tree, windowed rendering, banner "Large trace (N spans)"; 50 000 hard cap acknowledged by API (✔R-1). |
| Keyboard | Roving tabindex on the tree/waterfall rows (single `Tab` stop): `↑/↓` move, `→` expand / enter children, `←` collapse / go to parent, `Home/End` first/last, `Enter`/`Space` focus-select span (opens inspector), `Esc` closes inspector (mobile sheet), `e`/`E` **not** bound. `Tab` from list goes to inspector then page. Waterfall and tree share the same selection and URL `span=`. Copy buttons for trace/span IDs. Jump "next error span" button (real button, not hidden shortcut). |
| Mobile | Default view **Tree**; waterfall shown as horizontal inner scroll with sticky label column; inspector as bottom sheet (focus-managed, `Esc`/close button, returns focus to row). |
| Test IDs | `trace.header`, `trace.notice.*`, `trace.waterfall.row`, `trace.tree.node`, `trace.inspector`, `trace.copy-id`; cases `UX-TRACE-01` **golden waterfall comparison vs reference fixture**, `-02` keyboard-only find-error-span (J-03), `-03` missing-parent labelling, `-04` clock skew, `-05` late refresh stability, `-06` 5k-span perf (M4). |

### `/app/services`
| Aspect | Spec |
| --- | --- |
| Regions | `scope-bar`, `search` (client-side filter on name; `q=`), `table` (sortable), `caveat` |
| Data | `listServices(from,to)` → `services[]: ServiceSummary` (`service_name, last_observed_unix_nano, observed_in_window, sample_error_trace_ids[≤3], server{request_count,error_count,error_fraction,latency.{p50,p95,p99},population}`) ≤ 1000 rows, `freshness`. Services with `population.sample_count=0` (no SERVER spans) shown "no server spans" instead of zeros; `observed_in_window=false` → muted "idle in window". |
| Columns | Service, Requests, Error rate (+ counts), p50, p95, p99 (null → "n<20"), Last observed. Each aggregate cell has `title`/inline "n=…" via the row details; header `population.note` shown once under the table, plus per-row `sample_count` column (hideable on mobile). |
| States | Standard four. Empty-nomatch for search. |
| Keyboard | Sortable headers via buttons (`aria-sort`); service name is the link; `/` focuses search **not bound**—search is a normal tab stop. |
| Mobile | Stacked card rows: name, req · err% · p95, last observed. |
| Test IDs | `services.search`, `services.table.row`; cases `UX-SERVICES-*` population/math (**AC-DATA-03 oracle**). |

### `/app/services/[serviceName]`
| Aspect | Spec |
| --- | --- |
| Regions | `identity` (name, last observed, window), `summary` (KPIs), `latency-chart`, `operations` (table), `downstream` / `upstream` (edge tables with evidence), `traces` (recent + deep link "Open filtered trace list" → `/app/traces?service=…`) |
| Data | `getService(serviceName,from,to)` → `service`, `operations[].{name,server}`, `downstream[]`, `upstream[]`: `DependencyEdge` (`source,target,evidence.{basis,parent_child_pairs,error_pairs,trace_count,sample_trace_ids,first/last_seen}`), `recent_traces[]`. Chart: `getServerLatency(service=…)`. Operation drill: `getServerLatency(service,operation)` on row expand. |
| Notes | `serviceName` may contain any Unicode/slashes: URL-encode, never trust in DOM sinks. Known-but-idle (200, `service.observed_in_window=false`) → page renders zero-state notice "No spans from this service in this window" + widen-window link; **404 = never observed in retained data** → "No such service" (✔R-8). Slow/error evidence links: `server.exemplars`, `operations[].server.exemplars`, `sample_error_trace_ids` → trace deep links with `span=`. |
| Edge evidence copy | basis `client_server_parent_child` → "Verified: client span in A → server span in B"; `other_parent_child` → "Observed parent→child across services (no client/server pair)". Sample trace IDs are links. |
| Keyboard / Mobile | Tables as `/app/services`; operation rows expandable (disclosure button); chart toggle to table. |
| Test IDs | `service.summary`, `service.operations.row`, `service.edges.row`; cases `UX-SERVICE-*` API filters + E2E (J-02 slow service → trace). |

### `/app/map`
| Aspect | Spec |
| --- | --- |
| Regions | `controls` (zoom in/out, pan arrows, fit, reset, time range), `graph` (observed-only), `legend` (what node/edge encodings mean), `details` (selected node/edge evidence), `edge-table` (**always rendered**, canonical accessible representation), `caveat` ("Edges only from observed parent→child spans; absence of an edge is not proof of no dependency") |
| Data | `getDependencies(from,to)` → `nodes[]: ServiceSummary`, `edges[]: DependencyEdge` (≤ 500 / ≤ 5 000), `freshness`. Invariant (✔R-13): every edge endpoint is in `nodes`; non-SERVER-only nodes have `sample_count=0` → drawn without stats ("no server spans"). |
| Encoding | Node = service (label always visible), border thickness by request volume bucket (never colour alone), error nodes get ✕ badge when `error_fraction>0` threshold-free "has errors" (no invented threshold: show fraction). Edge direction arrow; width by `trace_count` (log scale, legend); dashed when `basis=other_parent_child`; error edges ✕ marker from `error_pairs>0`. Layout deterministic (layered, left→right), **settles instantly; no perpetual animation**; hover subtle highlight only. |
| Edge table columns | Source, Target, Basis, Traces, Parent-child pairs, Errors, First seen, Last seen, Sample traces (links). Sortable, filterable by service, selecting a row selects the edge in the graph and vice-versa. |
| States | Empty: no edges → "No cross-service parent→child spans observed in this window" (+ nodes list if any). Large (> 50 nodes): default to table with "Show graph anyway". Error/Partial: freshness + truncated at limits. |
| Keyboard | Graph is one composite widget: `Tab` enters; arrows move node focus to nearest neighbor in direction; `Enter` selects (details); `+/-/0` zoom/reset **only when graph focused** and also available as buttons; `Esc` clears selection. Edge table fully independent. Never required: pointer drag. |
| Mobile | Graph hidden by default (below 768): show edge table + node list ("Mobile alternative", spec §10); "Show graph" optional pinch/pan with buttons. |
| Test IDs | `map.graph`, `map.node`, `map.edge`, `map.edge-table.row`, `map.details`; cases `UX-MAP-01` graph fixture, `-02` keyboard alternative (J-04), `-03` selecting edge → supporting traces link. |

### `/app/analytics`
| Aspect | Spec |
| --- | --- |
| Regions | `scope-bar` (time range, service, operation, bucket), `compare` (previous period toggle), `latency-series`, `distribution`, `percentile-summary`, `error-breakdown`, `sample-counts`, `source-label` ("Source: observed SERVER spans · sampled data not reconstructed") |
| Data | `getServerLatency(from,to,service?,operation?,bucket_seconds)` → `points[]`, `overall`. Compare = second call with window shifted by its own length (client-side; two calls, same bucket). Percentile summary from `overall.latency`. Latency distribution: `getLatencyDistribution(from,to,service?,operation?)` → `buckets[].{lower_nano, upper_nano\|null, count}` (fixed boundaries, ≈25, last open-ended; render from returned bounds, never hard-code), `population`, `excluded_negative_duration` (shown as note), `freshness` ✔R-3. Error breakdown: per-service from `listServices` (`error_count/error_fraction`, `sample_error_trace_ids`), per-operation from `getService.operations[]` for the selected service ✔R-4. Series `points[].partial` and BucketStats as in `/app`. |
| Chart semantics | Title states measure, unit, window, population (`n=…`); null stats → gaps (no interpolation); percentile lines drawn only when value non-null; tooltip never the only carrier (table toggle provides every value); partial last bucket flagged via `partial` ✔R-6. |
| States | Standard; insufficient samples state: "p95 needs 20 samples; this window has 12". |
| Keyboard / Mobile | Chart plot: arrow keys step points, `Home/End`; "View as table" toggle (button, `aria-pressed`); mobile default shows chart + table disclosure. |
| Test IDs | `analytics.series`, `analytics.table`, `analytics.compare`; cases `UX-ANALYTICS-*` **query oracle (AC-DATA-03)**, chart label tests. |

### `/app/settings`
| Aspect | Spec |
| --- | --- |
| Regions | `retention` (days field, last retention run), `auth-status` (deployment profile, signed-in operator display name/ID from BFF session — not from trace-api), `limits` (read-only list), `preferences` (timezone UTC/local; reduced-data? **only real prefs**: timezone, time-format), `ingestion` summary (`getIngestionStatus`) |
| Data | `getSettings` → `generated_at, profile, read_only, retention_days, next_retention_run, last_retention_run{finished_at,traces_deleted,spans_deleted,status}\|null, limits{…}`; `updateSettings` PATCH `{retention_days}` (BFF adds actor header). Preferences = browser-local (`localStorage`, no private data). |
| Sensitive change | Lowering retention opens confirm dialog: "Spans older than N days will be deleted at the next retention run. This cannot be undone." No impact estimate (dry-run declined for V1, R-7): dialog states irreversibility and `next_retention_run`. Confirm button labelled with the action ("Reduce retention to 7 days"); Cancel default focus. Inline validation: integer 1–90; server error `invalid_parameter` mapped to field (`Problem.errors[]` `{field, code, message}` ✔R-5; message is plain text, rendered as text). Success toast + inline persisted value + audit note "Recorded in the audit log". |
| States | `read_only=true` → no edit controls + explanatory notice (✔R-14; in public-demo this route is 404 and not linked, ✔R-17), PATCH 403 handled → "Not available in this deployment". Error/partial: failed last retention run → warning with status `failed|partial`. |
| Keyboard / Mobile | Standard form: label+help text+error linked by `aria-describedby`; dialog traps focus and restores; mobile full-width form. |
| Test IDs | `settings.retention.input`, `settings.retention.save`, `settings.confirm`; cases `AUTH-*` access control, `UX-SETTINGS-*` mutation + audit (integration with backend). |

---

## 3. System views (not routes in nav)
| View | Trigger | Content |
| --- | --- | --- |
| 404 | Unknown route / invalid ID format | Original illustration (broken signal path), search-free, links to `/`, `/docs`, and `/app` (if session) |
| 500 | Unhandled render/BFF error | "Something broke on our side", correlation hint (no internals), retry, link home |
| Session expired | `unauthorized` from BFF on any `/app/*` | Full-page notice, preserves path, → `/login?returnTo=` ; clears private DOM first |
Test IDs: `system.404`, `system.500`, `system.session-expired`; cases `AUTH-02`, `UX-SYS-*`.

## 4. Coverage check (spec §8 ↔ this matrix)
Public: `/`, `/docs`, `/docs/getting-started`, `/docs/instrumentation`, `/docs/architecture`, `/docs/deployment`, `/docs/security`, `/login`, `/demo`, `/demo/traces/[traceId]` = 10/10. App: `/app`, `/app/onboarding`, `/app/traces`, `/app/traces/[traceId]`, `/app/services`, `/app/services/[serviceName]`, `/app/map`, `/app/analytics`, `/app/settings` = 9/9. Every operationId in `openapi.yaml` is consumed: `getLiveness/getReadiness` (BFF-only health proxy, no UI route; **not consumed by browser**), `getOverview`, `listTraces`, `getTrace`, `getSpan`, `getLatencyDistribution`, `listServices`, `getService`, `getDependencies`, `getServerLatency`, `getIngestionStatus`, `getSettings`, `updateSettings`.

## 5. M5 implementation deltas (2026-11-23, `apps/web` on `m5-ui`)

The matrix above stays the design intent. Where the first implementation differs, it is listed here so reviewers do not mistake a gap for a pass.

| Area | Matrix says | Implemented in M5 | Follow-up |
| --- | --- | --- | --- |
| Time range | presets plus absolute `from`/`to`, `tz=utc\|local` | presets only (`15m…7d`), UTC only | absolute range and `tz` need a client picker |
| Service scope | ARIA combobox | native `<select>` in a GET form (works without JS) | revisit if > ~50 services |
| Polling | overview polls every 5 s automatically | opt-in "Auto-refresh" checkbox (visibility-aware, never overlapping); onboarding polls 3 s while waiting; trace page polls 10 s only while spans are still arriving | decide default once load is measured |
| Trace inspector | bottom sheet < 768 px | inline panel at every width | sheet if usability testing asks for it |
| Trace default view | Tree on mobile | Waterfall everywhere (inner scroll); large traces (> 5 000 spans) open as a collapsed Tree | tree-first on mobile |
| Large traces | windowed rendering, measured | collapsed tree + banner; lite payload above 1 000 spans (initial guess); **not measured on real large traces** | generate a 5 000-span trace and measure |
| Map | pan/zoom with buttons; pointer drag never required | buttons and keyboard only (no pointer drag yet) | optional drag |
| Settings preferences | timezone, time format | omitted (only UTC exists; a control that does nothing would be a phantom feature) | with `tz=local` |
| `raw-json` region | not rendered until it exists | not rendered | — |
| HTTP status of not-found states | 404 view | invalid trace ID → 404 view (HTTP 200 because the response streams); unknown service/trace → in-page not-found state | — |
| Public site (`/`), `/docs/**`, `/demo`, `/demo/traces/[traceId]` | in scope of the matrix | **built in M5b** (see below); `/login` **not built** (lands with sign-in in M6, no link points to it) | — |
| `/` journey | interactive journey with steps | five tabs, one per demo scenario (normal, slow, error, parallel, missing-parent), each a real captured trace shape; no autoplay | — |
| `/` hero | skip first in tab order | "Skip animation" is the first focusable control inside the hero (top-right); line-draw is the bar reveal of the real `normal` trace (≈0.8 s once); off for reduced motion | — |
| `/` header/CTA under `operator-prod` | — | Demo link and "Explore live demo" CTA are not rendered when the profile does not serve `/demo` (a "Read the docs" CTA replaces it) | — |
| `/demo` | overview, traces and service quick-investigation | one page with three sections (`#overview`, `#services`, `#traces`) plus an inline `?service=` investigation; the service map is not part of the demo (`/demo/map` does not exist) | map in demo if wanted |
| `/docs` rendering | static MDX | TSX pages, rendered per request (the header depends on the profile); copy buttons; no MDX or syntax highlighter | static export later |

Verified in M5 (real stack): J-02, J-03 (keyboard only), J-04, axe WCAG 2.2 A/AA on all nine app views including trace detail with inspector/tree/table open, 375 px reflow on every app route. See `docs/workflow/integration-log.md` M5-E. M5b adds axe (WCAG 2.2 A/AA) on `/`, `/docs/**`, `/demo` and the demo trace page, 375 px reflow on all of them, and the profile 404 rules.
