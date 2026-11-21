# TRACEFLOW — Requirements Traceability (M0 skeleton)

**Status:** DRAFT. No code exists yet, so every row is `NOT TESTED`. Rows fill in as M1–M7 land. A V1 must-have cannot be marked PASS without ≥1 deterministic passing test plus integration/manual proof.

| REQ_ID | PRIORITY | DESCRIPTION | ROUTE/COMPONENT | CODE_PATH | TEST_ID | TEST_COMMAND | EVIDENCE_PATH/URL | RESULT | OWNER |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCOPE-01 | MUST | Three instrumented demo services + scenarios | examples/demo-system | — | DATA-01 | — | — | NOT TESTED | Opus |
| SCOPE-02 | MUST | OTLP/HTTP Protobuf ingest via Collector → Go → PG | services/trace-api ingest | — | OTLP-01…06 | — | — | NOT TESTED | Opus |
| SCOPE-03 | MUST | Faithful span persistence | db/migrations | — | DATA-02 | — | — | NOT TESTED | Opus |
| SCOPE-04 | MUST | Idempotency, limits, late spans, replay, retention | ingest/store | — | OTLP-07, DATA-04 | — | — | NOT TESTED | Opus |
| SCOPE-05 | MUST | Diagnostics UI routes `/app/*` | apps/web | — | UX-01, A11Y-01 | — | — | NOT TESTED | Sonnet |
| SCOPE-06 | MUST | Public site + docs routes | apps/web | — | UX-01, DEPLOY-01 | — | — | NOT TESTED | Sonnet |
| SCOPE-07 | MUST | Operator auth (GitHub OAuth, numeric ID) | apps/web BFF | — | AUTH-01, AUTH-02 | — | — | NOT TESTED | Opus |
| SCOPE-08 | MUST | Isolated public synthetic demo | public-demo profile | — | DEMO-01 | — | — | NOT TESTED | Opus |
| SCOPE-09 | MUST | White-first accessible design system | apps/web, docs/design | — | A11Y-01, A11Y-02 | — | — | NOT TESTED | Sonnet |
| SCOPE-10 | MUST | Docs, OpenAPI, CI, backups, release artifacts | repo-wide | — | API-01, REL-01, DEPLOY-01 | — | — | NOT TESTED | Opus |
| NFR-05 | MUST | Measured performance | services/trace-api/tests/perf | — | PERF-01, PERF-02 | — | — | NOT TESTED | Opus |
| NFR-06 | MUST | Reliability drills | infra, runbooks | — | REL-02 | — | — | NOT TESTED | Opus |
