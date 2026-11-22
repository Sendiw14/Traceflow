# Data Model (M1 draft)

**Status:** DRAFT for contract freeze. Owner: Opus. Implements ADR-0002. DDL below is design, not yet a migration; M3 turns it into `services/trace-api/db/migrations/00001_init.sql` (goose, forward-only).

## Conventions
- Timestamps from producers: `bigint` Unix nanoseconds (`*_unix_nano`). OTLP `fixed64` values > 2^63−1 are rejected as invalid (year 2262+). `0` start/end → span rejected.
- Server clock timestamps (`received_at`): `timestamptz`.
- IDs: `bytea` with `CHECK (length(...) = 16|8)`; all-zero IDs rejected at validation.
- Attributes: JSONB array of `{"k": key, "t": type, "v": value}` preserving OTLP AnyValue type (`s`,`b`,`i`,`d`,`a`,`kv`,`bytes`). `int64` values stored as **strings** in JSON to avoid precision loss.
- `workspace_id smallint` = 1 in V1.

## DDL (design)

```sql
CREATE TABLE ingestion_records (
  id               bigserial PRIMARY KEY,
  received_at      timestamptz NOT NULL DEFAULT now(),
  source           text NOT NULL,          -- 'collector' | 'direct' (peer identity, not user-supplied)
  bytes_compressed integer NOT NULL,
  bytes_raw        integer NOT NULL,
  spans_received   integer NOT NULL,
  spans_accepted   integer NOT NULL,
  spans_duplicate  integer NOT NULL,
  spans_rejected   integer NOT NULL,
  http_status      smallint NOT NULL,
  reject_reasons   jsonb NOT NULL DEFAULT '{}'   -- {reason_code: count}
);

CREATE TABLE resources (
  id          bigserial PRIMARY KEY,
  workspace_id smallint NOT NULL,
  hash        bytea NOT NULL,              -- sha256 of canonical attrs + schema_url
  schema_url  text NOT NULL DEFAULT '',
  service_name text NOT NULL,              -- 'service.name' or 'unknown_service'
  attributes  jsonb NOT NULL,
  dropped_attributes_count integer NOT NULL DEFAULT 0,
  UNIQUE (workspace_id, hash)
);

CREATE TABLE scopes (
  id          bigserial PRIMARY KEY,
  workspace_id smallint NOT NULL,
  hash        bytea NOT NULL,
  name        text NOT NULL DEFAULT '',
  version     text NOT NULL DEFAULT '',
  schema_url  text NOT NULL DEFAULT '',
  attributes  jsonb NOT NULL DEFAULT '[]',
  UNIQUE (workspace_id, hash)
);

CREATE TABLE spans (
  workspace_id     smallint NOT NULL,
  trace_id         bytea NOT NULL CHECK (length(trace_id) = 16),
  span_id          bytea NOT NULL CHECK (length(span_id) = 8),
  parent_span_id   bytea CHECK (parent_span_id IS NULL OR length(parent_span_id) = 8),
  trace_state      text NOT NULL DEFAULT '',
  flags            integer NOT NULL DEFAULT 0,
  name             text NOT NULL,
  kind             smallint NOT NULL,       -- OTLP SpanKind 0..5
  start_unix_nano  bigint NOT NULL,
  end_unix_nano    bigint NOT NULL,
  duration_nano    bigint NOT NULL,         -- end - start; may be negative (flagged, see below)
  status_code      smallint NOT NULL,       -- 0 unset, 1 ok, 2 error
  status_message   text NOT NULL DEFAULT '',
  resource_id      bigint NOT NULL REFERENCES resources(id),
  scope_id         bigint NOT NULL REFERENCES scopes(id),
  service_name     text NOT NULL,           -- denormalized from resource
  attributes       jsonb NOT NULL DEFAULT '[]',
  dropped_attributes_count integer NOT NULL DEFAULT 0,
  events           jsonb NOT NULL DEFAULT '[]',  -- [{time_unix_nano:str, name, attributes, dropped}]
  dropped_events_count integer NOT NULL DEFAULT 0,
  links            jsonb NOT NULL DEFAULT '[]',  -- [{trace_id:hex, span_id:hex, trace_state, attributes, flags}]
  dropped_links_count integer NOT NULL DEFAULT 0,
  content_hash     bytea NOT NULL,
  ingestion_id     bigint NOT NULL REFERENCES ingestion_records(id),
  received_at      timestamptz NOT NULL DEFAULT now(),
  quality_flags    integer NOT NULL DEFAULT 0, -- bit 0 negative_duration, bit 1 zero_duration, bit 2 truncated
  PRIMARY KEY (workspace_id, trace_id, span_id)
);
CREATE INDEX spans_service_time ON spans (workspace_id, service_name, start_unix_nano DESC);
CREATE INDEX spans_server_time  ON spans (workspace_id, service_name, start_unix_nano DESC) WHERE kind = 2;
CREATE INDEX spans_received     ON spans (received_at);  -- retention

CREATE TABLE span_conflicts (
  id            bigserial PRIMARY KEY,
  workspace_id  smallint NOT NULL,
  trace_id      bytea NOT NULL,
  span_id       bytea NOT NULL,
  existing_hash bytea NOT NULL,
  incoming_hash bytea NOT NULL,
  ingestion_id  bigint NOT NULL REFERENCES ingestion_records(id),
  payload       bytea CHECK (payload IS NULL OR length(payload) <= 65536),
  received_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trace_summaries (
  workspace_id        smallint NOT NULL,
  trace_id            bytea NOT NULL,
  min_start_unix_nano bigint NOT NULL,
  max_end_unix_nano   bigint NOT NULL,
  root_span_id        bytea,                -- set only when exactly one root
  root_count          integer NOT NULL DEFAULT 0,
  root_service_name   text,
  root_name           text,
  root_duration_nano  bigint,
  span_count          integer NOT NULL,
  error_span_count    integer NOT NULL,
  service_names       text[] NOT NULL,      -- sorted distinct
  orphan_count        integer NOT NULL DEFAULT 0, -- spans whose parent_span_id not present (recomputed)
  first_received_at   timestamptz NOT NULL,
  last_received_at    timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, trace_id)
);
CREATE INDEX trace_summaries_time ON trace_summaries (workspace_id, min_start_unix_nano DESC, trace_id DESC);
CREATE INDEX trace_summaries_services ON trace_summaries USING gin (service_names);

CREATE TABLE settings (
  key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE settings_audit (
  id bigserial PRIMARY KEY, key text NOT NULL, old_value jsonb, new_value jsonb NOT NULL,
  actor text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE schema_info (version integer NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
```

## Invariants and edge-case policy

| Case | Behaviour |
| --- | --- |
| Identical replay | No-op; counted duplicate; accepted (ADR-0002) |
| Conflicting replay | First write wins; `span_conflicts` row; rejected in partial_success |
| Invalid trace/span ID length or all-zero | Span rejected (`invalid_id`) |
| `parent_span_id` empty bytes | Stored NULL (root) |
| `end < start` | Stored, `duration_nano` negative, `quality_flags` bit 0; excluded from latency analytics; UI shows clock-skew notice |
| `end == start` | Stored, bit 1; included in analytics as 0 |
| Parent missing | Span stored; `orphan_count` reflects it; UI marks "parent not received" — never inferred as absent call |
| Multiple roots | `root_span_id` NULL, `root_count` > 1; trace duration falls back to estimate |
| Late span | Summary upserted in same tx; `orphan_count` recomputed for that trace |
| Attribute over limit (count 128, key 256 B, value 4 KiB defaults) | Truncated; dropped counts incremented; `quality_flags` bit 2 |
| Events > 128 / links > 128 per span | Excess dropped, counted |
| Spans per request > 10,000 | Request rejected 413 |
| Spans per trace > 50,000 | Further spans rejected (`trace_span_limit`) |
| Sampling | Not reconstructed; UI labels populations as "observed" |

## Derived definitions (spec §5.2)
- `trace_duration`: `root_duration_nano` if `root_count = 1` and root `quality_flags` clean; else `max_end − min_start`, labeled **estimate**.
- `orphan_count` recompute: `count(*) FILTER (WHERE parent_span_id IS NOT NULL AND NOT EXISTS (parent in same trace))`, run per touched trace inside ingest tx.

## Retention
Configurable days (`settings.retention_days`). Job deletes `trace_summaries` whose `last_received_at` < cutoff, and their spans, in bounded batches (e.g. 5,000 traces/batch) with pause between; records results in ops metrics. Partitioning by day deferred until capacity profile shows need (ADR required).

## DB roles
`traceflow_migrate` (DDL), `traceflow_rw` (ingest + query + retention), `traceflow_ro` (SELECT only; public-demo runtime). Auth schema has its own role (ADR-0005).

## Reject reason codes
Stable codes counted in `ingestion_records.reject_reasons` and exposed as `RejectReason` in the API: `invalid_id`, `invalid_timestamp` (zero, > int64, or unparseable), `invalid_span` (other structural faults), `conflicting_replay`, `trace_span_limit`. Adding a code is an API change.

## M3 implementation deltas (additive, no API change)
- `trace_summaries.skew_span_count` backs API `TraceCompleteness.has_clock_skew`.
- Extra index `spans_parent (workspace_id, trace_id, parent_span_id)` for orphan recompute; `trace_summaries_last_received` for retention.
- goose's version table replaces `schema_info`.
- Text fields and JSON strings are sanitized before storage: invalid UTF-8 and NUL become U+FFFD (PostgreSQL rejects both; one bad span must not fail the whole request).
- Span names truncated at 1 KiB, trace_state at 512 B; NaN/±Inf doubles stored as strings (not representable in JSON).
- Requests rejected before storage (bad protobuf, too many spans) are recorded best-effort in `ingestion_records` with their HTTP status.
