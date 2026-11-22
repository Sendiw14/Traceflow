# App API Contract Notes (M1 draft)

**Status:** FROZEN 1.0.0 (M1, 2026-11-22). Changes need an ADR or change PR, a version bump, client regeneration and both contract suites. Source of truth: `api/openapi.yaml` (lint: `npx @redocly/cli@2 lint api/openapi.yaml` → valid, 2 accepted warnings: health probes have no 4xx). Conventions: ADR-0004. Consumer review: `docs/design/openapi-consumer-review.md` (on Sonnet branch until merged). Sonnet approved 0.2.0; 0.2.1 applies only its non-blocking notes.

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

## M4 implementation semantics (no contract change)

| Field / behaviour | Rule implemented |
| --- | --- |
| Population | SERVER spans (kind = 2) whose **start** is in `[from, to)`. `sample_count` = `request_count` = all such spans. |
| Percentiles | `percentile_disc` over spans with `duration_nano >= 0` (negative = clock skew, excluded); floors apply to that non-negative count. |
| `unset_status_count` | spans with status `unset`; distinguishes unknown from `ok` (spec §5.2). |
| Exemplars | slowest = max non-negative duration (ties by trace_id, span_id); latest error = max start among error spans. |
| `last_observed_unix_nano` | max span start for the service (in window when `observed_in_window`, else across retained data). |
| Edge `basis` | `client_server_parent_child` when at least one stored pair is CLIENT/PRODUCER → SERVER/CONSUMER; counts include all pairs for that (source, target). Window is applied to the **child** span start. |
| Dependency nodes | every edge endpoint is a node; a caller whose spans start before the window is added with `observed_in_window = false` and empty stats. |
| Trace duration | `root_span` when exactly one root with non-negative duration; otherwise observed range, `observed_range_estimate`. Used by `min_duration_nano`. |
| Trace list order / cursor | `(min_start_unix_nano, trace_id) DESC`; cursor = base64url JSON `{s, t, f}` with filter hash; stateless. |
| Histogram bounds | 1-2-5 series from 100 µs to 5 s, plus 10/20/50 s and 60 s, plus open bucket (20 buckets); fixed in `query.HistogramBounds`. |
| `first_span_received_at` | written once in the ingest transaction of the first request with a newly stored span; not removed by retention. |
| `reject_reasons` | span-level reasons only (RejectReason enum); request-level failures (bad protobuf, too many spans) appear in `requests` by HTTP status. |
| `next_retention_run` | last run + 1 h (retention loop cadence); null before the first run and in read-only profiles. |
| Timeouts | 10 s per request; `context.DeadlineExceeded` → 503 `query_timeout`; other DB errors → 503 `storage_unavailable` with `Retry-After`. |
