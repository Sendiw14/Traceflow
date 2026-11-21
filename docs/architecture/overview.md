# Architecture Overview (M1 draft)

**Status:** DRAFT for contract freeze. Owner: Opus. Consumer review: Sonnet (frontend-impacting parts). Decisions: `docs/adr/`.

## Shape

Modular monolith (ADR-0001). One Go process, one PostgreSQL, one Next.js app per deployment.

```
examples/demo-system: gateway → orders → inventory   (OTel SDKs, W3C tracecontext)
        │ OTLP/HTTP protobuf (private Docker network)
        ▼
infra/otel Collector  (otlp receiver → redaction processor → otlphttp exporter w/ sending_queue)
        │ OTLP/HTTP protobuf, gzip
        ▼
services/trace-api  :4318 ingest listener (private)     :8080 query listener (private)
   ingest → validate → normalize → store (tx) ──► PostgreSQL 18
   query / analytics / topology ◄──────────────────┘
        ▲ REST per api/openapi.yaml (private network, service token)
apps/web Next.js BFF  (server-side authN/authZ, Cache-Control: private, no-store)
        ▲ HTTPS
infra/caddy  ◄── browser
```

## Packages (`services/trace-api/internal/`)

| Package | Responsibility |
| --- | --- |
| `ingest` | `POST /v1/traces` handler: content-type, gzip, byte limits, protobuf decode, OTLP responses |
| `validate` | ID lengths, non-zero IDs, timestamp sanity, attribute/event/link limits → accept/reject per span |
| `normalize` | OTLP → internal rows; derive `service_name`, duration, flags; keep raw attributes |
| `store` | pgx transactions, upsert/dedupe, trace-summary maintenance, counters |
| `query` | Trace list/detail, services, cursor pagination |
| `analytics` | SERVER-span latency/throughput/error populations, percentiles |
| `topology` | Evidence-backed service edges |
| `authz` | Service-token check on query listener (BFF only caller) |
| `ops` | `/livez`, `/readyz`, self-metrics, retention job |

## Listeners

- **Ingest** `:4318` — only reachable from Collector network (and demo services in `local-dev`). Not routed by Caddy. Remote ingestion off by default (spec §7).
- **Query** `:8080` — only reachable from BFF network. Requires `Authorization: Bearer <service token>` (ADR-0005).

## Profiles

See `deployment-topology.md`. `public-demo` is a separate deployment of the same images with `TRACEFLOW_PROFILE=public-demo`: ingest listener disabled, DB role read-only, synthetic seed data.

## Key contracts

- OTLP behaviour: ADR-0003, `docs/testing/fixtures.md`.
- Storage + replay: ADR-0002, `data-model.md`.
- App API: `api/openapi.yaml`, `api-contract.md`, ADR-0004.
- Capacity: `capacity-profile.md`. Security: `docs/security/`.
