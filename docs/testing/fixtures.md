# Golden Fixture Contract (M1 draft)

**Status:** DRAFT. Owner: Opus. Fixtures live in `services/trace-api/tests/fixtures/otlp/`; each has `request.bin` (or generator), `expect.yaml` (HTTP status, decoded response, DB assertions). Generated deterministically by a Go program with a fixed seed; never hand-edited binaries.

## OTLP receiver fixtures

| ID | Input | Expected HTTP | Expected body | DB assertion |
| --- | --- | --- | --- | --- |
| OTLP-01 | Valid 3-service trace, identity encoding | 200 | `ExportTraceServiceResponse`, `partial_success` unset | 3+ spans, summary correct |
| OTLP-02 | OTLP-01 gzip | 200 | same | same |
| OTLP-03 | Empty `ExportTraceServiceRequest` | 200 | `partial_success` unset | no rows |
| OTLP-04 | 5 spans, 2 with 4-byte span IDs | 200 | `rejected_spans=2`, message names `invalid_id` | 3 spans |
| OTLP-05 | Garbage bytes | 400 | `google.rpc.Status` code 3 | none |
| OTLP-06 | `Content-Type: application/json` | 415 | `google.rpc.Status` | none |
| OTLP-07 | Compressed > limit | 413 | `google.rpc.Status` | none, no full read |
| OTLP-08 | Gzip bomb (small → >16 MiB) | 413 | `google.rpc.Status` | memory bounded (assert peak) |
| OTLP-09 | DB unavailable | 503 + `Retry-After` | `google.rpc.Status` code 14 | none |
| OTLP-10 | Concurrency saturated | 429 + `Retry-After` | `google.rpc.Status` code 8 | none |
| OTLP-11 | OTLP-01 sent twice | 200, 200 | both unset | span count unchanged; duplicate counter +N |
| OTLP-12 | OTLP-01 then same IDs, changed name | 200, 200 | 2nd: `rejected_spans=N`, `conflicting replay` | original kept; `span_conflicts` N rows |
| OTLP-13 | Child span before parent (two requests) | 200, 200 | unset | `orphan_count` 1 then 0 |
| OTLP-14 | Span with end < start | 200 | unset | stored, quality flag 0 set |
| OTLP-15 | Multi-resource, multi-scope request | 200 | unset | resources/scopes deduped |
| OTLP-16 | Events, links, all AnyValue types incl. int64 max | 200 | unset | JSONB round-trip exact |
| OTLP-17 | Attribute over size limit | 200 | unset | truncated, dropped count |
| OTLP-18 | Real Collector v0.165.0 forwarding SDK traffic | 200 | — | interop: span IDs match SDK export |
| OTLP-19 | Reference OTel Go SDK exporter direct to receiver | 200 | — | interop + retry behaviour on 503 |

## Demo scenario fixtures (examples/demo-system)

| ID | Scenario | Shape |
| --- | --- | --- |
| DATA-01 | normal | gateway SERVER → gateway CLIENT → orders SERVER → orders CLIENT → inventory SERVER (+ DB CLIENT span) |
| DATA-05 | slow | inventory DB span +800 ms deterministic |
| DATA-06 | error | inventory returns 500; inventory span status ERROR with exception event; propagates |
| DATA-07 | parallel | orders calls inventory twice concurrently (overlapping siblings) |
| DATA-08 | missing-parent | orders span exported, gateway span intentionally dropped |

## Analytics oracle
`services/trace-api/tests/oracle/` — independent Go implementation (plain slices, sort, no SQL) computing trace duration, SERVER latency p50/p95/p99 (nearest-rank, documented), error fraction and edges for a seeded dataset; SQL results must match exactly.
