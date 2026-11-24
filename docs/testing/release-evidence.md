# Release Evidence (M7 acceptance) — V1

**As of:** 2026-11-25 · **Readiness level supported:** **(C) integrated functionality ready** on the local stack. **Not** (D) release candidate: owner-only items below are open. **Not** (E) public release.
Statuses: PASS · FAIL · NOT TESTED · BLOCKED. Every PASS links to a repeatable test or recorded run.

## Functional and correctness

| Area | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| OTLP | AC-OTLP-01..06: protobuf, gzip, 200/partial/400/413/415/429/503 with exact bodies, 200 only after commit | PASS | `internal/ingest/handler_test.go`; CI go job |
| OTLP | AC-OTLP-07: identical replay idempotent; conflicting replay first-write-wins + audit | PASS | `internal/store/ingest_integration_test.go` (OTLP-11/12) |
| OTLP | OTLP-18 real Collector interop; OTLP-19 reference SDK retry on 503 + Retry-After | PASS | CI compose-smoke demo shapes; `sdk_interop_test.go` |
| Data | AC-DATA-01/04: 3-service propagation, late/orphan/multi-root, skew flags | PASS | integration tests; CI interop shapes (normal/slow/error/parallel/missing-parent) |
| Data | AC-DATA-02: ns as int in PG, decimal strings in JSON, int64 exact round trip | PASS | OTLP-16 test; contract tests |
| Data | AC-DATA-03: stats/percentiles/edges match independent oracle | PASS | `internal/httpapi/contract_integration_test.go` (TestStatsMatchOracle, dependencies) |
| API | AC-API-01: one OpenAPI source; Go models + TS client generated; drift checks both sides | PASS | CI go (codegen drift) + web (gen:api diff) |
| API | AC-API-02: cursor pagination no skip/dup; filter-bound cursor | PASS | TestPaginationNoSkipNoDuplicate |
| API | AC-API-03: `private, no-store` on every response (API and /app pages) | PASS | contract tests; M5 manual header sweep |
| Retention | hourly bounded deletes, audit of last run | PASS | TestRetentionDeletesOnlyExpiredTraces |
| UX | AC-UX-01: every V1 route with real data + all states; no phantom links | PASS (automated) | Playwright 93/93 in CI; page matrix |
| UX | J-01 clean clone → trace found | PASS (CI 45495842392) | compose-smoke runs README quickstart verbatim (`scripts/readme-quickstart.sh`); Playwright J-02 finds the slow span |
| UX | J-02/J-03/J-04 journeys (slow span, error span by keyboard, map → trace) | PASS (automated) | Playwright journeys in CI |
| UX | Usability sessions with 3 participants (spec §1.3, §16.3) | **NOT TESTED** | owner action |

## Security

| Criterion | Status | Evidence |
| --- | --- | --- |
| AuthN/AuthZ (T-01..T-06, T-20): sign-in, allowlist by numeric ID, cookies, CSRF, data-source checks, fail closed | PASS (mocked GitHub) | `docs/security/security-testing.md`; auth integration suite; M6 manual runs |
| Real GitHub OAuth end to end | **BLOCKED** | needs an OAuth app + domain (owner, pre-M8) |
| DB least privilege (T-14) | PASS | `roles_integration_test.go` |
| Profile isolation (T-15) | PASS (config) / NOT TESTED (deployed) | proxy + layout + action gates; bypass headers |
| Supply chain: secrets scan, Trivy gate on our images/lockfiles, SBOM | PASS | CI secrets + compose-smoke |
| Third-party image CVEs (postgres gosu, collector) | **OPEN** | postgres 18.7 repinned to the upstream rebuild: gosu still 26 (25 HIGH, 1 CRITICAL) in CI 45495842392. Options: (a) accept — gosu only drops privileges at entrypoint; (b) `postgres:18.7-alpine` (su-exec, no Go binary) — changes libc/collation, safe only before the first production data load. Owner decision |
| Independent human security review | **NOT TESTED** | owner action |

## Reliability and operations

| Criterion | Status | Evidence |
| --- | --- | --- |
| Failure drills: PG stop, trace-api stop, Collector restart | PASS (0/80 traces lost) | `docs/testing/failure-drills.md` |
| Restore drill into clean server | PASS (small data, unencrypted) | `docs/runbooks/backup-restore.md` |
| Encrypted backup round trip (age) | **NOT TESTED** | age not installed (owner decision) |
| Production-size restore time vs RTO 4 h | **NOT TESTED** | needs operator host |
| operator-prod config (Caddy TLS, headers, only 80/443) | PASS (validated) / NOT TESTED (deployed) | `compose.production.yaml`, `caddy validate` |

## Performance (lab, dev host — not the reference host)

| Criterion | Status | Evidence |
| --- | --- | --- |
| PERF-02 peak ingest 500 spans/s × 10 min, all accounted | PASS (dev host) | `benchmark-results.md` M4-PERF-01 |
| PERF-01 list p95 < 500 ms, detail p95 < 1 s, errors < 1 % | PASS (dev host) | same |
| Aggregates under load incl. 7-day windows | PASS (0 errors / 5,397) with limitation: 7-day overview p95 1.8 s, dependencies 2.4 s | `benchmark-results.md` M7-PERF-02; shm finding fixed |
| Reference 4 vCPU / 8 GB Linux host | **NOT TESTED** | owner provides host |
| Public routes LCP ≤ 2.5 s, CLS ≤ 0.1 (lab) | _pending Sonnet M7-UI_ | |

## Accessibility and responsive

| Criterion | Status | Evidence |
| --- | --- | --- |
| axe: no violations on every route (automated) | PASS | Playwright axe suite in CI |
| 375 px no horizontal page overflow | PASS (automated) | Playwright reflow |
| 360/768/1024/1440 + 200 % zoom screenshots; keyboard + screen-reader passes | _pending Sonnet M7-UI_ | |
| WCAG 2.2 AA conformance claim | **NOT CLAIMED** | needs manual expert review |

## Owner actions required before (D) release candidate
1. Run **3 task-based usability sessions** (slow trace, failure trace, map → trace); record outcome, time and mistakes.
2. Arrange an **independent human security review** of `docs/security/` and `apps/web/src/lib/auth/**`.
3. Provide the **host, domain and GitHub OAuth app**; then deploy operator-prod and verify sign-in end to end.
4. Decide on **`age`** for encrypted backups (install on the backup host) and run the encrypted restore drill.
5. Decide on remaining **third-party image CVEs** (accept with note, or wait for upstream rebuilds).
6. Run the **benchmark on the reference Linux host**.
