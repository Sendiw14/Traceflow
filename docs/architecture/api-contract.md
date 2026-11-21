# App API Contract Notes (M1 draft)

**Status:** DRAFT 0.1.0. Source of truth: `api/openapi.yaml` (lint: `npx @redocly/cli@2 lint api/openapi.yaml` → valid, 2 accepted warnings: health probes have no 4xx). Conventions: ADR-0004. **Freeze requires Sonnet consumer review.**

## Endpoint → route mapping

| Endpoint | UI routes |
| --- | --- |
| `GET /v1/overview` | `/app`, `/demo` |
| `GET /v1/traces` | `/app/traces`, `/demo` |
| `GET /v1/traces/{traceId}` | `/app/traces/[traceId]`, `/demo/traces/[traceId]` |
| `GET /v1/services` | `/app/services` |
| `GET /v1/services/{serviceName}` | `/app/services/[serviceName]` |
| `GET /v1/dependencies` | `/app/map` |
| `GET /v1/analytics/server-latency` | `/app/analytics`, `/app` panels |
| `GET /v1/ingestion/status` | `/app/onboarding`, `/app/settings` |
| `GET/PATCH /v1/settings` | `/app/settings` (PATCH 403 in public-demo) |

## Semantics the UI must honour
- `duration.basis = observed_range_estimate` → label "estimate".
- `parent_present = false` → "parent span not received"; never "no parent call".
- `quality.negative_duration` → clock-skew notice; exclude from axis scaling.
- `Percentiles.*` null → show "insufficient samples (n=…)", not 0.
- `LatencyPoint.stats` null → gap in chart; no interpolation.
- `Population.note` shown with every aggregate.
- Trace detail is mutable while late spans arrive; show `freshness`.

## Percentile algorithm
Nearest-rank via `percentile_disc`. Floors: p50 needs ≥1 sample, p95 ≥20, p99 ≥100; below floor → null. Oracle test matches exactly.

## Edge derivation
SQL self-join `spans child JOIN spans parent ON same trace AND child.parent_span_id = parent.span_id WHERE child.service_name <> parent.service_name` within window; grouped by `(parent.service, child.service)`; `basis` from kinds. No edges from co-occurrence, links or naming.

## Open questions for Sonnet review
1. Is `TraceDetail` (all spans, up to 50k) acceptable, or does waterfall need paged/streamed spans? Proposed: full list for V1, measure at M4 with 5k-span trace.
2. Overview polling at 5 s: payload size OK?
3. Any missing fields for page-matrix states (e.g., per-service sparkline in list)?
