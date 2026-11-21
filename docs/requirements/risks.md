# TRACEFLOW — Risk Register (M0 draft)

**Status:** DRAFT. Severity: CRITICAL / HIGH / MEDIUM / LOW. Seeded from the V2 readiness audit (`docs/specs/archive/`) plus 2026-11-22 environment inspection.

| ID | Sev | Risk | Mitigation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| R-01 | CRITICAL | Sustained 500 spans/s × 7 d = 302.4 M spans exceeds unmeasured single-server capacity | Separate peak vs sustained; `capacity-profile.md` with measured bytes/span | Benchmark (M4/M7) | OPEN |
| R-02 | CRITICAL | Collector queue ack mistaken for DB commit → silent loss | Document ack boundary; Go returns 200 only post-commit; drop counters | Restart/outage drills | OPEN |
| R-03 | HIGH | OTLP response semantics wrong (status codes, Protobuf bodies) | Golden byte-level conformance suite | OTLP-* tests | OPEN |
| R-04 | HIGH | Demo/private data crossover | Separate deployment, DB, credentials | DEMO-01 isolation tests | OPEN |
| R-05 | HIGH | Concurrent agent edits / contract drift | One owner per file, frozen OpenAPI, worktrees after first commit | Handoff ledger | OPEN |
| R-06 | HIGH | TypeScript 7 toolchain incompatibility | Validate Next/ESLint/generator; fall back to TS 6 via ADR | M2 build | OPEN |
| R-07 | HIGH | Deprecated Collector `batch` processor | Exporter `sending_queue.batch` on pinned image | Collector config test | OPEN |
| R-08 | HIGH | JS precision loss on ns timestamps | Decimal strings in JSON | Cross-language tests | OPEN |
| R-09 | HIGH | Private responses cached (Next.js/CDN) | `private, no-store`; no `use cache` on private paths | Header tests on prod build | OPEN |
| R-10 | HIGH | Public site ambition crowds out working tracing | M3/M4 real telemetry before M5 integration claims | Gate reviews | OPEN |
| R-11 | MEDIUM | Local Node is 24.11.1; spec baseline is 26.x LTS | Pin Node 26 in containers + `.nvmrc`; upgrade local or use container toolchain | M2 bootstrap | OPEN |
| R-12 | MEDIUM | Local disk 90 GiB free (79% used) limits benchmark datasets | Size benchmark data from measured bytes/span; benchmark host may differ | Capacity profile | OPEN |
| R-13 | MEDIUM | Independent review: same-model sessions are not a true independent security audit | Human review for high-risk security decisions | M6 gate | OPEN |

## Owner decisions on blocking unknowns (2026-11-22)

| ID | Question | Owner decision | Consequence | Status |
| --- | --- | --- | --- | --- |
| U-01 | Hosting for `operator-prod` | Local only for now; choose host before M8 | Capacity profile, RPO/RTO stay provisional; benchmarks use documented local/benchmark host | DEFERRED (pre-M8) |
| U-02 | Real telemetry | Demo + personal projects: planning assumption < 50 spans/s sustained, 7-day retention, no third-party personal data | Sustained profile sized from this; must be re-measured (R-01) | DECIDED (assumption) |
| U-03 | Domain, TLS, GitHub OAuth app, operator numeric ID | Defer domain/OAuth to pre-M8. Operator numeric GitHub ID obtained; supplied via env at deploy time, not committed | `local-dev` uses guarded bootstrap auth | DEFERRED (pre-M8) |
| U-04 | Public demo hosting | Separate small VPS, own DB and credentials | Strongest isolation per spec §2; extra host cost at M8 needs owner approval | DECIDED |
| U-05 | License | Apache-2.0 | `LICENSE` added; dependency/asset licenses must be compatible | DECIDED |
| U-06 | Frontend owner | Separate Sonnet 5.5 (high, Ultracode) session in its own worktree after M1 freeze | Owner verifies `/model`, `/effort`, `/status` and logs in `docs/workflow/model-availability.md` | DECIDED (pending verification) |

Paid resources (VPS, domain) still require explicit owner approval before purchase.
