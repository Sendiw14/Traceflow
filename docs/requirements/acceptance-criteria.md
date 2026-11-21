# TRACEFLOW — Acceptance Criteria (M0 draft)

**Status:** DRAFT. Each criterion maps to requirement IDs in `traceability.md`. Thresholds marked *initial* may be revised only via ADR with measured evidence.

## OTLP / ingest
- AC-OTLP-01: `POST /v1/traces` accepts binary `ExportTraceServiceRequest`, uncompressed and gzip.
- AC-OTLP-02: Full accept or empty request → HTTP 200 + serialized `ExportTraceServiceResponse`, `partial_success` unset (decoded from actual bytes).
- AC-OTLP-03: Partial accept → HTTP 200 + nonzero `rejected_spans` + message.
- AC-OTLP-04: Invalid Protobuf/IDs → 400 + Protobuf `google.rpc.Status`; no crash.
- AC-OTLP-05: Oversize compressed or decompressed body → 413; bounded memory (gzip-bomb test).
- AC-OTLP-06: Throttling → 429/503 (+`Retry-After` where useful); DB outage → retryable 503, never 200 for uncommitted data.
- AC-OTLP-07: Identical replay is idempotent; conflicting replay follows documented deterministic policy with audit counter.

## Data / analytics
- AC-DATA-01: Normal demo request yields correlated spans across all three services matching a reference parent-child fixture.
- AC-DATA-02: Timestamps stored as integer ns in PG; serialized as decimal strings in JSON; round-trip tests across Go/TS.
- AC-DATA-03: Trace duration, SERVER latency, error fraction, p50/p95/p99 and service edges match a separately computed fixture oracle.
- AC-DATA-04: Late/orphan/multi-root spans persist and are marked incomplete/provisional; summaries reconcile.

## API
- AC-API-01: `api/openapi.yaml` is the only app API source; TS client generated, never hand-edited; contract tests on both sides.
- AC-API-02: Cursor pagination with stable tie-breaker `(start_time, trace_id)`; no skip/duplicate under stable snapshot.
- AC-API-03: Sensitive responses carry `Cache-Control: private, no-store`, verified in production build.

## Auth / demo isolation
- AC-AUTH-01: Unauthenticated access to every `/app/*` route and private BFF endpoint is denied server-side.
- AC-AUTH-02: Allowlist by immutable GitHub numeric user ID; logout invalidates session; back/forward shows no private data.
- AC-DEMO-01: Demo runtime has no private DB credentials or network path; no ingestion/admin endpoints.

## UX / a11y / perf (initial)
- AC-UX-01: Every V1 route implements loading, empty, error, partial states; no phantom links.
- AC-A11Y-01: Keyboard-only completion of J-02/J-03/J-04; edge-table alternative to map; no critical WCAG 2.2 AA violations (automated + manual).
- AC-A11Y-02: 360/375/768/1024/1440 px and 200% zoom without page-level horizontal overflow.
- AC-PERF-01 *(initial)*: 4 vCPU/8 GB host, 250k spans/25k traces, 10 VUs, 5 min: trace list p95 < 500 ms, detail p95 < 1 s, error rate < 1%.
- AC-PERF-02 *(initial)*: Peak 500 spans/s for 10 min direct-to-Go, every accepted span accounted for; Collector drops reported separately. Not a sustained-capacity claim.

## Reliability / deploy
- AC-REL-01: Restore drill into a clean DB with measured elapsed time before operator deployment.
- AC-REL-02: Failure drills (PG, Collector, API restart; queue full; disk low) recorded truthfully.
- AC-DEPLOY-01: Clean-clone README walkthrough finds known trace ID and slow span.
