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
