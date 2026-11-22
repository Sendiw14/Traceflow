-- SPDX-License-Identifier: Apache-2.0
-- Initial schema from docs/architecture/data-model.md (M1 frozen design).
-- M3 refinement: trace_summaries.skew_span_count (backs API TraceCompleteness.has_clock_skew).
-- Forward-only: no Down section; restore from backup instead (spec §12).

-- +goose Up
CREATE TABLE ingestion_records (
  id               bigserial PRIMARY KEY,
  received_at      timestamptz NOT NULL DEFAULT now(),
  source           text NOT NULL,
  bytes_compressed integer NOT NULL,
  bytes_raw        integer NOT NULL,
  spans_received   integer NOT NULL,
  spans_accepted   integer NOT NULL,
  spans_duplicate  integer NOT NULL,
  spans_rejected   integer NOT NULL,
  http_status      smallint NOT NULL,
  reject_reasons   jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX ingestion_records_received ON ingestion_records (received_at);

CREATE TABLE resources (
  id                       bigserial PRIMARY KEY,
  workspace_id             smallint NOT NULL,
  hash                     bytea NOT NULL,
  schema_url               text NOT NULL DEFAULT '',
  service_name             text NOT NULL,
  attributes               jsonb NOT NULL,
  dropped_attributes_count integer NOT NULL DEFAULT 0,
  UNIQUE (workspace_id, hash)
);

CREATE TABLE scopes (
  id           bigserial PRIMARY KEY,
  workspace_id smallint NOT NULL,
  hash         bytea NOT NULL,
  name         text NOT NULL DEFAULT '',
  version      text NOT NULL DEFAULT '',
  schema_url   text NOT NULL DEFAULT '',
  attributes   jsonb NOT NULL DEFAULT '[]',
  UNIQUE (workspace_id, hash)
);

CREATE TABLE spans (
  workspace_id             smallint NOT NULL,
  trace_id                 bytea NOT NULL CHECK (length(trace_id) = 16),
  span_id                  bytea NOT NULL CHECK (length(span_id) = 8),
  parent_span_id           bytea CHECK (parent_span_id IS NULL OR length(parent_span_id) = 8),
  trace_state              text NOT NULL DEFAULT '',
  flags                    integer NOT NULL DEFAULT 0,
  name                     text NOT NULL,
  kind                     smallint NOT NULL,
  start_unix_nano          bigint NOT NULL,
  end_unix_nano            bigint NOT NULL,
  duration_nano            bigint NOT NULL,
  status_code              smallint NOT NULL,
  status_message           text NOT NULL DEFAULT '',
  resource_id              bigint NOT NULL REFERENCES resources(id),
  scope_id                 bigint NOT NULL REFERENCES scopes(id),
  service_name             text NOT NULL,
  attributes               jsonb NOT NULL DEFAULT '[]',
  dropped_attributes_count integer NOT NULL DEFAULT 0,
  events                   jsonb NOT NULL DEFAULT '[]',
  dropped_events_count     integer NOT NULL DEFAULT 0,
  links                    jsonb NOT NULL DEFAULT '[]',
  dropped_links_count      integer NOT NULL DEFAULT 0,
  content_hash             bytea NOT NULL,
  ingestion_id             bigint NOT NULL REFERENCES ingestion_records(id),
  received_at              timestamptz NOT NULL DEFAULT now(),
  quality_flags            integer NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, trace_id, span_id)
);
CREATE INDEX spans_service_time ON spans (workspace_id, service_name, start_unix_nano DESC);
CREATE INDEX spans_server_time  ON spans (workspace_id, service_name, start_unix_nano DESC) WHERE kind = 2;
CREATE INDEX spans_received     ON spans (received_at);
CREATE INDEX spans_parent       ON spans (workspace_id, trace_id, parent_span_id);

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
  root_span_id        bytea,
  root_count          integer NOT NULL DEFAULT 0,
  root_service_name   text,
  root_name           text,
  root_duration_nano  bigint,
  span_count          integer NOT NULL,
  error_span_count    integer NOT NULL,
  service_names       text[] NOT NULL,
  orphan_count        integer NOT NULL DEFAULT 0,
  skew_span_count     integer NOT NULL DEFAULT 0,
  first_received_at   timestamptz NOT NULL,
  last_received_at    timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, trace_id)
);
CREATE INDEX trace_summaries_time ON trace_summaries (workspace_id, min_start_unix_nano DESC, trace_id DESC);
CREATE INDEX trace_summaries_services ON trace_summaries USING gin (service_names);
CREATE INDEX trace_summaries_last_received ON trace_summaries (last_received_at);

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE settings_audit (
  id         bigserial PRIMARY KEY,
  key        text NOT NULL,
  old_value  jsonb,
  new_value  jsonb NOT NULL,
  actor      text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value) VALUES ('retention_days', '7');
