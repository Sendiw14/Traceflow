# Integration Log

## M0-001 — Repository bootstrap and spec adoption

```text
TASK_ID: M0-001 | BASE_COMMIT_SHA: (none — initial commit) | BRANCH/PR: main (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-opus-5-5 / NOT TESTED / NOT TESTED
OWNER: Opus coordinator | REVIEWER: repository owner (pending)
REQUIREMENT_IDS: SCOPE-01…10, NFR-01…07 (drafted, not implemented)
FILES_CHANGED: CLAUDE.md, README.md, docs/specs/*, docs/requirements/*, docs/workflow/*
CONTRACT_VERSION CONSUMED / CONTRACT_CHANGES: V2 spec adopted 2026-11-22 / none
BEHAVIOUR IMPLEMENTED: none (documentation only)
SECURITY / DATA IMPACT: none; no secrets, no telemetry
COMMANDS RUN + ACTUAL RESULTS: env inspection (see model-availability.md); git init
TEST FIXTURES: none
KNOWN FAILURES / UNTESTED: effort/Ultracode not verified; Node below baseline; blocking unknowns U-01…U-06
DEPENDENCIES / NEXT HANDOFF: owner review of M0 drafts → M0 gate → M1 contracts
FINAL: NOT TESTED (planning artifacts only; M0 gate requires owner review)
```

## M1-B — Backend contracts draft

```text
TASK_ID: M1-B1..B5 | BASE_COMMIT_SHA: 3a534ae | BRANCH/PR: main (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-opus-5-5 / NOT TESTED / NOT TESTED
OWNER: Opus | REVIEWER: Sonnet (OpenAPI consumer), independent security reviewer, owner (ADR-0005) — all pending
REQUIREMENT_IDS: SCOPE-02..04, SCOPE-07, SCOPE-08, SCOPE-10, NFR-02, NFR-03, NFR-05, NFR-06
FILES_CHANGED: docs/architecture/*, docs/adr/0001..0005, api/openapi.yaml, docs/security/*, docs/testing/fixtures.md, docs/workflow/{ownership,task-board}.md
CONTRACT_VERSION CONSUMED / CONTRACT_CHANGES: none / introduces api 0.1.0-draft
BEHAVIOUR IMPLEMENTED: none (contracts only)
SECURITY / DATA IMPACT: defines boundaries; nothing deployed
COMMANDS RUN + ACTUAL RESULTS: `npx @redocly/cli@2 lint api/openapi.yaml` → valid, 2 warnings (health probes without 4xx, accepted); upstream release tags via `gh api` (see compatibility-matrix.md)
TEST FIXTURES: contract only (docs/testing/fixtures.md); none generated
KNOWN FAILURES / UNTESTED: capacity numbers assumed; Collector sending_queue.batch support in v0.165.0 unverified; auth library unspiked
DEPENDENCIES / NEXT HANDOFF: Sonnet M1-D1..D4 + R1 → contract freeze
FINAL: NOT TESTED (draft contracts; freeze pending reviews)
```

## M1-D — Design system, page matrix, consumer review

```text
TASK_ID: M1-D1..D4, M1-R1 | BASE_COMMIT_SHA: 9089e9b | BRANCH/PR: claude/vigorous-yalow-e6f487 (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-sonnet-5-5 / NOT TESTED / NOT TESTED
OWNER: Sonnet | REVIEWER: Opus (data semantics, OpenAPI changes), independent a11y/visual reviewer, repository owner — all pending
REQUIREMENT_IDS: SCOPE-05, SCOPE-06, SCOPE-08, SCOPE-09, NFR-01, NFR-04, AC-UX-01, AC-A11Y-01, AC-A11Y-02, AC-API-01 (consumer review)
FILES_CHANGED: docs/design/{benchmark,identity,design-tokens,typography,grid-breakpoints,page-matrix,component-inventory,motion-spec,accessibility-matrix,asset-inventory,openapi-consumer-review}.md, docs/design/tools/contrast.py, docs/workflow/{model-availability,integration-log}.md (append only)
CONTRACT_VERSION CONSUMED / CONTRACT_CHANGES: api/openapi.yaml 0.1.0-draft / none made; changes REQUESTED in docs/design/openapi-consumer-review.md (blocking: R-3 latency distribution, R-4a exemplar trace ids)
BEHAVIOUR IMPLEMENTED: none (design documentation only; no code, no scaffolding, no dependencies)
SECURITY / DATA IMPACT: none; no secrets; no external requests; no assets imported
COMMANDS RUN + ACTUAL RESULTS: `python3 docs/design/tools/contrast.py` → all text/UI/on-fill pairings in design-tokens.md §1 meet thresholds (min text 4.52:1 signal on violet-tint; min UI 3.19:1 control-border on sunken); intentionally sub-threshold decorative tokens listed. `claude --version` → 2.1.319. Rendered-pixel verification not performed.
TEST FIXTURES: none
KNOWN FAILURES / UNTESTED: effort/Ultracode unverified; font + icon licences not verified against upstream (no network); payload sizes in review are estimates; CVD simulation, SR, keyboard E2E, zoom/reflow all NOT TESTED (no UI exists); dropped ink-4 (#6B7487, 4.45 on canvas) because it failed
DEPENDENCIES / NEXT HANDOFF: Opus responds to consumer review (R-3, R-4a blocking) and decides R-16/R-17 demo questions → Sonnet re-review → M1 contract freeze sign-off; owner reviews identity/typography choices (Instrument Serif/Inter/JetBrains Mono); M5 asset import with licence check
FINAL: NOT TESTED (design documents only; contrast arithmetic computed, everything else unverified; freeze blocked on review items)
```

## M1-R1 round 2 — OpenAPI 0.2.0-draft consumer re-review

```text
TASK_ID: M1-R1 (re-review) | BASE_COMMIT_SHA: cbec1e8 (design branch); reviewed main ffd5b3c | BRANCH/PR: claude/vigorous-yalow-e6f487 (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-sonnet-5-5 / NOT TESTED / NOT TESTED
OWNER: Sonnet | REVIEWER: Opus (response), owner
REQUIREMENT_IDS: AC-API-01, AC-UX-01, SCOPE-05, SCOPE-08
FILES_CHANGED: docs/design/openapi-consumer-review.md (§5 added, header), docs/design/page-matrix.md (0.2.0 bindings), docs/design/component-inventory.md (minor), docs/workflow/integration-log.md (append)
CONTRACT_VERSION CONSUMED / CONTRACT_CHANGES: api/openapi.yaml 0.2.0-draft / none made by Sonnet
BEHAVIOUR IMPLEMENTED: none
SECURITY / DATA IMPACT: none
COMMANDS RUN + ACTUAL RESULTS: `git show refs/heads/main:api/openapi.yaml` diffed vs 0.1.0; `npx @redocly/cli@2 lint` on main copy → valid, 2 warnings (health probes)
TEST FIXTURES: none
KNOWN FAILURES / UNTESTED: no codegen/contract tests run; 8 non-blocking notes N-1..N-8; R-16 demo re-stamp job not built
DEPENDENCIES / NEXT HANDOFF: Opus considers N-1..N-8 (0.2.1 or at freeze) → freeze sign-off (Opus + Sonnet + owner)
FINAL: NOT TESTED (verdict APPROVED on document review only)
```

## M1-FREEZE — Contract freeze 1.0.0

```text
TASK_ID: M1-FREEZE | BASE_COMMIT_SHA: 21a703a (merge of design branch) | BRANCH/PR: main (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-opus-5-5 / NOT TESTED / NOT TESTED
OWNER: Opus coordinator | REVIEWER: Sonnet (APPROVED API 0.2.0), owner (approved freeze in chat)
REQUIREMENT_IDS: AC-API-01..03 (contract), SCOPE-01..10 (design inputs)
FILES_CHANGED: api/openapi.yaml (1.0.0), docs/adr/0001..0004 (Accepted), docs/architecture/api-contract.md, docs/workflow/{contract-freeze,task-board,integration-log}.md
CONTRACT_VERSION CONSUMED / CONTRACT_CHANGES: 0.2.1-draft → 1.0.0 (version only)
BEHAVIOUR IMPLEMENTED: none
SECURITY / DATA IMPACT: none; security docs NOT frozen, pending independent review
COMMANDS RUN + ACTUAL RESULTS: redocly lint → valid, 2 accepted warnings; `python3 -I docs/design/tools/contrast.py` re-run by Opus → all text pairs ≥ 4.5:1, UI pairs ≥ 3:1
TEST FIXTURES: none generated
KNOWN FAILURES / UNTESTED: no codegen or contract tests yet; capacity provisional; effort/Ultracode unverified
DEPENDENCIES / NEXT HANDOFF: M2-001..003
FINAL: PASS (M1 contract freeze recorded) — readiness level (A) planning baseline only
```

## M2-001a / M2-003 — Foundation (backend, infra, CI)

```text
TASK_ID: M2-001a, M2-003 | BASE_COMMIT_SHA: 1a1bbd7 | BRANCH/PR: main (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-opus-5-5 / NOT TESTED / NOT TESTED
OWNER: Opus | REVIEWER: pending (independent correctness/security reviewer)
REQUIREMENT_IDS: SCOPE-10, NFR-03, NFR-07, AC-API-03 (no-store on probes/errors)
FILES_CHANGED: root (.gitignore, .editorconfig, .nvmrc, package.json, pnpm-workspace.yaml, .env.example, Makefile, compose.yaml), services/trace-api/**, infra/otel/collector.yaml, .github/workflows/ci.yml, docs/architecture/compatibility-matrix.md, docs/workflow/*
CONTRACT_VERSION CONSUMED / CONTRACT_CHANGES: API 1.0.0 (health probes only) / none
BEHAVIOUR IMPLEMENTED: trace-api query listener: /livez, /readyz (DB ping, 503 + Retry-After), service-token gate (401 problem+json), 404 for unimplemented routes; config validation incl. public-demo ingest guard; log-safe config; healthcheck subcommand. Collector: otlp receiver → memory_limiter → attribute redaction → otlp_http exporter with sending_queue.batch.
SECURITY / DATA IMPACT: all Compose networks internal, zero host ports; containers read_only + no-new-privileges; trace-api non-root distroless; .env gitignored, generated by `make env`
COMMANDS RUN + ACTUAL RESULTS:
  go vet ./... → clean; gofmt -l → empty; go test -race ./... → ok (cmd/server, internal/config)
  redocly lint → valid (2 accepted warnings); collector validate → exit 0; negative control (unknown key in sending_queue.batch) → rejected
  make up → postgres healthy, trace-api healthy, collector up
  probes (curl on app network): livez 200, readyz 200, no token 401, token 404; postgres stopped → readyz 503, livez 200; restarted → readyz 200
  published host ports → 0; secrets in trace-api logs → 0 hits
  gitleaks git history → no leaks; gitleaks dir → only .env (gitignored, expected) after annotating 3 false positives
  actionlint 1.7.12 → clean
TEST FIXTURES: none
KNOWN FAILURES / UNTESTED: GitHub Actions run NOT TESTED (not pushed); Node 26 NOT TESTED locally; Collector→receiver export NOT TESTED (ingest is M3); image vulnerability scan NOT TESTED; classic Docker builder used locally (no buildx)
DEPENDENCIES / NEXT HANDOFF: M2-001b apps/web shell (Sonnet) → M2-001c web in Compose/CI → M2-002 auth spike
FINAL: PASS (local evidence) / NOT TESTED (CI)
```

## M2-001b — apps/web shell

```text
TASK_ID: M2-001b | BASE_COMMIT_SHA: 8da2226 (merged main 2de56c5) | BRANCH/PR: m2-web-shell (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-sonnet-5-5 / NOT TESTED / NOT TESTED | OWNER: Sonnet | REVIEWER: Opus (ADR-0006, Dockerfile, CI/Compose)
FILES_CHANGED: apps/web/** (package.json, tsconfig, next.config.ts, eslint/vitest/playwright/postcss configs, src/app/{layout,page,not-found,error,tokens.css,globals.css}, src/app/app/{layout,page}.tsx, src/lib/time/nanos(+test).ts, src/lib/api/{client.ts,generated/schema.d.ts}, e2e/smoke.spec.ts, Dockerfile), pnpm-lock.yaml (created by pnpm install), docs/adr/0006-typescript-version.md
ENV: local Node v24.11.1 (NOT 26), pnpm 9.15.9; next 16.4.6, react 19.3.1, tailwind 4.3.5, TypeScript 6.0.3 (7.0.2 failed in openapi-typescript, ADR-0006), vitest 5.1.1, playwright 1.65.1
RESULTS (measured):
 gen:api PASS | typecheck PASS | lint PASS, 0 errors, 0 warnings (2 import/no-anonymous-default-export warnings fixed) | test PASS 4/4 | build PASS: route table `○ /`, `○ /_not-found`, `ƒ /app` (/app made dynamic via `export const dynamic = "force-dynamic"` in src/app/app/layout.tsx; was static before)
 Header: `next start` + `curl -sI http://127.0.0.1:3000/app` → `HTTP/1.1 200 OK`, `Cache-Control: private, no-store`; `/` → `Cache-Control: s-maxage=31536000` (static, intended)
 schema.d.ts: tracked by git (`git ls-files` lists it; `git check-ignore` empty)
 Playwright: chromium installed; `CI=1 pnpm test:e2e` → 2 passed (home→/app link; /app cache-control). Note: webServer uses `next start`, which Next warns is unsupported with `output: standalone`; works, switch to `node .next/standalone/server.js` later
 Docker: BLOCKED. Build context fixed (571.4 kB after root .dockerignore, was ~640 MB); Docker daemon stalls pulling `node:26-alpine` (and `node:24-alpine`) at "Pulling fs layer" while Docker Hub endpoints answer normally. Build not completed; owner decided to skip for now. Container header and non-root checks NOT TESTED. Dockerfile also uses tag-pinned (not digest-pinned) bases.
NOT TESTED: Docker build/run, container header + non-root, Node 26, axe, TS 7 with ESLint/Next
CI/COMPOSE REQUEST FOR OPUS: CI job `web`: setup-node 26, `pnpm install --frozen-lockfile`, `pnpm -C apps/web gen:api && git diff --exit-code apps/web/src/lib/api/generated`, lint, typecheck, test, build (e2e optional: `pnpm exec playwright install --with-deps chromium`). Compose service `web`: build context repo root, `dockerfile: apps/web/Dockerfile`, port 3000, env TRACE_API_URL + service token (not yet read by code), depends_on trace-api.
FINAL: PASS for gen:api/typecheck/lint/test/build/Playwright smoke (local Node 24); BLOCKED for Docker
```

## M2-001b review + M2-001c — web merged, CI web job

```text
TASK_ID: M2-001b (review/merge), M2-001c | BASE_COMMIT_SHA: 441666e | BRANCH/PR: main (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-opus-5-5 / NOT TESTED / NOT TESTED
OWNER: Opus (review, CI) | REVIEWER: owner approved merge + ADR-0006 in chat
REQUIREMENT_IDS: SCOPE-09 (shell), AC-API-01 (generated client), AC-API-03 (no-store)
FILES_CHANGED: .github/workflows/ci.yml (web job), docs/adr/0006 (Accepted), docs/architecture/compatibility-matrix.md, docs/workflow/{task-board,integration-log}.md
COMMANDS RUN + ACTUAL RESULTS (Opus, fresh detached worktree of m2-web-shell, Node 24.11.1):
  pnpm install --frozen-lockfile → ok; gen:api, typecheck, lint, test, build → PASS; generated client diff → none
  next build routes: / static, /_not-found static, /app dynamic
  next start: /app → 200 Cache-Control: private, no-store; / → 200 s-maxage=31536000 (public, revisit when demo data lands); /nope → 404
  actionlint → clean
REVIEW NOTES (non-blocking, queued M5-NOTE): add `import "server-only"` to src/lib/api/client.ts; nav aria-current must become route-aware
KNOWN FAILURES / UNTESTED: Docker image build BLOCKED (daemon stalls pulling node:*-alpine); web Compose service not added; Playwright not in CI; Node 26 NOT TESTED; GitHub Actions run NOT TESTED
DEPENDENCIES / NEXT HANDOFF: M2-001d (Docker, after daemon restart), M2-002 auth spike, M2 gate review
FINAL: PASS (merge + CI config) / BLOCKED (Docker)
```

## M2-002 — better-auth spike

```text
TASK_ID: M2-002 | BASE_COMMIT_SHA: 6cc1627 | BRANCH/PR: main (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-opus-5-5 / NOT TESTED / NOT TESTED
OWNER: Opus | REVIEWER: owner (ADR-0005 high-risk; approved approach before spike)
REQUIREMENT_IDS: SCOPE-07, AC-AUTH-01, AC-AUTH-02, T-02..T-05 (threat model)
FILES_CHANGED: docs/testing/auth-spike.md, docs/testing/spikes/auth-better-auth/{spike.mjs,package.json,package-lock.json,.gitignore}, docs/adr/0005, docs/architecture/compatibility-matrix.md, docs/workflow/{task-board,integration-log}.md
COMMANDS RUN + ACTUAL RESULTS: npm install better-auth@1.7.27 pg@8 (16 min, slow registry); node spike.mjs → 23/24 with defaults (cookie prefix __Secure-); custom names with useSecureCookies:true → invalid "__Secure-__Host-…"; useSecureCookies:false + secure attributes + __Host- names → 24/24; committed copy re-run → 24/24; gitleaks on spike dir → no findings
SECURITY / DATA IMPACT: none deployed; test IDs only, mocked GitHub, throwaway DB removed
KNOWN FAILURES / UNTESTED: real GitHub OAuth; absolute 7 d session cap; denied-login UX; rate limits; Next.js integration; Node 26
DEPENDENCIES / NEXT HANDOFF: M2 gate review; auth implementation at M5/M6 must apply ADR-0005 spike-derived requirements
FINAL: PASS (spike, mocked GitHub)
```

## M2 — first CI run

```text
TASK_ID: M2 CI | BASE_COMMIT_SHA: 8b8bb74 (main, pushed; history author emails rewritten to GitHub noreply before first push)
RUN: https://github.com/Sendiw14/Traceflow/actions/runs/45017824146
RESULTS: go success | contracts success | secrets success | web success (Node 26.13.1) | compose-smoke success
NOTES: compose-smoke proves trace-api image build + probes on a GitHub runner; web Docker image still not built anywhere (no CI job; local daemon pull stall)
FINAL: PASS
```

M2-001b follow-up (2026-11-22): apps/web/Dockerfile replaced `corepack enable && corepack prepare` with `npm install -g pnpm@9.15.9` (Node 25+ images lack corepack, CI exit 127). Docker build NOT TESTED locally; CI compose-smoke is the check.

M2-001b follow-up 2 (2026-11-22): removed `COPY ... apps/web/public` from apps/web/Dockerfile; dir not in git (no static assets yet). Re-add the COPY when a real asset lands. Docker build NOT TESTED locally; CI compose-smoke is the check.

## M2-GATE — Foundation exit evidence

```text
TASK_ID: M2-GATE | HEAD: 796a4e2 (main, pushed) | CI: https://github.com/Sendiw14/Traceflow/actions/runs/45026370632 → all 5 jobs success
MODEL/EFFORT/ULTRACODE VERIFIED: claude-opus-5-5 / NOT TESTED / NOT TESTED (Sonnet session same)
GATE CRITERIA (spec §15 M2: "Fresh-clone bootstrap, lint/build/test succeed"):
  go: gofmt, vet, test -race, build → PASS
  contracts: OpenAPI 1.0.0 lint, Collector 0.165.0 config validate → PASS
  web (Node 26.13.1): frozen install, generated-client drift check, lint, typecheck, Vitest 4/4, build, Playwright 2/2 → PASS
  secrets: gitleaks full history → PASS
  compose-smoke (fresh checkout on runner = fresh-clone bootstrap via `make env && make up`):
    trace-api livez/readyz 200, no token 401, token 404 → PASS
    only published port = web 127.0.0.1:3000 → PASS
    web /app → 200, Cache-Control: private, no-store → PASS
    web container uid = 10001 (non-root) → PASS
    web cannot connect to postgres:5432 → PASS
  auth spike (M2-002): 24/24 with mocked GitHub → PASS
FIX HISTORY THIS GATE: web Dockerfile corepack missing on Node 26 (cc669ff); COPY of nonexistent apps/web/public (796a4e2)
KNOWN FAILURES / UNTESTED:
  local Docker Desktop cannot pull node:*-alpine (works on CI) — BLOCKED locally
  node base image not digest-pinned (Sonnet, before M8)
  no image vulnerability scan; no SBOM (M6)
  effort/Ultracode unverified for both sessions
  docs/security not independently reviewed (SEC-REVIEW)
  capacity profile still assumed (M3/M4)
READINESS: (B) code foundation ready — pending owner gate approval. No ingest/query functionality yet.
FINAL: PASS (M2 gate criteria) — awaiting owner sign-off
```

## M3 — Ingest (Collector → Go → PostgreSQL)

```text
TASK_ID: M3-001..004 | BASE_COMMIT_SHA: 5dc31ff | BRANCH/PR: main
MODEL/EFFORT/ULTRACODE VERIFIED: claude-opus-5-5 / NOT TESTED / NOT TESTED
OWNER: Opus | REVIEWER: pending independent backend/OTLP review
REQUIREMENT_IDS: SCOPE-01..04, AC-OTLP-01..07, AC-DATA-01/02/04, NFR-02 (redaction layer 2), NFR-06
FILES_CHANGED: services/trace-api/{db/**, internal/{ingest,normalize,store}/**, cmd/server/main.go, internal/config}, examples/demo-system/**, compose.yaml, .github/workflows/ci.yml, docs (ADR-0002 notes, data-model deltas, matrix, board)
BEHAVIOUR: POST /v1/traces (protobuf, identity/gzip; 405/415/413/400/429/503 with google.rpc.Status; 200 ExportTraceServiceResponse, partial_success on rejects); 200 only after commit; per-trace advisory lock; identical replay = accepted duplicate; conflicting replay = first write wins + span_conflicts + rejected; summary recompute (roots, orphans, skew, errors, services by first start); limits (4 MiB/16 MiB, 10k spans/request, 50k/trace, attribute/event/link caps); UTF-8/NUL sanitizing; Go-side redaction; retention job hourly
COMMANDS RUN + ACTUAL RESULTS (local, PostgreSQL 18.7 container):
  go test -race -count=1 ./... → ok (cmd/server, config, ingest, normalize, store incl. 12 integration tests)
  mutation: per-trace lock removed → TestConcurrentWritersSameTrace "summary span_count=450 want 1200"; TestSummaryNotLostWhenWriterCommitsLate fails → lock restored, both pass
  stack (host-built binaries, local override): demo load → 5 traces / 32 spans via Collector otlp_http, 0 rejected; shapes normal 6/1/0, slow 6/1/0 823 ms, error 6/1/0 with 5 error spans + exception event, parallel 9/1/0, missing-parent 5/0/1; parent chain gateway S→C→orders S→C→inventory S→DB C
  actionlint → clean; gitleaks on new files → clean
KNOWN FAILURES / UNTESTED: local Docker builds cannot fetch Go modules (TLS/stream errors) → real Dockerfile builds only in CI; OTLP-19 (direct SDK retry on 503) NOT TESTED; Collector restart/overflow drills NOT TESTED; persistent queue not configured; migrations run with runtime role (shortcut until M6); no load test yet (M4)
FINAL: PASS (local) — CI run pending
```

M3 CI: run 45035442575 failed only in compose-smoke (load build output counted as result lines; test-script bug, fixed 05776f7). Run https://github.com/Sendiw14/Traceflow/actions/runs/45035824037 on 05776f7 → go (incl. 12 PostgreSQL integration tests, -race), contracts, web, secrets, compose-smoke (demo SDK → Collector → trace-api → PostgreSQL; 5 scenario shapes + slow ≥ 800 ms + collector-sourced 200 records) all success. FINAL: PASS (M3 gate criteria; OTLP-19 and failure drills still NOT TESTED).

## M4 — Query API, analytics, topology

```text
TASK_ID: M4-001..002 | BASE_COMMIT_SHA: 224da1f | BRANCH/PR: main
MODEL/EFFORT/ULTRACODE VERIFIED: claude-opus-5-5 / NOT TESTED / NOT TESTED
OWNER: Opus | REVIEWER: pending (Sonnet as API consumer at M5; independent backend review)
REQUIREMENT_IDS: SCOPE-05 (data), AC-API-01..03, AC-DATA-03, AC-PERF-01/02
FILES_CHANGED: services/trace-api/internal/{api (generated), query, httpapi, testdb}/**, tests/perf, cmd/server, store (first_span_received_at), go.mod (oapi-codegen tool), CI (codegen drift), docs (api-contract semantics, benchmark-results, capacity-profile, matrix)
CONTRACT_VERSION CONSUMED / CONTRACT_CHANGES: 1.0.0 / none
COMMANDS RUN + ACTUAL RESULTS (local, PostgreSQL 18.7):
  go test -race -count=1 ./... (twice) → all ok, incl. httpapi contract suite (9 tests)
  contract: all 15 success calls + 8 error calls validated against api/openapi.yaml; negative control rejects 3 invalid bodies
  oracle: request/error counts, error_fraction, p50/p95/p99 match independent nearest-rank oracle for all/gateway/orders/inventory
  pagination 120 traces, limit 7 → no skip/dup, DESC order; cursor + changed filter → 400 cursor_filter_mismatch
  dependencies: only gateway→orders (120 pairs) and orders→inventory (120), basis client_server, endpoints ⊂ nodes
  benchmark (dev host, PG capped 4 CPU/8 GB): ingest 300,000/300,000 accepted at 499.97 spans/s, 0 failures; trace list p95 2.08 ms, detail p95 5.26 ms, 0 % errors over 1.05 M requests
  bugs found by tests and fixed: constant ORDER BY in ungrouped stats (PostgreSQL 42601); test packages sharing one database
KNOWN FAILURES / UNTESTED: reference Linux host benchmark; 7-day windows; aggregate endpoints under concurrent load; UI integration (M5)
FINAL: PASS (local) — CI pending
```

M4 CI: run 45039003998 failed only in compose-smoke (probe still expected M2-era 404 for /v1/overview; fixed 840697b). Run https://github.com/Sendiw14/Traceflow/actions/runs/45039390875 on 840697b → go (incl. codegen drift check, PostgreSQL integration, OpenAPI contract + oracle tests, -race), contracts, web, secrets, compose-smoke all success. FINAL: PASS (M4 gate criteria on dev host; reference-host benchmark NOT TESTED).

## M5-A — BFF data layer + `/app` overview (Sonnet, branch `m5-ui`)
- **Scope:** `apps/web` only. `import "server-only"` in `src/lib/api/client.ts`; `src/lib/server/data.ts` is the only trace-api caller (env `TRACE_API_URL`, `TRACEFLOW_SERVICE_TOKEN`, never browser-visible; errors normalised to `Result<T>`). Shared UI (Notice/Empty/Problem/Kpi/Skeleton, accessible sortable table, SVG `TimeSeriesChart` with keyboard + table view, Freshness with visibility-aware `router.refresh()` polling), `/app` overview with all matrix panels and states, route-aware `aria-current`, `/app` stays `force-dynamic` + `private, no-store`.
- **Commands / results (local, Node v24.11.1):** `pnpm test` PASS (Vitest: windows, params, formatting, series, chart, problem copy); `pnpm lint` PASS; `pnpm typecheck` PASS. Manual: `/app` rendered against a real isolated stack (Postgres 18.7 + trace-api built from `services/trace-api` + demo gateway/orders/inventory, all in Docker) with live traces: KPIs, null-percentile reason (`p99 needs 100 samples; this window has 60`), exemplar link.
- **NOT TESTED:** Playwright/axe (written with the route groups), Node 26, behaviour under `operator-prod`.
- **Deviations (documented):** service scope is a native `<select>` GET form (not an ARIA combobox); times are UTC only (no `tz=local` toggle yet); range is presets only (no custom absolute `from`/`to` yet).

## M5-B — `/app/traces` and `/app/traces/[traceId]` (Sonnet, branch `m5-ui`)
- **Scope:** URL-synced filters (service any-span, status, min duration; chips; clear), stateless cursor paging via a Server Action (trace-api stays server-side; "Load more" appends, dedupes, focuses first new row, announces count; sorting is labelled "within loaded rows"); all four states (nodata/nomatch/window, error, partial badges). Trace detail: header + copy, notices (truncation, missing parent, multi-root, clock skew, estimate, late-arrival), Waterfall/Tree/Table sharing one selection + `?span=`, orphan group "Parent span not received", axis from non-negative durations and frozen while a span is selected, roving-tabindex keyboard map, "Next error span" button, inspector (full from payload; lite via `fetchSpan` Server Action with loading/error/retry), polling every 10 s only while visible and a span arrived in the last 60 s ("Trace updated · +N spans"). Invalid trace ID → 404 view without an API call; API 404 → in-page "Trace not found" state.
- **Lite threshold:** lite first, full fetched only when ≤ 1000 spans (initial guess). Above 5000 spans the tree opens collapsed instead of virtualised.
- **Commands / results (local):** `pnpm lint` PASS, `pnpm typecheck` PASS, `pnpm test` PASS (adds tree/axis/geometry and AnyValue tests). Production build (`output: standalone`) served against the real stack; manual check of list, filter, trace page, inspector selection and `?span=` sync PASS.
- **NOT TESTED:** keyboard-only flow and axe (Playwright in the test group), mobile layout, traces with > 1000 spans (lite path and large-trace banner are unexercised against real data), `tz=local`.
- **Deviations:** inspector is an inline panel on all widths (no bottom sheet yet); waterfall below 768 px relies on horizontal scroll (no tree-first default switch).

## M5-C — `/app/services`, `/app/services/[serviceName]`, `/app/map`, `/app/analytics` (Sonnet, branch `m5-ui`)
- **Scope:** Services list (client search `q`, sortable, `n<N` for null percentiles, "no server spans", "idle in window", population note once). Service detail (KPIs, latency + error charts, operations table with exemplar/error-trace links, `?operation=` drill chart, upstream/downstream edge tables with evidence copy, recent traces, filtered-list link; known-but-idle → notice + 7d link; API 404 → "No such service"; names decoded and rendered as text only, `<img src=x>` verified inert). Map: deterministic layered SVG layout (no physics), log-width edges, dashed for `other_parent_child`, ✕ for error pairs, border-thickness volume buckets + legend, zoom/pan/fit buttons, listbox keyboard model (arrows to nearest node, Enter, Esc, +/−/0), details panel, always-rendered sortable/filterable edge table synced with edge selection, >50 nodes → table-first, mobile → graph behind a button. Analytics: service/operation/bucket/compare scope form (bucket clamped to the 2 000-point cap), latency + error series with previous-period overlay, percentile summary with insufficient-sample reasons, histogram (bounds from API, table view, keyboard), error breakdown (per service, or per operation when a service is selected), sample counts, source label.
- **Commands / results (local):** `pnpm lint` PASS, `pnpm typecheck` PASS, `pnpm test` PASS (50 tests: edges, graph layout/nearest/encodings, bucket clamp, series shift). Production build + smoke against the real stack: all four routes return 200 with expected regions; unknown service renders the not-found state; map screenshot checked.
- **NOT TESTED:** keyboard/axe/J-04 (Playwright group), map with > 50 nodes and with a cyclic graph on real data (cycle handling is unit-tested only), mobile layout, 7 d windows, operation drill on a service with many operations.
- **Notes:** unknown service / trace render in-page not-found states with HTTP 200 (app-router limitation when not calling `notFound()`); fine for private pages.

## M5-D — `/app/onboarding`, `/app/settings`, complete nav (Sonnet, branch `m5-ui`)
- **Scope:** Onboarding: connection status derived from `getIngestionStatus` (waiting / quiet / connected, announced only on transition via a polite region; refresh every 3 s only while waiting and the tab is visible), reject-reason advice keyed by the `RejectReason` enum with a generic fallback, non-2xx request counts, Collector-drop caveat, static copyable Collector YAML mirroring `infra/otel/collector.yaml`, troubleshooting. Settings: retention form (Server Action validates 1–90 integer, maps `Problem.errors[]` to the field), native `<dialog>` confirm when lowering retention (initial focus Cancel, Esc cancels, focus returns to trigger, action-labelled confirm, states irreversibility and next run), `read_only` → no controls, failed/partial last run warning, read-only limits, ingestion summary. Nav now lists exactly the seven routes that exist.
- **Contract finding (details in `openapi-consumer-review.md` §6):** `X-Traceflow-Actor` must be a numeric GitHub ID; with no sign-in the BFF sends sentinel `"0"`. M6 must replace it with the session identity before `operator-prod` can serve `/app/settings`.
- **Commands / results (local):** `pnpm lint` PASS, `pnpm typecheck` PASS, `pnpm test` PASS (54). Against the real stack: `/app/onboarding` renders the quiet state; real retention change 7→5 via the dialog (confirm focused Cancel, API accepted, UI showed "Recorded in the audit log") then 5→7 without a dialog; `/app/settings` is `private, no-store`.
- **NOT TESTED:** onboarding "waiting" and "connected" transitions on an empty database / live ingest, reject-reason notices with real rejected spans, `read_only` (needs a read-only profile), PATCH 403, axe and keyboard journeys (Playwright group).
- **Deviations:** no timezone/time-format preferences (only UTC is implemented; a control that does nothing would be a phantom feature).

## M5-E — tests: Vitest, Playwright journeys, axe, mobile reflow (Sonnet, branch `m5-ui`)
- **Added:** `@axe-core/playwright` 4.14.0 (dev). Playwright config now builds and runs the **standalone** server (`node .next/standalone/apps/web/server.js`, no more `next start` warning) or targets `E2E_BASE_URL`. Specs in `apps/web/e2e/`: `smoke` (no-store on all 7 app routes, nav lists only existing routes and sets `aria-current`, invalid trace ID → 404 view), `journeys` (BFF isolation: no request to the trace-api host and the service token never appears in any document; **J-02** overview p95 exemplar → trace with a selected span; **J-03** keyboard only: Tab to trace link → Enter → Tab to "Next error span" → Enter focuses an error row, arrow/Enter/Escape; **J-04** map listbox keyboard model, edge table row → supporting trace; URL-synced filters/clear/paging without duplicates; missing-parent group; service not-found; analytics compare + table view), `a11y` (axe tags wcag2a/2aa/21a/21aa/22aa on 10 route/query variants and trace detail with inspector, tree and table), `mobile` (375 px: no page-level horizontal scroll on 8 routes, map graph behind a button).
- **Real-stack setup used (isolated, local):** Postgres 18.7 + `services/trace-api` image built from `main` (34c94c0) + demo gateway/orders/inventory built from `examples/demo-system`, all in Docker on a private network; trace-api query port published on loopback only; web run with `TRACE_API_URL` and `TRACEFLOW_SERVICE_TOKEN`. Traces from the demo `load` scenarios (normal, slow, error, parallel, missing-parent). The Compose `web` service and `traffic` service were not used (not on this branch).
- **Commands / results:**
  - `pnpm test:e2e` (builds standalone, starts it, runs against the real stack): **23 passed** (smoke 4, journeys 8, axe 11).
  - `E2E_BASE_URL=… pnpm exec playwright test e2e/mobile.spec.ts`: **9 passed**.
  - `pnpm lint` PASS · `pnpm typecheck` PASS · `pnpm test` PASS (12 files, 54 tests) · `pnpm build` PASS (route table: `/app` and seven sub-routes all `ƒ` dynamic).
- **Fixed from the first axe run:** `definition-list` (stray div in the ingestion `<dl>`), `link-in-text-block` (links in text had no underline; base link style now in `@layer base` so utilities still win), `label-content-name-mismatch` (aria-labels on short trace IDs and on map nodes), nested `<main>` in the 404 view (new `app/not-found.tsx`).
- **NOT TESTED:** the Compose `web` + `traffic` path and the Docker image run (no Docker pull issue now, but Compose wiring is not on this branch); Node 26 locally (v24.11.1 here; CI uses 26); `read_only`/`public-demo` profiles; empty-database onboarding "waiting" transition and non-empty reject reasons; traces with > 1 000 / > 5 000 spans (lite path, large-trace banner); axe in dark/high-contrast modes (none exist); manual screen-reader pass; Firefox/WebKit (Chromium only); 7 d windows on large data.
- **Follow-ups for others:** Opus — resolve C-1 before M6 (see `openapi-consumer-review.md` §6), tick M5-NOTE (`server-only`, route-aware `aria-current` are done) on the task board, add `TRACE_API_URL`/`TRACEFLOW_SERVICE_TOKEN` to Compose `web`. Sonnet — large-trace measurement, absolute time range + `tz`, public site/`/demo`/`/docs`/`/login` round.

M5 CI: merge run 45210771702 failed (web: e2e had no stack; secrets: gitleaks false positive on onboarding Collector sample). Fixed 7b14221. Run https://github.com/Sendiw14/Traceflow/actions/runs/45221698786 → go, contracts, web, secrets, compose-smoke all success; Playwright 32/32 against the real stack on the GitHub runner (Node 26). FINAL: PASS (M5 /app scope). Open: public site, docs, /login, /demo routes; sign-in (M6).

## M5b-A — server-side profile gating (Sonnet, branch `m5b-public`)
- **Scope:** `apps/web/src/proxy.ts` (Next 16 proxy, runs for every request including Server Action POSTs) gates by `TRACEFLOW_PROFILE` read at request time: `public-demo` → `/app/**` 404; `operator-prod` → `/demo/**` 404; `local-dev` → both; missing/unknown → both 404 (fail closed). Gated requests are rewritten to a non-existent path so the 404 body is identical to any unknown route (no existence leak). `lib/profile.ts` holds the pure rules (unit-tested); `updateRetention` re-checks the profile because Server Action IDs are path-independent.
- **Tests:** `e2e/profiles.spec.ts` against five servers started by `e2e/serve.sh` (3100 local-dev, 3101 public-demo, 3102 operator-prod, 3103 unset, 3104 bogus). Playwright config now runs that script.
- **Results (local, real stack at 127.0.0.1:18080):** profiles spec 5 passed; `pnpm lint` PASS; `pnpm test` PASS.
- **Flag for Opus/M6:** under `operator-prod` `/app` is currently served with **no sign-in** (auth lands in M6). Do not deploy `operator-prod` before the session check exists.
- **NOT TESTED:** `/demo` under local-dev (route not built yet; added in the demo group).

## M5b-B — site shell and `/demo`, `/demo/traces/[traceId]` (Sonnet, branch `m5b-public`)
- **Scope:** `(site)` route group (header/footer; the Demo link and CTA appear only when the profile allows `/demo`, so no phantom link under `operator-prod`). `/demo`: persistent violet banner "Synthetic data — read-only demo. No real traffic.", overview KPIs + latency/error/throughput charts, services table, inline service investigation (`?service=`: KPIs, operations with exemplar/error links, observed calls), trace list with URL filters (service, status, min duration) and "Load more"; `/demo/traces/[traceId]` shares the trace view with `/app` (waterfall/tree/table/inspector, `?span=` deep link). Shared pieces were refactored, not copied: `TraceDetail`, `OverviewBody`, `LatencyPanels`; link bases are props (`/app` vs `/demo`). Demo code calls only `getOverview`, `getServerLatency`, `listServices`, `getService`, `listTraces`, `getTrace`, `getSpan`.
- **Isolation guard:** `src/app/demo/isolation.test.ts` fails if demo code references `getIngestionStatus`, `getSettings`, `updateSettings`, `/app/settings`, `/app/onboarding` or `/login`.
- **Results (local, real stack at 127.0.0.1:18080):** `e2e/demo.spec.ts` (run under both `local-dev` and `public-demo` servers): banner + no private/admin/login links, service investigation → error trace → span, `?span=` survives reload, invalid/unknown trace IDs; `profiles.spec.ts` now includes `/demo` 200 under local-dev and `/`, `/docs`, `/demo` 200 under public-demo. Vitest 68 PASS, lint PASS, typecheck PASS.
- **NOT TESTED:** a real `public-demo` deployment (separate read-only API instance and DB role): this round runs the web app with the profile flag against the local-dev API, so "the demo cannot reach private data" is verified for the web layer only; the "demo data is re-stamped hourly" seed job (R-16) does not exist yet, so default windows rely on live traffic.

## M5b-C — `/docs/**` (Sonnet, branch `m5b-public`)
- **Pages:** `/docs`, `/docs/getting-started`, `/docs/instrumentation`, `/docs/architecture`, `/docs/deployment`, `/docs/security`, with version banner "V1, in development", sidebar (disclosure below 768 px), "On this page", prev/next, copy buttons. Written in TSX from repo sources; no new claims.
- **Source map for the reviewer (verify against these):** commands → `Makefile`, `compose.yaml`; env vars → `.env.example`, `compose.yaml`; services/networks/read-only/no-new-privileges → `compose.yaml`; OTLP rules and limits → ADR-0003, `GET /v1/settings` limits (4 MiB / 16 MiB / 10 000 spans per request / 50 000 per trace), `normalize.go` (`unknown_service`, `[REDACTED]`); Collector config → verbatim `infra/otel/collector.yaml` (Vitest asserts identical); SDK snippet → simplified `examples/demo-system/main.go` `setupTracing`; dedupe/conflict → ADR-0002; percentile floors/edges/estimate semantics → `api-contract.md`; retention 7 d default / 1–90 d → `privacy.md`, settings validation; profiles → `deployment-topology.md`, `authz-matrix.md`, `src/lib/profile.ts`; sign-in plan → ADR-0005; token compared in constant time → `internal/authz/token.go`.
- **Deliberate gaps stated on the pages:** `/docs/deployment` says plainly that operator-prod/public-demo deployment (TLS, production Compose, backups, update workflow) is not built and gives no instructions; `/docs/security` says sign-in lands in M6, remote OTLP ingest is off by default, the threat model is a draft pending independent review, and **no security contact is published yet** (there is no `SECURITY.md`; the page tells readers to open an issue asking for a private channel without exploit details). Opus/owner: decide on a real disclosure channel.
- **Results (local):** `e2e/docs.spec.ts` PASS: every internal link and anchor on each page resolves (200 and the `id` exists), external links limited to the repository, nav `aria-current`, prev/next, copy button copies exactly `make up`, required statements present. Docs are rendered per request (profile-aware header), not statically.
- **NOT TESTED:** a clean-clone walkthrough of `make env && make up` (Docker pulls blocked locally per the coordinator); the example output lines are real output from an earlier local run; Windows/WSL notes are absent on purpose.

## M5b-D — landing `/`, public-site tests (Sonnet, branch `m5b-public`)
- **Landing:** original white-first editorial page: hero (H1 "Every request has a story. See the whole picture.", CTAs Explore live demo → `/demo` and View GitHub → https://github.com/Sendiw14/Traceflow, trace illustration drawn from the real `normal` demo trace, Skip animation, reduced-motion = no animation), problem/solution, journey (five scenario tabs over real captured shapes in `src/content/demo-traces.ts`, captured from the local real stack on 2026-11-24), features, waterfall + service-map figures, architecture, getting-started snippet with copy, OSS, FAQ (`<details>`), final CTA, footer. No metrics, users, logos or production-ready claim (the word appears only as an FAQ question answered "No. V1 is in development"); a test enforces the banned-phrase list.
- **Copy sources:** every feature and FAQ statement maps to a page already cited in M5b-C or to the shipped UI; the demo shapes are real captures (timings are that run's).
- **Full suite (local, real stack at 127.0.0.1:18080, five web servers via `e2e/serve.sh`):** `pnpm test:e2e` **83 passed**: smoke 4, profiles 6, docs 9, landing 8, demo 7, journeys 8, a11y 22 (axe WCAG 2.0/2.1/2.2 A+AA on `/`, 6 docs routes, `/demo` ×2, 10 app variants, trace detail states, landing after interaction, demo trace with inspector), mobile 19 (375 px: no page-level horizontal scroll on `/`, docs, demo, app routes; docs menu disclosure; map toggle). Vitest 68 PASS, lint PASS, typecheck PASS, build PASS (all site/docs/demo/app routes `ƒ`).
- **NOT TESTED:** a real `public-demo` deployment (see M5b-B); visual QA at 360/768/1024/1440 px beyond the 375 px reflow check and one desktop screenshot; Safari/Firefox (Chromium only); screen-reader pass; Lighthouse/web-vitals budgets for the public routes; the clean-clone docs walkthrough; copy review by the owner (tone, FAQ wording).
- **For Opus before merge:** verify docs against the source map in M5b-C; decide the security contact (none exists); `operator-prod` serves `/app` without sign-in until M6 (flagged in M5b-A).

## M5b-E — second, independent profile gate (review fix) (Sonnet, branch `m5b-public`)
- **Change:** `src/lib/profile.ts` gains `assertArea` (calls `notFound()`) and `actionAllowed`. `app/app/layout.tsx` and `app/demo/layout.tsx` call `assertArea` per request; every server action re-checks: `updateRetention` (area `app`), `loadMoreTraces` and `fetchSpan` (shared by `/app` and `/demo`, so allowed when either area is served; refused for unset/unknown profile). `proxy.ts` stays the first layer.
- **Proof:** `src/lib/guards.test.ts` calls both layouts and all three actions directly (no proxy) under every profile: layouts throw not-found for disallowed profiles and render for allowed ones; actions refuse and never reach trace-api (data module mocked to throw). Vitest 72 PASS; full `pnpm test:e2e` 84 PASS incl. a new Playwright test that sends the `x-middleware-subrequest` header at gated routes on public-demo, operator-prod and unknown-profile servers (all 404).
- **Honest limit:** the Playwright header test cannot by itself prove layer 2 (the proxy also answers 404 there); the unit test is the proof that each layout/action refuses without the proxy. Server Action POSTs against a real gated server with a valid action ID are NOT TESTED end to end.

M5b CI: run https://github.com/Sendiw14/Traceflow/actions/runs/45458676153 on 73713cd → go, contracts, web, secrets, compose-smoke all success; Playwright 84/84 against the real stack on the GitHub runner. FINAL: PASS (M5 complete except /login, which lands with sign-in in M6).

## M6-001 — Least-privilege database roles

```text
TASK_ID: M6-001 | BASE: 55ac0ba | BRANCH: main
REQUIREMENT_IDS: NFR-03, T-14 (threat model), data-model "DB roles"
FILES: services/trace-api/{db/roles.go, cmd/server/main.go (migrate subcommand; runtime CheckMigrated), internal/store/roles_integration_test.go}, compose.yaml (migrate service; runtime URL as traceflow_app), .env.example, Makefile (`make env` fills all secrets without rm), docs
RESULTS:
  TestDatabaseRolesLeastPrivilege → PASS: app DML ok, CREATE/DROP/ALTER/TRUNCATE → 42501; ro SELECT only, no goose table; auth role cannot connect to trace DB; app cannot connect to auth DB; EnsureRoles idempotent
  make env in clean dir → 5 distinct 64-hex secrets; second run refuses to overwrite
  live local stack: migrate job exit 0 ("migrations applied and roles ensured"); trace-api sessions = traceflow_app only; ingest and query API working
UPGRADE NOTE: existing local .env lacks the new secrets → move it aside, `make env`, and (to keep an existing pgdata volume) copy the old POSTGRES_PASSWORD back
FINAL: PASS (local) — CI pending
```

## M6-002 — Operator authentication core (ADR-0005)

```text
TASK_ID: M6-002 | BASE: 8055369 | BRANCH: main
REQUIREMENT_IDS: SCOPE-07, AC-AUTH-01/02, T-02..T-06, T-20
FILES: apps/web/src/lib/auth/{config,core,server}.ts + tests, apps/web/src/app/api/auth/[...all]/route.ts, apps/web/package.json (better-auth 1.7.27, pg 8.23.1, @types/pg 8.23.1), pnpm-lock.yaml, CI (web job Postgres + TRACEFLOW_REQUIRE_AUTH_DB), ADR-0005 amendments, auth-spike.md, matrix
RESULTS (local, PostgreSQL 18.7):
  vitest src/lib/auth → 19/19 (11 config unit: fail-closed env, numeric allowlist, 7 d cap; 8 integration: state+PKCE S256+own redirect_uri, external callbackURL refused, wrong state → /login no session, allowlisted login with __Host- Secure HttpOnly Lax Path=/ no Domain Max-Age 43200, denied → 302 /login?error=denied with no rows, renamed login allowed, cross-origin sign-out 403, same-origin sign-out deletes session + Clear-Site-Data, linking disabled)
  SECURITY FINDING (fixed): better-auth skipped origin/CSRF/callbackURL checks under NODE_ENV=test → forced on; both previously-accepted attacks now 403
  web typecheck, lint, 83 unit (+8 integration skipped locally w/o DB), build → PASS
  TRACEFLOW_REQUIRE_AUTH_DB=1 without DB → suite fails (cannot silently skip in CI)
NOT DONE: /login UI and getOperator() wiring into /app layouts and actions (Sonnet); real GitHub OAuth (needs OAuth app, pre-M8); rate limiting on auth routes
FINAL: PASS (local) — CI pending
```

## M6-003/004 — Supply chain scan + SBOM; OTLP-19

```text
TASK_IDS: M6-003, M6-004 | BASE: 19674cd
M6-002 CI: https://github.com/Sendiw14/Traceflow/actions/runs/45463503295 → all 5 jobs success (auth integration suite on PostgreSQL in web job)
M6-003: CI compose-smoke runs Trivy 0.76.2 (digest-pinned): images traceflow-{trace-api,web,gateway} + `trivy fs .` fail on fixable CRITICAL/HIGH; postgres/collector images report-only; CycloneDX SBOMs uploaded (sbom-cyclonedx, 30 d)
  local fs scan before fix → examples/demo-system golang.org/x/net v0.59.0: CVE-2026-78661 (HIGH, fixed 0.62.0), CVE-2026-78669 (HIGH, fixed 0.60.0) → bumped to v0.62.0 → rescan 0 findings in all 4 lockfiles
  image scans NOT TESTED locally (local Docker builds blocked) — first run in CI
M6-004: TestOTLP19ReferenceSDKRetriesOn503 → PASS: otlptracehttp v1.47.0 direct to receiver; storage fails twice → 503 Retry-After 5 ×2, then 200; 3 attempts, 1 span stored; elapsed ≥ 9 s proves Retry-After honoured over 50 ms backoff
```
