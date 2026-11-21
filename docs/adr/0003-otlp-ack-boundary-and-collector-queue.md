# ADR-0003: OTLP acknowledgement boundary and Collector queueing

- **Status:** Accepted — M1 contract freeze 1.0.0, owner sign-off 2026-11-22
- **Date:** 2026-11-22
- **Requirements:** SCOPE-02, AC-OTLP-01…06, R-02, R-07

## Decision

### Receiver (Go)
- `POST /v1/traces`, `Content-Type: application/x-protobuf` only (JSON OTLP out of V1 scope → 415).
- `Content-Encoding: gzip` or identity; others → 415.
- Limits: compressed body ≤ 4 MiB (413 before decode); decompressed ≤ 16 MiB via `io.LimitReader` (413 when exceeded). Values configurable; defaults tuned in M3 from capacity measurements.
- Response body always binary protobuf with `Content-Type: application/x-protobuf`:
  - 200 → `ExportTraceServiceResponse` (`partial_success` unset if all accepted; set with `rejected_spans` + message otherwise).
  - 400 / 413 / 415 / 429 / 503 → `google.rpc.Status`.
- **200 is written only after the DB transaction commits.** Commit failure, pool exhaustion or timeout → 503 with `Retry-After`. Never 500 for recoverable storage outages.
- Concurrency: bounded semaphore; saturation → 429 with `Retry-After: 1`.
- One transaction per request; statement timeout bounded (default 5 s).

### Collector
- Pinned image (v0.165.0 candidate). No `batch` processor.
- `otlphttp` exporter with `sending_queue` (bounded, `sizer: items`) and `sending_queue.batch` **if present in the pinned release schema** (M2 verification). If absent, document and keep exporter default without batch processor, pending upgrade.
- Max outgoing batch size set so a worst-case batch decompressed is < 50% of receiver 16 MiB limit.
- `retry_on_failure` enabled with bounded `max_elapsed_time`.
- Persistent queue (`file_storage`) **off** in V1 `local-dev`; evaluate for `operator-prod` at M6 with disk budget.

### Semantics stated to users
- Collector acknowledges SDKs when data enters its queue — **before** TRACEFLOW commits. Collector crash/overflow can lose queued data; counted via Collector self-metrics (`otelcol_exporter_send_failed_spans`, `otelcol_exporter_enqueue_failed_spans`, queue size/capacity).
- End-to-end: at-least-once from Collector to DB, with duplicates absorbed by ADR-0002. No exactly-once or zero-loss claim.
