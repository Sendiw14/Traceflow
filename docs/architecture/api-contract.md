# App API Contract Notes (M1 draft)

**Status:** DRAFT 0.2.1 (consumer-approved; freeze pending owner). Source of truth: `api/openapi.yaml` (lint: `npx @redocly/cli@2 lint api/openapi.yaml` → valid, 2 accepted warnings: health probes have no 4xx). Conventions: ADR-0004. Consumer review: `docs/design/openapi-consumer-review.md` (on Sonnet branch until merged). Sonnet approved 0.2.0; 0.2.1 applies only its non-blocking notes.

## Endpoint → route mapping

| Endpoint | UI routes | public-demo |
| --- | --- | --- |
| `GET /v1/overview` | `/app`, `/demo` | ✅ |
| `GET /v1/traces` | `/app/traces`, `/demo` | ✅ |
| `GET /v1/traces/{traceId}?detail=full\|lite` | `/app/traces/[traceId]`, `/demo/traces/[traceId]` | ✅ |
| `GET /v1/traces/{traceId}/spans/{spanId}` | span inspector | ✅ |
| `GET /v1/services` | `/app/services` | ✅ |
| `GET /v1/services/{serviceName}` | `/app/services/[serviceName]` | ✅ |
| `GET /v1/dependencies` | `/app/map` | ✅ |
| `GET /v1/analytics/server-latency` | `/app/analytics`, `/app` panels | ✅ |
| `GET /v1/analytics/latency-distribution` | `/app/analytics` | ✅ |
| `GET /v1/ingestion/status` | `/app/onboarding`, `/app/settings` | ❌ 404 |
| `GET/PATCH /v1/settings` | `/app/settings` | ❌ 404 |

## Semantics the UI must honour
- `duration.basis = observed_range_estimate` → label "estimate".
- `parent_present = false` → "parent span not received"; never "no parent call".
- `quality.negative_duration` → clock-skew notice; exclude from axis scaling.
- `Percentiles.*` null → "insufficient samples (n=…)", not 0.
- `LatencyPoint.stats` null → gap; no interpolation. `partial = true` → mark still-filling bucket.
- `Population.note` shown with every aggregate.
- `TraceDetail.truncation` non-null → visible banner with counts.
- `Settings.read_only` → no edit controls.
- Trace detail is mutable while late spans arrive; show `freshness`.

## Algorithms
- **Percentiles:** nearest-rank (`percentile_disc`). Floors p50 ≥ 1, p95 ≥ 20, p99 ≥ 100 samples; below → null.
- **Histogram:** fixed log-spaced boundaries, 0–60 s + open bucket; exact list fixed in M4 code and oracle.
- **Exemplars:** slowest SERVER span and latest error SERVER span in the same population.
- **Edges:** child.parent_span_id = parent.span_id, same trace, different services, within window. No edges from co-occurrence, links or naming. Every edge endpoint appears in `nodes`.

## Consumer review resolutions (Sonnet M1-R1 → API 0.2.0-draft)

| ID | Resolution |
| --- | --- |
| R-1 | Accepted: `detail=full\|lite` (default full), `getSpan`, `truncation`, `*_count` fields; `maxItems` documented as hard ceiling = default `max_spans_per_trace`. Lite threshold set from M4 measurement. |
| R-2 | Accepted: `BucketStats` per point; `Population` only on `overall`; `service_names` maxItems 50 + `service_count`; series capped at 2,000 points (400 `window_too_large`). |
| R-3 | Accepted: `GET /v1/analytics/latency-distribution`. |
| R-4 | Accepted (a) `ServerStats.exemplars` with trace + span IDs; (b) `sample_error_trace_ids` (≤ 3) on service and operation summaries. |
| R-5 | Accepted: `Problem.errors[]`; `detail` plain text. |
| R-6 | Accepted: `LatencyPoint.partial`; points stated dense. |
| R-7 | Declined for V1: no dry-run. Confirm dialog states irreversibility and `next_retention_run`. |
| R-8 | Service: 200 with `observed_in_window=false` if known but idle; 404 only if never observed in retained data. Trace: single 404 — "not yet / never / expired" is not distinguishable (no tombstones in V1). |
| R-9 | Accepted as limitation: fixed order `start desc, trace_id desc`; column sort is "within loaded rows". |
| R-10 | Confirmed: cursors stateless, no lifetime; UI keeps them out of shareable URLs. |
| R-11 | Accepted: `freshness` on all data responses; `Settings.generated_at`. |
| R-12 | Accepted: `latest_trace_id`, `first_span_received_at`; `RejectReason` enum. |
| R-13 | Accepted: invariants documented (edge endpoints in nodes, `trace_count` required, top_services ranking, service filter = any span, `status=error` = `error_span_count > 0`). |
| R-14 | Accepted: `Settings.read_only`, `next_retention_run`. |
| R-15 | Fixed: Nanos stays `{1,19}` (int64); ADR-0004 corrected; edge basis text fixed. |
| R-16 | **Decision (Opus, demo deployment owner): (a)** — demo re-seed job re-stamps synthetic spans relative to "now" on a schedule (e.g. hourly, keeping last 24 h), so default UI windows work. Banner still states data is synthetic. |
| R-17 | Confirmed: demo exposes read endpoints listed above; ingestion status and settings 404. |
| R-18 | Covered by R-11 (`freshness.generated_at` for clock offset). |
| R-19 | Agreed: counts are JSON integers; ns values via BigInt helpers. |
| R-20 | Stated: max nesting depth 8; string/bytes values capped at 4 KiB; `truncated` applies to the value. |

## Re-review notes (Sonnet round 2 → API 0.2.1-draft)

Sonnet verdict on 0.2.0: **APPROVED** (non-blocking notes N-1..N-8).

| ID | Resolution |
| --- | --- |
| N-1 | `SpanDetail.span` requires `attributes/events/links` (allOf). |
| N-2 | Histogram invariant stated: `sum(count) + excluded_negative_duration = sample_count`. |
| N-3 | Truncation returns earliest-start prefix; `parent_present` computed against all stored spans. |
| N-4 | `ServerStats.exemplars` required (nulls when no samples). |
| N-5 | `TraceSummary.service_count` required. |
| N-6 | `getSpan` 404 documented (incl. span IDs from other traces). |
| N-7 | UI copy only ("slowest request (server span)"); no API change. |
| N-8 | BFF requirement: in public-demo, absent endpoints return a clean 404 Problem; `/demo` never calls them. |
