# TRACEFLOW — Product Requirements (M0 draft)

**Status:** DRAFT — awaiting owner review. Source: `docs/specs/TRACEFLOW_FINAL_MASTER_PROMPT_V2.md` §1.
**Version:** 0.1.0 (2026-11-22)

## Product

TRACEFLOW — *Every request has a story. See the whole picture.*
A self-hostable, open-source tool that shows a request's journey across services and where latency and errors originate.

## Personas

| ID | Persona | Core need |
| --- | --- | --- |
| P-01 | Application engineer | Find failing/slow requests; follow them across APIs, services, DB calls. |
| P-02 | SRE / backend engineer | Compare observed latencies/errors, inspect dependencies, check ingestion health. |
| P-03 | Learner / evaluator | Start the three-service demo, trigger normal/slow/error scenarios, follow the evidence. |

## Primary journeys

| ID | Journey | Persona | Success evidence |
| --- | --- | --- | --- |
| J-01 | `docker compose up` → generate real trace → find it in TRACEFLOW | P-03, P-01 | Clean-clone E2E; known trace ID found |
| J-02 | Slow service → filter requests → open trace → focus slow span → inspect attributes/events | P-01, P-02 | Usability task + Playwright journey |
| J-03 | Error → failing span → parent/child context → explain from recorded evidence only | P-01 | Keyboard-only E2E; usability task |
| J-04 | Service map → select verified edge → supporting traces | P-02 | Graph fixture + edge-table E2E |
| J-05 | Public read-only demo → synthetic traces → no private data access | P-03 | Isolation test + demo E2E |
| J-06 | Operator login → private deep link → sign out → private data inaccessible | P-02 | Auth E2E incl. back/forward after logout |

## Success criteria

- Journeys J-01…J-06 complete end-to-end against real telemetry (J-05 against synthetic data in a separate deployment).
- Three task-based usability sessions (slow trace, failure trace, map→trace); no critical blocker remains. Qualitative only.
- Every V1 must-have has ≥1 deterministic passing test plus integration/manual proof (`traceability.md`).
- No invented scores ("10/10", "100x"). Results reported as PASS / FAIL / NOT TESTED / BLOCKED.

## Nonfunctional requirements

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-01 | Truthfulness | Sampled/partial/skewed data labeled; missing spans visible. |
| NFR-02 | Privacy | No request bodies, credentials, personal data persisted by default; redaction before persistence. |
| NFR-03 | Security | Public routes cannot reach private telemetry; no unprotected public OTLP receiver. |
| NFR-04 | Accessibility | WCAG 2.2 AA target incl. chart/graph alternatives; manual evaluation. |
| NFR-05 | Performance | Reproducible loads and measured results only (targets in spec §16.2). |
| NFR-06 | Reliability | Bounded queues, timeouts, backpressure, error accounting, retention, backup/restore, RPO/RTO once profile chosen. |
| NFR-07 | Maintainability | Strict types, ADRs, pinned deps, regression tests, forward-only migrations. |

See `scope.md` for in/out of scope and `acceptance-criteria.md` for testable criteria.
