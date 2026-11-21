# TRACEFLOW — V1 Scope (M0 draft)

**Status:** DRAFT — awaiting owner review. Source: spec §1.4, §1.5, §8. Changes require a change-control record (ADR or change PR).

## In scope (V1 must-have)

| ID | Capability |
| --- | --- |
| SCOPE-01 | Local single-server stack with three instrumented demo services (gateway → orders → inventory); deterministic normal, slow, error, parallel, missing-parent scenarios. |
| SCOPE-02 | OTLP/HTTP binary Protobuf traces: pinned Collector → protected Go receiver → PostgreSQL; spec-conformant responses and retry semantics. |
| SCOPE-03 | Faithful persistence: trace/span/parent IDs, kind, timestamps, status, attributes, resource, scope, events, links, schema URL. |
| SCOPE-04 | Idempotent ingest, bounded resources, late/out-of-order/orphan spans, replay-conflict policy, retention, ingestion counters. |
| SCOPE-05 | Diagnostics UI: overview, trace search (URL filters, cursor paging), trace detail/waterfall/tree, services, service detail, service map, analytics, onboarding, settings. |
| SCOPE-06 | Public editorial site + docs routes (`/`, `/docs/*`, `/login`). |
| SCOPE-07 | Hosted private single-operator access (GitHub OAuth, numeric-ID allowlist). |
| SCOPE-08 | Separately deployed public synthetic-only read-only demo (`/demo`, `/demo/traces/[traceId]`). |
| SCOPE-09 | White-first responsive accessible design system; all loading/empty/error/partial states; restrained motion. |
| SCOPE-10 | Docs, OpenAPI contract, CI, migrations, QA, benchmark + ops reports, backup/restore, pinned deploy, release artifacts. |

## Out of scope (V1)

Metrics/log storage; AI root-cause analysis; alerting; multi-user/multi-org tenancy; billing; shared editing; hosted HA/SLA; native mobile apps; arbitrary query language; Kubernetes; warehouse-scale retention; Redis/Kafka/ClickHouse/3D/extra animation libs without measured need + ADR; dark mode (not required). No clickable inert navigation for V2+ features.

## Deployment profiles

| Profile | Data | Auth | Notes |
| --- | --- | --- | --- |
| `local-dev` | Synthetic demo services | Local bootstrap, no OAuth | Loopback/private only; bypass guarded against prod use |
| `operator-prod` | Private operator telemetry | GitHub OAuth + numeric ID allowlist | Only Caddy HTTPS public; DB/Go/Collector private; remote OTLP off by default |
| `public-demo` | Synthetic only | None (read-only) | Separate deployment, DB, credentials; no ingestion/admin |

## Owner decisions

See `risks.md` → "Owner decisions on blocking unknowns". Summary: build and prove V1 on `local-dev`; `operator-prod` host, domain and OAuth chosen before M8; `public-demo` on its own small VPS; Apache-2.0.
