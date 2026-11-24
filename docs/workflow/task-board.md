# Task Board

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| M0-001 Spec adoption + M0 drafts | Opus | DONE (owner review pending) | commits 2900302, 3a534ae |
| M1-B1 Architecture overview, ADR-0001…0005, compatibility, topology | Opus | DRAFTED | ADR-0005 accepted (conditional on M2 spike) |
| M1-B2 Data model + fixture contract | Opus | DRAFTED | |
| M1-B3 `api/openapi.yaml` 0.2.1-draft | Opus | DRAFTED, lint valid | Sonnet APPROVED 0.2.0; notes folded into 0.2.1 |
| M1-B4 Capacity profile | Opus | PROVISIONAL | numbers assumed until M3 measure |
| M1-B5 Threat model, authz matrix, privacy | Opus | DRAFTED | independent review + owner sign-off |
| M1-D1 Design system: identity, tokens, typography, grid, chart palette | Sonnet | DONE (frozen) | `docs/design/` |
| M1-D2 Page matrix + data-to-UI bindings against `api/openapi.yaml` | Sonnet | DONE (frozen) | |
| M1-D3 Component inventory, motion spec, accessibility matrix, asset inventory | Sonnet | DONE (frozen) | |
| M1-D4 Creative benchmark/moodboard study (spec §9.2) | Sonnet | DONE (frozen) | read-only research |
| M1-R1 Sonnet consumer review of OpenAPI | Sonnet | DONE (APPROVED) | answers questions in `api-contract.md` |
| M1-FREEZE Contract freeze v1.0.0 sign-off | Opus + Sonnet + owner | DONE 2026-11-22 | see contract-freeze.md |
| M2-001a Root workspace, Go skeleton, Compose, CI | Opus | DONE (CI run 45017824146 green) | |
| M2-001b `apps/web` shell: Next.js, tokens, lint/typecheck/test, generated client | Sonnet | DONE (merged 441666e; Docker BLOCKED) | ADR-0006 accepted |
| M2-001c Add web to CI | Opus | DONE (CI web job green on Node 26.13.1) | |
| M2-001d Add web to Compose + Docker build | Opus + Sonnet (Dockerfile) | DONE (CI run 45026370632) | built on GitHub runner; local Docker still stalls |
| M5-NOTE `import "server-only"` in `src/lib/api/client.ts`; route-aware `aria-current` | Sonnet | TODO | from Opus review of M2-001b |
| M2-002 Auth spike (better-auth) for ADR-0005 | Opus | DONE — PASS 24/24 (mocked GitHub) | docs/testing/auth-spike.md |
| M2-003 Verify Collector v0.165.0 `sending_queue.batch` | Opus | DONE (config schema PASS; export NOT TESTED until M3) | exporter name `otlp_http` |
| SEC-REVIEW Independent read-only review of docs/security | independent reviewer + owner | TODO | |
| M2-GATE M2 exit review | Opus + owner | APPROVED by owner 2026-11-22 | readiness (B) code foundation |
| M3-001 Migration, OTLP receiver, normalize/redact, store (dedupe, conflicts, summaries, limits) | Opus | DONE (local evidence) | fixtures OTLP-01..17 |
| M3-002 Demo system (gateway→orders→inventory, 5 scenarios) + Collector interop | Opus | DONE (local, host-built binaries) | OTLP-18, DATA-01/05-08 |
| M3-003 Retention job | Opus | DONE | |
| M3-004 CI: Postgres integration + interop smoke | Opus | DONE (CI run 45035824037 green) | real Dockerfiles built on runner |
| M3-GATE M3 exit review | Opus + owner | APPROVED by owner 2026-11-22 | |
| M3-OPEN OTLP-19 direct SDK retry-on-503 test; persistent Collector queue eval; failure drills (PG/Collector restart) | Opus | TODO | M6 at latest |
| M4-001 Query API (all 1.0.0 operations), generated Go models, contract + oracle tests | Opus | DONE (CI run 45039390875 green) | |
| M4-GATE M4 exit review | Opus + owner | APPROVED by owner 2026-11-23 | |
| M4-002 Benchmark PERF-01/02 on dev host | Opus | DONE — targets met on dev host; reference Linux host NOT TESTED | benchmark-results.md |
| M4-OPEN reference-host benchmark; 7-day window aggregates; dependencies query optimisation if needed; Sonnet: switch UI fixtures to real API (M5) | Opus/Sonnet | TODO | |
| M5-OPUS Compose web env (TRACE_API_URL, token) + local `traffic` generator (5 scenarios / 15 s) | Opus | DONE (local: traces 5→15 in 32 s) | |
| M5-UI All /app routes on real API, states, BFF, Playwright J-02/J-03/J-04, axe | Sonnet | DONE (merged; Opus re-ran: web checks PASS, 54 unit, 32/32 e2e) | C-1 actor sentinel must be replaced in M6 |
| M5-OPEN Public site, docs, /login, /demo routes; API C-2/C-3/C-6 additive changes | Sonnet / Opus | TODO | |
| M5b Public site, docs, /demo, profile gating (no /login until M6) | Sonnet | DONE (merged; Opus re-ran: 72 unit, 84/84 e2e, gating per profile incl. bypass header) | M6: shared read actions need session check in operator-prod |
| M5-GATE M5 exit review | Opus + owner | APPROVED by owner 2026-11-25 | /login moves to M6 with sign-in |
| M6-001 DB roles: migrate job (superuser), traceflow_app (no DDL), traceflow_ro, traceflow_auth + separate auth DB | Opus | DONE (local + integration test) | `.env` regenerated: old local .env must be moved aside and `make env` re-run |
| M6-002 Auth core: better-auth wiring, GitHub allowlist, __Host- cookies, 12 h/7 d, denied redirect, origin check forced on | Opus | DONE (19 auth tests; CI pending) | Sonnet to integrate /login + getOperator |
| M6-003 Supply chain: Trivy image + lockfile scan (fail on fixable CRITICAL/HIGH in our artefacts), CycloneDX SBOM artifact | Opus | DONE locally (fs scan found + fixed 2 HIGH in demo x/net); CI pending | third-party images report-only |
| M6-004 OTLP-19: reference OTel Go SDK → receiver, 2×503 then 200, Retry-After honoured, stored once | Opus | DONE (10.0 s test) | |
| M6-005 Failure drills (PG stop, trace-api stop, Collector restart) + Collector self-metrics | Opus | DONE (80/80 traces survived; 0 send failures) | docs/testing/failure-drills.md |
| M6-006 operator-prod: compose.production.yaml, Caddy (TLS, headers, ingest 404), backup/restore scripts + runbooks, restore drill | Opus | DONE (configs validate; restore drill PASS unencrypted) | age not installed → encrypted round trip NOT TESTED; not deployed |
| M6-OPEN web runtime image: drop bundled npm (6 HIGH via Trivy) | Sonnet | DONE (merged 18c82e0; node pinned by digest) | CI verifies |
| M6-UI /login, sign-in on /app, auth at data source (call()), actor from session | Sonnet | DONE (merged; Opus review PASS: 106 unit, 93/93 e2e, signed-out operator-prod → /login, RSC request returns no data) | real GitHub NOT TESTED |
