# TRACEFLOW — Final Audited Implementation Master Prompt (V2)

**Project:** TRACEFLOW — distributed tracing and observability platform  
**Repository:** https://github.com/Sendiw14/Traceflow  
**Specification date:** 17 November 2026  
**Authority:** When adopted by the repository owner, this document supersedes `TRACEFLOW_FINAL_INTEGRATED_MASTER_PROMPT.md`, `TRACEFLOW_FINAL_AUDITED_MASTER_PROMPT.md`, and `TRACEFLOW_MULTI_MODEL_WORKFLOW.md` **for implementation instructions**. The prior quality audit is historical evidence, not an alternative set of commands.  
**Readiness:** AUDITED IMPLEMENTATION BASELINE CANDIDATE, ready for M0/M1 planning after owner adoption, **NOT** certified production-ready. The unbuilt software must pass every gate.  
**Design intent:** Exceptional, original, white-first editorial product website plus a highly usable diagnostics workspace.

## 0. Execution contract — mandatory

Act as a small, coordinated team: product lead, OpenTelemetry specialist, staff Go/backend engineer, data engineer, creative frontend engineer, accessibility designer, security reviewer, SRE, test engineer, and technical writer. Deliver **one working, trustworthy product**, not an aspirational prototype or a collection of unrelated demos.

1. **Inspect first.** Read the actual GitHub repository, existing branches/commits, project files, constraints, CI, and tools. Last checked, the repository was empty; recheck. Do not overwrite or delete unreviewed work.
2. **Evidence before claims.** Never state a feature is complete because code was generated or a dashboard looks plausible. Report actual code paths, commands, outputs, screenshots, trace data, test reports, deployed URL and remaining risks. Use `PASS`, `FAIL`, `NOT TESTED`, or `BLOCKED`.
3. **One scope.** When adopted by the owner, treat this document as the canonical product/technical specification. ADRs elaborate approved decisions; an ADR cannot silently override V1 commitments, security requirements, or protocol standards. All scope changes require change-control records.
4. **Spec then code.** Complete M0 requirements and M1 architecture, contracts, design specification, data model and security threat model before major feature development. Scaffold and validate dev tooling only when prerequisites are clear.
5. **Non-destructive progress.** Independently solve routine choices within approved constraints. Obtain explicit human approval for paid resources, production exposure, destructive migrations, material scope changes, public release, and exceptions to critical/high risks.
6. **Authentic technical scope.** Production functionality must use genuine instrumented OpenTelemetry traces. Static fixtures are permitted in automated tests and the clearly labeled public demo only. Never pass static mock output off as functioning private telemetry.
7. **Resist fashionable complexity.** Do not add Kubernetes, Redis, Kafka, ClickHouse, agentic AI, 3D, extra animation libraries or a full metrics/logs platform without a measured requirement and ADR.
8. **Create readable, maintained outputs.** Strict types, contracts, modular packages, testable functions, clear docs, version pins, no secret exposure, conventional Git history, reviewer evidence and reproducible workflows.

## 1. Product requirements and success definition

### 1.1 Product
**TRACEFLOW** — *Every request has a story. See the whole picture.*  
A self-hostable, open-source tool that helps developers inspect a request's journey across services and discover where latency and errors originate.

### 1.2 Personas
- **Application engineer:** discovers failing or slow requests and traces them across APIs, services and database calls.
- **SRE / backend engineer:** compares observed latencies and errors, evaluates service dependencies, diagnoses incidents and ingestion health.
- **Learning / evaluator user:** starts a reproducible three-service demo, triggers normal/slow/error scenarios and follows the evidence through the UI.

### 1.3 Primary journeys
J-01 Setup → run `docker compose up` → generate real trace → find it in TRACEFLOW.  
J-02 Observe slow service → filter affected requests → open trace → focus slow span → inspect attributes/events.  
J-03 Investigate error → identify failing span → navigate parent/child context → explain probable failure from *recorded evidence*, not invented analysis.  
J-04 Open service map → select verified dependency edge → inspect supporting traces.  
J-05 Visit public read-only demo → investigate clearly synthetic traces → never gain private data access.  
J-06 Authenticate hosted operator → navigate private deep link → sign out → verify private data is inaccessible.

Success is validated by end-to-end task completion and correct telemetry, not by beautiful screenshots alone. Conduct usability sessions with at least three test participants on these scenarios; record errors, task outcome and time to locate the relevant span, then correct critical UX blockers. This is a qualitative acceptance exercise, not a statistically representative study.

### 1.4 V1 required functionality
- Single-server local stack with three real instrumented demo services; deterministic normal, slow, error, parallel and missing-parent scenarios.
- OTLP/HTTP **binary Protobuf traces**, via pinned OpenTelemetry Collector → protected Go receiver → PostgreSQL; interoperable error/retry behavior.
- Correct persistence of trace/span IDs, parent IDs, span kind, start/end, status, attributes, resource and instrumentation scope, events, links and metadata/version fields as supported.
- Idempotent ingest; bounded request and resource handling; incomplete/out-of-order/late spans; replay conflict policy; retention and operations visibility.
- Overview, trace search with URL-persistent filters/cursor pagination, trace waterfall/tree/detail, services, service map, trace-derived analytics, onboarding and settings.
- Accessible, responsive white-first product/site/design system; robust loading/empty/error/partial-data states; restrained purposeful motion.
- Secure single-operator **hosted private** access and separately deployed public **synthetic-only, read-only** demonstration.
- Documentation, API contracts, CI, migrations, automated and manual QA, benchmark/operational reports, backup/restore, pinned deployment and release artifacts.

### 1.5 Explicit V1 exclusions
Do NOT implement full metrics or log signal storage, AI root-cause analysis, alerting, multi-user/multi-organization tenancy, billing, shared-edit collaboration, hosted enterprise HA/SLA, mobile native apps, arbitrary query language, Kubernetes, or data warehouse-scale historical retention. Label future features V2+, but do not ship clickable inert navigation entries.

### 1.6 Nonfunctional requirements
- Data truthfulness: observed/sample-biased information must be labeled; missing spans, clock skew, and partial traces must be visible.
- Privacy: do not persist request bodies, credentials or personal data by default. Redaction happens **before persistence**.
- Security: public routes cannot reach private telemetry; no unprotected OTLP receiver on public network.
- Accessibility: target **WCAG 2.2 AA** including accessible alternatives to chart and graph interactions; manual evaluation required.
- Performance: explicit reproducible test loads, device/network profiles and measured results—not unqualified speed promises.
- Reliability: bounded queues, timeouts, backpressure, error accounting, retention, backup/restore runbooks and stated RPO/RTO targets once an operating profile is selected.
- Maintainability: strict conventions, stable public interfaces, ADRs, dependency update policy, regression tests and a documented migration story.

## 2. Major architectural decisions (proposed default; validate at M1)

**Choose a modular monolith, not a bespoke microservice mesh for TRACEFLOW itself.**

```
Instrumented demo services (gateway → orders → inventory)
    → OpenTelemetry SDKs, OTLP/HTTP inside Docker network
    → OpenTelemetry Collector: receiver, redaction, bounded exporter queue/batch
    → internal Go OTLP/HTTP ingestion service
    → PostgreSQL durable trace/span storage + trace-summary maintenance
    → internal Go query/analytics API
    → Next.js server-side BFF (authZ, no-store responses)
    → browser: overview, traces, waterfall, dependency map, analytics
```

- `apps/web`: Next.js App Router for editorial site, docs and dashboard; server-side BFF for protected queries and only client-side islands for graph/chart interactions.
- `services/trace-api`: single Go process, split into cohesive packages: ingest, validation, normalization, storage, query, analytics, topology, authorization and operations.
- `examples/demo-system`: three instrumented services with repeatable request scenarios and cross-service context propagation.
- `infra/otel`: pinned Collector, no deprecated batch processor; compatible exporter-level `sending_queue.batch` where supported.
- `infra/caddy`: HTTPS reverse proxy; Compose for reproducible local and single-server deployments.
- `api/openapi.yaml`: authoritative **app query API** contract; OTLP receiver conforms independently to official OpenTelemetry Protobuf/spec.
- `services/trace-api/db`: SQL migrations, generated queries if compatible, indexes, retention jobs.

**Deployment profiles are explicitly distinct:**
1. `local-dev`: loopback or private-network-only stack, synthetic demo services, no external credential dependence; development bypasses must be guarded against accidental production use.
2. `operator-prod`: private operational data, GitHub OAuth with immutable allowlisted GitHub account ID, secure sessions, TLS, private API/DB/Collector network and authenticated user paths.
3. `public-demo`: a **separate deployment** with synthetic data only, separate DB and credentials, read-only query pathway, no private DB connections, no user-supplied ingestion and no administrative actions. Public demo must be safe even if it is the only deployment made public.

Do not simply toggle an untrusted query parameter to turn a private app into a demo. Test all cross-profile permission and data-leak paths.

## 3. Current technology baseline and compatibility gates

Document **exact tested patch versions** at M0/M1 in `docs/architecture/compatibility-matrix.md`; store a support/upgrade owner, last security check and license. Re-check immediately before deployment. Do not interpret the versions below as evidence of successful installation.

| Layer | Preferred supported choice as of 17 Nov 2026 | Fallback / decision rule |
| --- | --- | --- |
| Next.js | Patched 16.x Active LTS; official 16.4.6 published Nov 9 | Select latest patched 16.x at install; retest private data caching and BFF responses |
| React | Compatible patched 19.3.x | Follow supported Next.js peer ranges |
| TypeScript | 7.0 stable **if** Next.js, editor, ESLint, generator and build pass | Patched 6.x with recorded upgrade ticket if toolchain incompatible |
| Node.js | Supported patched 26.x LTS | Verify container image and all toolchain compatibility |
| Go | Patched 1.27.x; 1.27.4 published Nov 10 | Verify official releases and Go module constraints |
| PostgreSQL | 18.7 stable | Avoid 19 RC for V1 |
| Tailwind | Compatible 4.x, CSS-first variables | Do not copy deprecated v3 configuration blindly |
| OTLP | Stable OTLP trace specification + pinned compatible Protobuf artifacts | Explicit receiver interoperability tests |
| Collector | Stable pinned compatible build with supported queue/batching | Avoid deprecated `batch` processor; verify actual exporter config |
| UI charts/topology | ECharts, React Flow, accessible unstyled primitives | Audit current package support, tree-shaking and licenses |
| Tooling | pnpm with lockfile; Vitest, Playwright, axe, Go test, pgx, sqlc if compatible | One consistent build/test stack |
| Deployment | Docker Compose, Caddy, GitHub Actions | Single-server operations with backups; no HA claim |

Selected libraries should be minimal and defensible; check official releases, changelogs, CVEs, license and peer dependencies. Prefer long-supported releases over experimental APIs. **Next.js build does not substitute for explicit linting**; run lint and typecheck in CI. Ensure dependency, container and secret scans are part of release evidence.

## 4. OTLP/HTTP protocol and ingestion contract (blocking)

Implement `POST /v1/traces` accepting binary `ExportTraceServiceRequest` Protobuf; support uncompressed and gzip requests. Require correct content type and response serialization. Scope exclusively to the trace signal in V1. Provide a version-pinned **golden fixture suite** with Collector and a separate reference SDK/client.

| Case | Required response / behavior | Must test |
| --- | --- | --- |
| Fully accepted or empty request | HTTP 200, serialized `ExportTraceServiceResponse` with `partial_success` unset | Decode actual bytes; empty request |
| Partially accepted | HTTP 200, same Protobuf response with nonzero rejected span count and explanatory message; caller does **not** retry partial response | Mixed fixture and response bytes |
| Invalid Protobuf/IDs/data | HTTP 400 and binary Protobuf `google.rpc.Status` | Nonretryability, no crash |
| Oversize compressed/decompressed payload | HTTP 413 as required; bounded memory/CPU and appropriate status encoding | Gzip bomb, byte cap |
| Resource throttling | HTTP 429 or 503, `Retry-After` where useful; Protobuf error body | Backoff and recovery |
| Gateway/temporary unavailable | Appropriate retryable 502/503/504; Protobuf status | Failure injection and retries |
| Duplicate identical spans | Idempotent; no duplicate analytical count | Repeated export |
| Conflicting replay of same span identity | Deterministic documented policy; no silent corruption | Mixed replay fixture |
| Late, orphaned, concurrent spans | Persist and report incomplete/provisional state; update summaries correctly | Fixture and waterfall |
| DB outage/commit error | Never return successful acceptance for data not committed by Go; bound transaction time | DB restart and failure |

**Precise retry codes:** OTLP/HTTP specifies 429, 502, 503 and 504 as retryable. Other 4xx/5xx responses are not generally retryable, so never reflexively use 500 for a recoverable storage outage. Partial success is not retried by conforming clients. Verify other transport and content negotiation rules against the pinned official spec.

Preserve 16-byte trace IDs, 8-byte span IDs, parent ID optionality, span kind/status, resource and instrumentation scope, schema URL, events, links and attribute limits. Store timestamps as signed/unsigned-safe nanosecond data in PG; serialize high-precision timestamps across JSON as decimal strings, **never unsafe JS numbers**. Define clock skew, negative/zero durations, schema-version differences and invalid data policies. Avoid synthetic links or fabricated spans.

**Acknowledgement boundary:** Go receiver returns success only after transaction commit; Collector may acknowledge upstream when admitting to its queue **before** the DB commits. Document this distinction. Configure explicit exporter queue, retry, backpressure, shutdown and persistent queue durability if chosen. Record delivered/rejected/dropped telemetry counts. State at-least-once/replay/duplication limitations; do not promise global exactly-once or zero-loss behavior.

**Collector migration:** OpenTelemetry announced deprecation of `batch` processor November 11, 2026, with proposed removal in May 2027. Use supported exporter-level batching via `sending_queue.batch` when available, verify in the selected Collector image/exporter; evaluate persistent queue storage, queue sizer and capacity. Ensure outgoing batch maximum is below the receiver's decompressed-byte limit, with safety margin. Test overflow under sustained load and on restart. Never paste undocumented queue settings from a different Collector release.

## 5. Data model, analytics, query and topology correctness

### 5.1 Data model and invariants
Define and migrate `traces`, `spans`, `span_events`, `span_links`, `resource/scope` metadata (normalized or JSONB with ADR), `ingestion_records`/operational counters, retention settings, and minimal authenticated access configuration. A **composite uniqueness key** `(workspace_id, trace_id, span_id)` supports replay handling; in V1 the operational workspace is singular. Index trace and service/time searches; avoid unbounded high-cardinality attribute indexes.

- Track raw observed span data and derived trace summaries separately; design the summary update transaction and late-span reconciliation.
- Identical replay must not double-count. Changed replay must be deterministic (e.g. quarantine/reject conflict with audit counter).
- Explicitly document behavior when parent is missing, roots are multiple, trace ID is invalid, producer clocks disagree, or sampling creates discontinuities.
- Include schema-version markers and forward-only, tested migrations. Backup before incompatible changes. Do not claim automatic database rollback is always safe.
- Define limits on span count, attributes, values, events/links, retention, query duration and output size.
- Distinguish data collected from SDKs from normalized fields derived by TRACEFLOW. Keep original data where permitted and useful.

### 5.2 Analytical definitions
- `trace_duration`: trusted root span duration **when present and valid**; otherwise an explicitly labeled observed min(start)→max(end) range, which is an estimate.
- `service_request_latency`: duration of **observed SERVER spans** for the selected service/operation/time window; exclude CLIENT/INTERNAL spans from this population unless specifically selected.
- `observed_throughput`: count of observed SERVER spans per time interval, annotated with sample count and sampling disclaimer; not total fleet request traffic.
- `error_fraction`: error SERVER spans / observed SERVER spans in the same scoped population, with sample size; unknown status distinguished from OK.
- `percentiles`: deterministic SQL/reference implementation, tested p50/p95/p99, documented interpolation/algorithm, units and sample counts; avoid presenting unreliable extreme quantiles for tiny samples.
- `service_edges`: derive only from verified parent-child service relationships or documented correlated CLIENT/SERVER semantics; preserve relationship evidence, confidence and time window. Missing linkage ≠ verified edge.
- Never sum overlapping span durations or treat missing spans as proof a service was healthy.

### 5.3 API contract requirements
The internal Go query API is documented in `api/openapi.yaml`; client generated from schema only. Validate response DTOs at the BFF boundary where appropriate. Standardize errors, cursor pagination, time filters, date precision, field naming, rate limits, query timeout, authorization, `Cache-Control: private, no-store` on sensitive responses and immutable trace lookup semantics. Define stable tie-breaker ordering `(start_time, trace_id)` or equivalent for cursor pagination.

Required query resources: overview, traces list/detail, service list/detail, dependency map, analytics, retention/settings and health (separate liveness/readiness). Public-demo queries read exclusively from isolated synthetic data. Never route browser directly to internal Go API, Postgres or collector.

## 6. Ingestion, retention and capacity budgets — resolve before production

**Important calculation:** sustained **500 spans/s for seven days = 302,400,000 spans**, which is **not** an acceptable implied capacity claim for an unmeasured 4-vCPU/8-GB single-server PostgreSQL system. A 10-minute 500-spans/s load test proves only a burst capability in a tested environment.

At M1 define and record:
- Typical/peak span rate, average encoded span size, index amplification factor, demo traffic rate, expected daily volume and retention duration.
- Database and queue disk budgets, reserved free space, backup footprint, compaction/vacuum strategy and purge/retention execution cost.
- Host CPU/RAM/disk class; how operational metrics reveal saturation and when ingestion throttles safely.
- Explicit `capacity-profile.md` with formulas, measurements, `bytes/span`, effective retention and scale-out triggers.
- Defaults: local development retention **7 days only if measured disk budget permits**; synthetic public demo **1 day**; operator deployment determines retention based on actual ingest and capacity. Make retention configurable and safe.

Test two independently labeled conditions: (a) a **peak test** of 500 spans/s for 10 minutes on documented benchmark hardware, aiming to account for every direct-receiver accepted span, and (b) a **sustained operating profile** chosen from measured normal workload, disk budget and retention (not guessed). Document Collector queue losses/overflow separately. If the test fails, state measured limitations; never reduce assertions or silently claim the benchmark passed.

## 7. Security and privacy threat model

Follow current OWASP application and API security guidance; treat OpenTelemetry attributes as untrusted data. Record trust boundaries, attack surface, abuse cases, severity, mitigations and verification in `docs/security/threat-model.md`.

- Default-deny network: only Caddy's HTTPS public ports exposed in operator production; DB/Go/Collector on private Docker network. Remote OTLP ingestion **disabled by default**, enabled only by explicit ingress ADR and authentication/TLS/rate-limit review at the receiving edge.
- Auth: GitHub OAuth via a maintained authentication library with correct CSRF/state and redirect validation; allowlist operator by GitHub **numeric user ID** instead of mutable username; secure HttpOnly/SameSite cookies, explicit logout/session expiry and rate limits. Local bootstrap must work without OAuth credentials but MUST NOT be usable as a public production auth bypass.
- AuthZ: server-side route and data-source permission checks on every private access, not just hiding UI. Private BFF queries must not enter shared public caches, static pre-rendering or cross-request memoization. Include security headers and CSP appropriate to charts/motion.
- Public demo: physically separate deployment/database/DB credentials, synthetic dataset, read-only DB role/query implementation, no ingestion/admin paths, clear banner and repeatable re-seeding. No reference to private DB credentials in demo runtime.
- Ingestion auth: rotated hashed tokens if enabled, least-privilege ingress, HTTPS, payload limits, bounded decompression and reject/drop accounting; do not leak token values to logs or tracing attributes.
- Redaction: sensitive header, cookie, secret, request body and personal-data attributes filtered **before persistence**, with allowlist-first sensitive keys and configurable safe policies. Validate displayed text against XSS, Unicode/control characters, oversized values and escaping bugs.
- SQL: parameterized queries, least-privileged DB roles, prepared migrations, row/query bounds. Guard URL-based integrations and remote client configuration against SSRF if added.
- Supply chain: lockfiles, SCA, dependency provenance, container scans, secret scans, artifact SBOM where feasible; reproducible build and restricted CI tokens.
- No blanket claims of GDPR, SOC 2, HIPAA or other compliance. Document data lifecycle, deletion, privacy risks and relevant jurisdictional/legal review before accepting real third-party data.

Threat tests must include unauthorized private route, IDOR, demo/private crossover, OAuth/session misuse, CSRF, cache leakage, XSS in attributes, SQL injection, decompression bombs, overload, token revocation, remote receiver exposure, secret leakage and unsafe logging.

## 8. Complete information architecture and routes

**No phantom links or skeleton-only production pages.** Every V1 route requires real behavior, error/empty/loading/partial states, navigation, keyboard use, responsive contract, API data dependency and automated test IDs. Use consistent shell, breadcrumbs, route titles, data freshness indicators and state handling.

### 8.1 Public editorial website
| Route | Required information and interactive sections | Acceptance evidence |
| --- | --- | --- |
| `/` | Minimal navigation; original identity/wordmark; high-impact editorial hero and two CTAs (Explore live demo, View GitHub); animated trace-line technical illustration; concise problem/solution narrative; interactive real **synthetic** request journey; feature showcase; trace waterfall and service map visual walkthrough; architecture explanation; minimal getting-started code sample; OSS benefits/contributions; FAQ (with factual statements); final CTA; credible footer | Responsive screenshots, working links, no dummy claims, reduced-motion variation, synthetic trace preview keyed to real fixture |
| `/docs` | Documentation landing; version banner; quickstart, navigation, TOC and docs access | Every link resolves; installation tested |
| `/docs/getting-started` | Prerequisites, environment, Compose install, sample trace generation, troubleshooting | Clean-clone walkthrough |
| `/docs/instrumentation` | Example OpenTelemetry SDK configuration and expected output; copy buttons; tested code examples | Demo SDK sends actual trace |
| `/docs/architecture` | Data flow, trust boundaries, precise protocol, retention, sampling and deployment profiles | Matches source and ADRs |
| `/docs/deployment` | Local and operator single-server instructions, TLS, secrets, restore and update workflow | Dry-run deployment test |
| `/docs/security` | Threat boundary, ingestion default off, data minimization, disclosure/contact and limitations | Security reviewer signoff |
| `/login` | GitHub sign-in, loading, denied allowlist, auth errors, return path, session expiry and signout flows | End-to-end auth test |
| `/demo` | Prominent **synthetic read-only** notice; usable overview/traces/service investigation; no admin actions | Data isolation test and E2E |
| `/demo/traces/[traceId]` | Synthetic trace details/waterfall, deep links, accessible alternative and no private data path | Demo E2E |

### 8.2 Authenticated diagnostics application
| Route | Mandatory regions and controls | Gate |
| --- | --- | --- |
| `/app` | Global time range and service scope; health + sampled telemetry caveat; request/latency/error panels; timelines; relevant services; recent trace list; recovery states | Data/metric reference fixtures |
| `/app/onboarding` | Quickstart; Collector configuration; connection test/status; first trace guided journey; troubleshooting | First-run success with clean Compose |
| `/app/traces` | Time/service/status/min-duration filters; sortable accessible trace list; cursor paging; URL sync; clear filters; loading/no data/no match/failure | URL deep-link and filter E2E |
| `/app/traces/[traceId]` | IDs, status, provenance and timestamps; accurate waterfall time axis; collapsible parent-child tree; concurrent spans; focused span; attributes/events/links; raw JSON export when implemented; missing-parent/clock-skew notices; copy ID | Golden waterfall comparison, keyboard E2E |
| `/app/services` | Searchable list, service traffic/latency/error summaries; sampling labels; last observed; keyboard sorting | Population/math tests |
| `/app/services/[serviceName]` | Service identity, operation stats, time window, latency/errors, related traces, verified downstream edges | API filters and E2E |
| `/app/map` | Observed-only graph with zoom, pan, fit, reset, node/edge focus, evidence details, time window and **fully accessible edge table**; mobile alternative | Graph fixture and keyboard alternative |
| `/app/analytics` | Time series, latency distribution, p50/p95/p99 where meaningful, error breakdown, sample counts, time comparisons and source labels | Query oracle tests, chart labels |
| `/app/settings` | Retention settings, private deployment auth status, UI preferences, limits/status; confirmation for sensitive changes; success/errors | Access-control, mutation and audit tests |

### 8.3 Shared component inventory
Brand header/wordmark, sidebar and mobile navigation, breadcrumb, time picker, command/search overlay if actually implemented, service selector, filter drawer/chips, accessible data table, sorted header, cursor pager, skeleton, empty/error/partial warning, status badge with icon/text, charts (legends/units/tooltips), span tree and inspector, waterfall, graph and table alternate, dialogs, toasts, inline form validation, retry CTA, pagination, copy button, docs code snippets, theme tokens, privacy banner, session-expired view and 404/500 fallbacks.

For each, document prop/data contracts, keyboard behavior, focus management, all states, responsiveness, test IDs and performance/animation impact. Components must be cohesive and composable; do not invent dozens of abstractions until usage justifies them.

## 9. Visual identity, creative quality and assets

### 9.1 Art direction
**White-first, editorial, engineered calm.** Character: precise, modern, refined, confident; distinct from generic admin templates. Product identity: signal paths, junctions, pulse, traces and time. Public website uses expressive editorial composition; dashboard optimizes diagnostic clarity. Avoid copying a reference website or recreating its identifiable hero/artwork.

Token candidates, to be contrast-audited: `#FFFFFF` paper, `#F7F9FC` canvas, `#151A25` ink, `#2563EB` signal blue, `#7C3AED` secondary highlight. Add semantic failure/success/warning colors that pass contrast. Use disciplined spacing (4/8px system), crisp 1px dividers, typographic hierarchy, high legibility and artful whitespace. Light mode is the core design; dark mode is **not a V1 requirement**.

Define `docs/design/` files for: identity and voice; logo and favicon; typography family and licensing; responsive grid and breakpoints; color/contrast tokens; elevation, borders, radius and iconography; chart palette; asset inventory and provenance; component/state inventory; page-by-page wireframe and final visual specification; animation map. Use licensed/system fonts and original vector illustration; never redistribute font binaries without permission or load remote assets that compromise performance/privacy.

### 9.2 Creative benchmarking
Critically review selected **editorial/interactive** quality references (e.g., well-executed Awwwards/FWA work) for typography, pacing, visual storytelling and art direction, and **observability products** (e.g., Grafana/Jaeger) for semantic density and investigative utility. Record a short moodboard/benchmark study with *specific* qualities worth learning, originality constraints, what is rejected, and expected product benefits. A benchmark is not permission to clone animation, layout or branding.

### 9.3 Motion design contract
One motion library (e.g. Motion) plus CSS. For every interaction define trigger, duration, easing, sequence, cancellation/reversal, reduced-motion fallback, mobile behavior and performance budget:
- Hero staged narrative: ~600–900 ms total, with non-blocking skip and immediate readable content.
- Section entry: ~350–550 ms opacity/transform only, no scroll hijacking.
- Buttons/chips/hover: ~150–220 ms; always visible focus outside hover.
- Sidebar/drawer: ~220–300 ms with keyboard focus management.
- Trace selection/focus: ~150–250 ms; do not move time axes while user reads.
- Graph hover/focus: subtle node/edge treatment; no perpetual distracting paths.
- Streaming/poll refresh: visual stability and intentional update indicator, no constant layout jumping.

Respect `prefers-reduced-motion`; disable nonessential movement, parallax, autoplay and animated large camera shifts. Motion never delays error reporting or prevents diagnosis. Any advanced WebGL/3D must be justified and approved against accessibility/performance thresholds, and is not presumed necessary.

### 9.4 Responsive, visual, accessibility QA
Target widths at 360, 375, 768, 1024 and 1440 px; test 200% zoom, tall/short viewport, landscape, Safari/Chrome/Firefox current supported, mobile Safari and Chrome. No accidental horizontal page overflow; for waterfall/table allow explicitly signaled inner scrolling and an accessible non-visual representation. Use semantic HTML, WCAG 2.2 AA criteria, 4.5:1 standard text contrast and 3:1 for relevant UI graphics and non-text indicators, visible focus, minimum accessible target sizing as applicable, logical focus order, screen-reader descriptions of charts and live updates (without spamming announcements). No keyboard traps.

**Web vitals:** target field p75 LCP <=2.5 s, INP <=200 ms, CLS <=0.1 on supported public routes when field data exists; document device/network and use Lighthouse lab proxy before sufficient traffic. Validate production build bundle weight, hydration, image/font loading and below-the-fold component code splitting. Monitor dashboard responsiveness for >200 trace rows and >50 service nodes, using viewport virtualization, progressive rendering or simplified alternatives only where measured.

## 10. Data visualization semantics and usability acceptance

Every chart, edge and label must explain **what** it measures, **over which time range**, **which population**, **the unit**, and **what is missing**. Chart tooltips must never hide critical interpretation. Colors are not the only way to indicate success/error. Provide a readable table alternative for topology and dense data. Do not use misleading chart interpolation between missing data points.

Example user-task success gates:
- Starting from a slow service in the overview, tester can navigate to the corresponding trace and highlight the known slow span without needing developer hints.
- A user can identify a failed span and read its status/attributes with keyboard alone.
- A sampled or incomplete trace is visibly marked; a user is not led to believe a missing parent is proof of an absent service call.
- A chart containing five observations does not make an unsupported precision claim for p99; labels explain sample size.
- On phone width, essential investigation can be completed through list/tree/table alternatives, not a broken miniature graph.

Document task outcome, step count/time, comprehension mistakes, and remediation; do not invent a score such as “10/10 UI” or “100x better.”

## 11. API, state management and frontend boundaries

- OpenAPI is the source of truth for app API; regenerate typed client from a repeatable command and commit/check generated artifacts as chosen in ADR.
- Keep auth/session secrets on server. No caching of private trace responses in Next.js shared/static caches, including `use cache` and upstream CDN caching; apply `Cache-Control: private, no-store`, verify header behavior in production. Use patched Next.js release.
- App queries have explicit fetching/loading/cancellation/retry strategy, request deduplication, time-window consistency, pagination and max result sizes. If client query library is selected, justify it; avoid duplicating state in global stores.
- URL is source of truth for shareable trace search/filter/time-range state, with validation and well-defined default. Deep links remain usable after refresh and authentication.
- Polling while visible (e.g. 5s for overview, configurable) is sufficient V1; no WebSocket stack without specific need. Suspend on hidden tabs, prevent overlapping requests and display age of last successful update.
- Provide REST DTO examples, error shape, enum/unit semantics, timestamp conversion, clock/timezone UI, pagination ordering, unknown service names and unusual Unicode content. Backend and frontend must run contract tests on both sides.
- Semantic confidence: avoid server components producing static data for private routes; ensure browser/back-forward navigation does not expose stale unauthorized data after logout.

## 12. Reliability, operations, backup, restore and lifecycle

- Operational probes: separate liveness/readiness; startup/migration failure; self-telemetry for Go, Collector exporter queue size/capacity, accepted/rejected/dropped spans, HTTP failures and request latency, Postgres connections/disk and retention-job results. Do not accidentally route the app's own telemetry into an unbounded feedback loop.
- Bound the Collector queue, receiver concurrency, DB pool, query timeouts, payload size and UI list queries. Define behavior for full queue, slow DB, Collector restart, failing exporter, disk nearing capacity and rate-limit responses.
- Backups: periodic encrypted backup with off-server storage when hosting real telemetry; perform at least one **restoration drill** into a clean DB; measure elapsed recovery and evidence. Set explicit RPO/RTO **before** public operator deployment based on actual constraints. Initial planning objective: recovery point <=24h and restoration <=4h for single-server data, subject to measured backup cadence/host feasibility; do not claim an SLA.
- Deploys: separate local/production Compose configurations; pin images by version/digest, rootless/non-root where practical, health checks, env templates, TLS, log rotation, resource limits, safe storage, no hardcoded credentials, exact migration/rollout and verified rollback path. Use immutable release tags and changelog.
- Migrations: expand/contract where needed, tested forward migrations, backups before destructive changes, restore instead of assuming safe down-migrations. No silent data deletion.
- Maintenance: dependency vulnerability scanning and update cadence, upgrade plan for Next.js/Node/Go/Postgres/Collector, annual or release-cycle ADR review, compatibility regression tests, issue triage and useful contribution guidelines.
- Open source: choose license after checking libraries and assets, SPDX headers as required, CONTRIBUTING, CODE_OF_CONDUCT if adopted, SECURITY.md, release artifacts, screenshots from actual app, architecture diagrams and a verified quickstart. Do not claim a compliance certification.

## 13. Required repository layout

```text
Traceflow/
├── CLAUDE.md
├── apps/web/                       # Next.js frontend/BFF/docs
│   ├── src/app/                    # public, demo and private routes
│   ├── src/components/             # ui, charts, traces, topology, shell
│   ├── src/features/               # domain-specific hooks and controllers
│   ├── src/lib/                    # generated client adapters, auth, units
│   ├── src/styles/                 # white-first tokens and styles
│   ├── tests/                      # unit/component, contract
│   └── e2e/                        # Playwright user journeys
├── services/trace-api/
│   ├── cmd/server/
│   ├── internal/                    # ingest, query, authz, store, ops
│   ├── db/migrations/
│   ├── db/queries/
│   └── tests/                      # OTLP, SQL, perf, integration
├── examples/demo-system/          # gateway, orders, inventory
├── api/openapi.yaml
├── infra/otel/                     # pinned Collector image/config
├── infra/caddy/
├── docs/
│   ├── requirements/               # PRD, scope, IDs, traceability
│   ├── architecture/               # ADRs, compatibility, capacity, data
│   ├── adr/
│   ├── design/                     # tokens, pages, motion, a11y, assets
│   ├── security/                   # threat, auth, privacy, test evidence
│   ├── testing/                    # fixtures, benchmarks, reports
│   ├── runbooks/                   # backup, restore, deploy, incident
│   ├── workflow/                   # ownership, backlog, handoffs
│   └── specs/                      # THIS document, audit references
├── .github/workflows/
├── .github/CODEOWNERS
├── compose.yaml
├── compose.production.yaml
├── Makefile
├── .env.example
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
└── LICENSE                          # after explicit license decision
```

Adjust subfolders only with a documented reason. Avoid unnecessary scaffolding and generated files that are never referenced. `CLAUDE.md` must link to this V2 document, not superseded older prompts.

## 14. Multi-model responsibility and execution workflow

### 14.1 Preferred configurations — verify, do not assume account access
- **Sonnet 5.5**, `claude-sonnet-5-5`, **high** effort, **Ultracode ON** (if available): visual identity, public website, dashboard, trace waterfall/graph presentation, responsive UX, animation, frontend components/tests, screenshot presentation.
- **Opus 5.5**, `claude-opus-5-5`, **medium** effort, **Ultracode ON** (if available): architecture, ADRs, OpenTelemetry, Go, DB, schemas, security, deployment, backend tests, overall integration coordinator.
- **Independent reviews:** another session/reviewer than the author; for security and correctness, a read-only critical reviewer and deterministic tests; for design/accessibility, a separate visual reviewer and manual human testing. A same-model independent session is not a guaranteed independent security audit.
- Other models may handle low-risk docs, issue sorting and test fixture cataloguing; they may not approve contracts, sensitive security or release.

Official Anthropic documentation lists both model IDs. Claude Code **Ultracode is a mode, not an effort level**. Claude Code 2.1.284+ supports toggling `/effort ultracode` without changing `high`/`medium`. **Do not invoke `--effort ultracode` to implement this pairing**, because that launch flag selects `xhigh` with Ultracode. Verify client version, provider entitlement, organization effort caps and active session states. The expected check in separate sessions is:

```bash
claude --version
# Frontend worktree:
claude --model claude-sonnet-5-5 --effort high
# Inside: /effort ultracode ; verify /model, /effort, /status

# Backend worktree:
claude --model claude-opus-5-5 --effort medium
# Inside: /effort ultracode ; verify /model, /effort, /status
```

These are suggested interactive commands, not confirmed user-account settings. Use an evidence-based fallback and log the actual model, effort and mode in `docs/workflow/model-availability.md`; never claim settings active without inspection. Don't let cost or model substitutions lower quality gates.

### 14.2 Single source of truth and decision order
1. Legal/safety/security and official protocol constraints.
2. This V2 master prompt's owner-adopted scope, user goals and acceptance criteria.
3. Approved ADRs, versioned OpenAPI, DB migration contracts and design tokens.
4. Recorded milestone task tickets, ownership table and review policy.
5. Local implementation decisions not in conflict with the above.

**After owner adoption, the prior integrated master prompt and workflow are archived only.** Do not ask agents to simultaneously comply with multiple conflicting canonical documents. Add an ADR/change request if new evidence requires revising this V2 baseline.

### 14.3 File ownership and review matrix
| Domain/files | Primary editor | Must review |
| --- | --- | --- |
| `docs/requirements`, integration ledger, shared governance | Opus coordinator | User for scope and major decisions |
| `docs/architecture`, ADRs, Collector and Go API/OTLP | Opus | Independent architecture/OTLP pass; Sonnet for frontend-impacting contracts |
| `services/trace-api/db`, migrations, analytics, performance | Opus | Independent database/API review |
| `api/openapi.yaml`, generated client specification | Opus | Sonnet as consumer **before freeze** |
| `docs/design`, app visual system, UI components and page UI | Sonnet | Opus for data semantics and engineering feasibility; a11y review |
| `apps/web` features, chart adapters, waterfall and map | Sonnet | Opus verifies correctness of displayed information |
| `apps/web` tests/visual regression | Sonnet | Separate QA session / Playwright reports |
| Backend tests, Collector fixtures, benchmarks, Compose/CI | Opus | Separate correctness/security reviewer |
| Root `CLAUDE.md`, lockfiles, root config, shared CI and releases | Opus coordinator serializes changes | Affected owner reviews |
| README/art direction/docs presentation | Sonnet | Opus verifies technical accuracy |

**No concurrent edits to the same file, migration sequence, schema, contract or shared config.** Use one modifying owner per file and issue-scoped branches/PRs; protect `main` and require CI and reviews. CODEOWNERS is a routing aid, not proof of review. Worktrees require an actual initial Git commit; do not assume worktree creation on empty repositories succeeds.

### 14.4 Contract-first sequence and parallelism
- **M0 (serial):** Opus organizes scope and constraints; Sonnet performs non-modifying art/UX benchmark research. Record capacity, deployment profile and initial risks.
- **M1 (controlled collaboration):** Opus drafts DB/OTLP/API/security contracts; Sonnet drafts visual system, page matrix and data-to-UI bindings. Both review and sign a versioned **contract freeze**. Resolve inconsistencies before large implementation.
- **M2–M4:** Opus builds verified backend and reference fixtures; Sonnet may build frontend shell and component system against the **frozen generated API client and deterministic fixtures**, not invented JSON shapes. Mark fixture-backed pages as not integrated until real API passes.
- **M5:** Integration coordinator aligns real backend with frontend and removes fixture-only behavior in operational paths; Sonnet owns UI fixes, Opus API/semantics fixes. Test E2E across real services.
- **M6–M8:** Security hardening, test, performance, accessibility, deploy, review. Read-only reviewers and human checks provide evidence; no self-certifying release.

### 14.5 Required handoff
Every ticket must return:

```text
TASK_ID | BASE_COMMIT_SHA | BRANCH/PR | MODEL/EFFORT/ULTRACODE VERIFIED
OWNER | REVIEWER | REQUIREMENT_IDS | FILES_CHANGED
CONTRACT_VERSION CONSUMED / CONTRACT_CHANGES
BEHAVIOUR IMPLEMENTED | SECURITY / DATA IMPACT
COMMANDS RUN + ACTUAL RESULTS | TEST FIXTURES
SCREENSHOT / TRACE / BENCHMARK LINKS
KNOWN FAILURES / UNTESTED | DEPENDENCIES / NEXT HANDOFF
FINAL: PASS | FAIL | NOT TESTED | BLOCKED
```

At the gate: backend contract divergence → Opus; frontend incorrect adapter/display → Sonnet; defective contract → stop both, open an ADR/change PR, update schema, generate client and rerun both contract suites. Never hide discrepancies with permissive `any`, removed assertions, forced type casts, swallowed errors or static replacement data. A single integration coordinator serializes release merges, not parallel edits to `main`.

### 14.6 Cost and resource strategy
Normally at most **two modifying agents**, plus read-only reviewers at milestone gates. Prefer focused tasks, reused source-of-truth documentation, cached prompts where supported, test fixtures and deterministic build tools. Reserve the more expensive Opus review for hard engineering/security decisions; use Sonnet for iteration-heavy visual work. Log spend/effort when available; don't optimize token cost at the expense of correctness.

## 15. Development plan, dependencies and exit gates

| Gate | Owner(s) | Deliverables before progressing | Evidence required |
| --- | --- | --- | --- |
| **M0 Discovery** | Opus lead; Sonnet benchmark | PRD, personas, V1/non-goals, traceability IDs, constraints, risks, threat outline, architecture alternatives, feature priority | Reviewed requirement matrix; no unresolved blocking contradiction |
| **M1 Contracts + design** | Opus + Sonnet | ADRs, DB model and migrations design, OTLP fixture contract, OpenAPI, capacity profile, security boundary, page matrix, design tokens, UX/motion/a11y specs | Contract reviews, example fixtures validated; approval of risky decisions |
| **M2 Foundation** | Opus integration + Sonnet shell | Monorepo, local Compose, env templates, CI, tooling locks, empty app skeleton, docs structure | Fresh-clone bootstrap, lint/build/test succeed |
| **M3 Ingest** | Opus | Collector → Go → PostgreSQL with accurate responses, spans/events/links, dedupe, limits, counters, retention | Protobuf/SDK golden tests, DB tests, failure fixtures |
| **M4 Query + analytics** | Opus | Indexed trace list/detail, services, topology, percentiles, API contract, generated TS client | SQL oracle, pagination, graph lineage, OpenAPI and load tests |
| **M5 Frontend + integration** | Sonnet UI; Opus joins | All public/docs/private/demo routes, all UI states, real API integration, original responsive/accessible visuals | Playwright real-service journeys, golden waterfall, visual and keyboard tests |
| **M6 Hardening** | Opus; independent reviewer | AuthN/AuthZ, redaction, caching boundaries, secure profiles, operational telemetry, backups, rate/budget limits | Security, privacy, recovery, auth and isolation tests |
| **M7 Acceptance** | Both + independent QA | Performance/accessibility/responsive/regression/recovery, user-task studies, clean-clone docs | Measured performance, screenshots, WCAG review, test and security reports |
| **M8 Release** | Opus coordinator + human approver | Pinned production Compose, HTTPS, migrations, smoke tests, restore verification, CHANGELOG, README, screenshots and tagged release | Written human release approval, `PASS/FAIL/NOT TESTED` evidence table |

Parallelize only when contracts are frozen and file ownership differs. **Do not skip M0/M1 because a coding model can begin writing code immediately.** A phase may be subdivided, but every exit gate must be explicit and evidence-backed.

## 16. Testing, quality gates and measurable acceptance

### 16.1 Trace and correctness
- Normal cross-service request produces correlated spans across **all three** instrumented services with trace ID propagation; expected parent-child relationships match a reference fixture.
- Golden tests cover nested, concurrent, asynchronous, incomplete, late/out-of-order, duplicate-identical, conflicting replay, invalid IDs, skewed time, unsampled/missing parent, event/link/schema and multi-resource scenarios.
- OTLP tests compare **actual serialized status/response bodies**, headers, HTTP codes, gzip, size limits and client retry behavior.
- Trace-search cursor does not skip/duplicate records under stable snapshot; document behavior when new traces arrive during pagination.
- Trace duration, server latency populations, error fractions, percentiles and topology correspond to a separately computed fixture oracle.

### 16.2 Performance targets (initial; measured, not promised)
Use a documented **4-vCPU/8-GB Linux host** and PostgreSQL 18.x database, a seeded **250,000-span / 25,000-trace** fixture, 5-minute warm workload with **10 virtual users**. Starting goals: trace list API **p95 <500ms**, trace detail **p95 <1s**, API error rate **<1%**. Test ingestion peak **500 spans/sec for 10 minutes**, with all accepted direct-Go spans accounted for (separate Collector queue/drop report). Set thresholds and revise via ADR when measured constraints justify; no fictitious compliance.

Benchmark sustained **realistic** volume, disk, retention and backpressure in addition to the peak. Measure query plans, memory, GC, disk IO and queue metrics. Test dashboard with 200 trace rows/50 graph nodes and realistic time windows. Record test artifact, tool version, host, data generator seed, warmup, concurrency, request mix, error handling, p50/p95/p99 and maximum memory/disk.

### 16.3 UI/visual/accessibility
- Public website: p75 field LCP <=2.5s, INP <=200ms, CLS <=0.1 when field data available; otherwise provide labeled lab tests with conditions.
- 360/375/768/1024/1440 widths, 200% zoom; desktop Chrome/Firefox/Safari and mobile Safari/Chrome; no critical overflow or broken task paths.
- Keyboard-only, VoiceOver/NVDA where feasible, visible focus, dialogs/focus return, alternative trace list/graph edge table, form errors, reduced motion. No critical WCAG 2.2 AA violations in manual + automated results.
- Side-by-side design review on **every** route and defined state: baseline screenshot, target spec, final screenshot; check typography, contrast, consistency, hierarchy, identity, imagery, icons and motion. Fix material inconsistencies before release.
- Usability: three task-based sessions for slow trace, failure trace and map→trace navigation; no critical user-flow blocker remains.

### 16.4 Security, reliability and release
- No unresolved critical/high security findings. Explicit exception only through human owner review, documented compensating control and non-public release decision; do not secretly waive mandatory barriers.
- Test auth bypass, IDOR, CSRF, private-cache leakage, token rotation, malicious attributes/XSS, injection, large gzip, overload, protected Collector ingress, synthetic/private separation and secret leak detection.
- Failure drills: Postgres restart, Collector restart, API restart, queue full, disk-low response, retention run, malformed migration, backup/restore. Record observed drops and failures truthfully.
- CI blocks merge on lint/typecheck/build, Go/static/race checks where appropriate, unit/integration/contract, production bundle build, security/secret scan and E2E smoke. Run comprehensive performance and manual accessibility at release, not necessarily on each small PR.
- Clean-clone documentation: a new engineer installs dependencies, runs Compose, generates normal/slow/error traffic, finds known trace ID and locates the slow span following README only.

### 16.5 Requirements-to-tests traceability (mandatory)
Maintain `docs/requirements/traceability.md` with:

`REQ_ID | PRIORITY | DESCRIPTION | ROUTE/COMPONENT | CODE_PATH | TEST_ID | TEST_COMMAND | EVIDENCE_PATH/URL | RESULT | OWNER`

Core test families: `OTLP-*`, `DATA-*`, `API-*`, `AUTH-*`, `DEMO-*`, `UX-*`, `A11Y-*`, `PERF-*`, `RELIABILITY-*`, `DEPLOY-*`. **No V1 must-have can be marked complete without at least one deterministic passing test and appropriate integration/manual proof.**

## 17. Delivery artifacts, decision ledger and release readiness

Required source-of-truth files:
- `docs/requirements/{PRD.md,scope.md,traceability.md,acceptance-criteria.md,risks.md}`
- `docs/architecture/{overview.md,data-model.md,api-contract.md,compatibility-matrix.md,capacity-profile.md,deployment-topology.md}` and `docs/adr/*`
- `docs/design/{identity.md,design-tokens.md,page-matrix.md,component-inventory.md,motion-spec.md,accessibility-matrix.md,asset-inventory.md}`
- `docs/security/{threat-model.md,privacy.md,authz-matrix.md,security-testing.md}`
- `docs/testing/{fixtures.md,test-plan.md,benchmark-results.md,release-evidence.md}`
- `docs/workflow/{ownership.md,task-board.md,integration-log.md,model-availability.md,handoff-template.md}`
- `docs/runbooks/{deployment.md,backup-restore.md,retention.md,incident-response.md}`
- `api/openapi.yaml`, Collector configs, actual runnable source, tests and examples, root `CLAUDE.md`, `.env.example`, CI workflows, README, screenshots, license and release notes.

**Readiness levels must be distinct:** (A) planning baseline ready, (B) code foundation ready, (C) integrated functionality ready, (D) release candidate, (E) public release approved. State explicitly which one evidence supports. Never use “perfect,” “no issues,” or “fully production-ready” without independent evidence—and even then report residual risk.

Before final public release: verify approved V1 route list, real telemetry, stable OpenAPI, accurate chart semantics, DB retention capacity, private/demo isolation, security audits, keyboard/assistive tech, performance reports, operational metrics, backups and restoration, documentation, human review and tagged artifact. Provide a final gap table: `PASS/FAIL/NOT TESTED/BLOCKED`, owner, severity, proof link, disposition and remaining limitations.

## 18. Immediate first-run instruction

> Read this TRACEFLOW V2 master prompt and the latest independent quality audit completely. Inspect the actual `Sendiw14/Traceflow` repository and determine whether it is empty or has evolved. Verify the Claude models, high/medium effort, Ultracode mode, runtime capabilities and account permissions **in the actual environment**. Do not assume prior tool claims prove model access. Establish versioned `docs/requirements`, architecture ADRs, risk and capacity profiles, threat boundaries, OpenAPI and design-page contracts **before major code**. Assign Opus 5.5 medium to architecture/Go/OTLP/SQL/security and Sonnet 5.5 high to the white-first creative frontend, each with Ultracode where supported; otherwise log justified available fallbacks. Agree on file ownership, golden fixtures and interface contracts. Then proceed through M0–M8 with documented tests and independent reviews. Do not ship V2 features, fabricate screenshots/benchmark results, expose unprotected ingestion, commit secrets, or approve public release without the human owner. Report exact artifacts created, tests run, blockers and the next evidence gate.

## 19. Standards and official sources to verify at build time

- Anthropic models: https://platform.claude.com/docs/en/models/overview
- Claude Code models and Ultracode: https://code.claude.com/docs/en/model-config
- Claude Code subagents: https://code.claude.com/docs/en/sub-agents
- Claude Code parallel worktrees: https://code.claude.com/docs/en/common-workflows
- OpenTelemetry OTLP: https://opentelemetry.io/docs/specs/otlp/
- OpenTelemetry Collector batching migration (Nov 11, 2026): https://opentelemetry.io/blog/2026/collector-batching-migration/
- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/specs/semconv/
- Next.js support and official release tags: https://nextjs.org/support-policy and https://github.com/vercel/next.js/releases
- React releases: https://react.dev/versions
- TypeScript: https://www.typescriptlang.org/ and https://devblogs.microsoft.com/typescript/
- Node release schedule: https://nodejs.org/en/about/previous-releases
- Go releases: https://go.dev/dl/
- PostgreSQL support: https://www.postgresql.org/support/versioning/
- Tailwind: https://tailwindcss.com/blog
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- OWASP application security: https://owasp.org/www-project-top-ten/
- OWASP API Security: https://owasp.org/API-Security/
- Docker Compose production: https://docs.docker.com/compose/how-tos/production/

**Contractual final statement:** This is a comprehensive, reviewed *implementation baseline candidate* until the repository owner adopts it. It does not establish that code is deployed, telemetry interoperability passes, security is certified, accessibility is compliant, performance thresholds are met, or every future risk has been eliminated. Those assertions require actual test artifacts and operational evidence.
