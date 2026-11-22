// SPDX-License-Identifier: Apache-2.0

// Package store persists normalized spans (ADR-0002) in one transaction per request.
package store

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/normalize"
)

const (
	workspaceID      = 1 // V1 single workspace; never taken from requests (T-16)
	statementTimeout = "5s"
)

// MaxSpansPerTrace caps stored spans per trace (data-model.md). Variable only so tests can lower it.
var MaxSpansPerTrace = 50000

// afterSummaryHook runs after summaries are written and before commit. nil in
// production; tests use it to force a concurrent-writer interleaving.
var afterSummaryHook func()

type Store struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Meta describes the request for ingestion_records.
type Meta struct {
	Source          string
	BytesCompressed int
	BytesRaw        int
}

// Result counts outcomes for the OTLP response. Duplicates count as accepted.
type Result struct {
	Accepted  int
	Duplicate int
	Rejected  map[string]int
}

func (r Result) RejectedTotal() int {
	n := 0
	for _, v := range r.Rejected {
		n += v
	}
	return n
}

// Ingest stores the batch. It returns an error (and commits nothing) on any
// database failure; callers must then answer with a retryable status.
func (s *Store) Ingest(ctx context.Context, b *normalize.Batch, m Meta) (Result, error) {
	res := Result{Rejected: map[string]int{}}
	for k, v := range b.Rejected {
		res.Rejected[k] = v
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return res, err
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()

	if _, err := tx.Exec(ctx, "SET LOCAL statement_timeout = '"+statementTimeout+"'"); err != nil {
		return res, err
	}
	var ingestionID int64
	if err := tx.QueryRow(ctx, `INSERT INTO ingestion_records
		(source, bytes_compressed, bytes_raw, spans_received, spans_accepted, spans_duplicate, spans_rejected, http_status)
		VALUES ($1,$2,$3,$4,0,0,0,200) RETURNING id`, m.Source, m.BytesCompressed, m.BytesRaw, b.Received).Scan(&ingestionID); err != nil {
		return res, err
	}

	resIDs, err := upsertResources(ctx, tx, b.Resources)
	if err != nil {
		return res, err
	}
	scopeIDs, err := upsertScopes(ctx, tx, b.Scopes)
	if err != nil {
		return res, err
	}

	// Group by trace and lock traces in sorted order (no deadlocks between requests).
	byTrace := map[string][]*normalize.Span{}
	for i := range b.Spans {
		k := string(b.Spans[i].TraceID)
		byTrace[k] = append(byTrace[k], &b.Spans[i])
	}
	traces := make([]string, 0, len(byTrace))
	for k := range byTrace {
		traces = append(traces, k)
	}
	sort.Strings(traces)

	for _, k := range traces {
		traceID := []byte(k)
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", int64(binary.BigEndian.Uint64(traceID[:8]))); err != nil {
			return res, err
		}
		var existing int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM spans WHERE workspace_id=$1 AND trace_id=$2`, workspaceID, traceID).Scan(&existing); err != nil {
			return res, err
		}
		inserted := 0
		for _, sp := range byTrace[k] {
			stored, err := storedHash(ctx, tx, sp)
			if err != nil {
				return res, err
			}
			if stored == nil {
				if existing+inserted >= MaxSpansPerTrace {
					res.Rejected[normalize.ReasonTraceSpanLimit]++
					continue
				}
				if err := insertSpan(ctx, tx, sp, resIDs[sp.Resource], scopeIDs[sp.Scope], ingestionID); err != nil {
					return res, err
				}
				inserted++
				res.Accepted++
				continue
			}
			if bytes.Equal(stored, sp.ContentHash) {
				res.Accepted++
				res.Duplicate++
				continue
			}
			if _, err := tx.Exec(ctx, `INSERT INTO span_conflicts (workspace_id, trace_id, span_id, existing_hash, incoming_hash, ingestion_id, payload)
				VALUES ($1,$2,$3,$4,$5,$6,$7)`, workspaceID, sp.TraceID, sp.SpanID, stored, sp.ContentHash, ingestionID, sp.Payload); err != nil {
				return res, err
			}
			res.Rejected[normalize.ReasonConflict]++
		}
		if inserted > 0 {
			if _, err := tx.Exec(ctx, recomputeSummary, workspaceID, traceID); err != nil {
				return res, fmt.Errorf("summary: %w", err)
			}
		}
	}

	if res.Accepted > res.Duplicate {
		// First accepted span ever (API IngestionStatus.first_span_received_at); never overwritten.
		if _, err := tx.Exec(ctx, `INSERT INTO settings (key, value) VALUES ('first_span_received_at', to_jsonb((extract(epoch FROM now()) * 1e9)::bigint::text))
			ON CONFLICT (key) DO NOTHING`); err != nil {
			return res, err
		}
	}
	if afterSummaryHook != nil {
		afterSummaryHook()
	}
	reasons, _ := json.Marshal(res.Rejected)
	if _, err := tx.Exec(ctx, `UPDATE ingestion_records SET spans_accepted=$2, spans_duplicate=$3, spans_rejected=$4, reject_reasons=$5 WHERE id=$1`,
		ingestionID, res.Accepted, res.Duplicate, res.RejectedTotal(), reasons); err != nil {
		return res, err
	}
	if err := tx.Commit(ctx); err != nil {
		return res, err
	}
	return res, nil
}

// RecordFailure best-effort logs a request that was rejected before storage.
func (s *Store) RecordFailure(ctx context.Context, m Meta, status, received int, reason string) {
	reasons, _ := json.Marshal(map[string]int{reason: max(received, 1)})
	_, _ = s.pool.Exec(ctx, `INSERT INTO ingestion_records
		(source, bytes_compressed, bytes_raw, spans_received, spans_accepted, spans_duplicate, spans_rejected, http_status, reject_reasons)
		VALUES ($1,$2,$3,$4,0,0,$4,$5,$6)`, m.Source, m.BytesCompressed, m.BytesRaw, received, status, reasons)
}

func upsertResources(ctx context.Context, tx pgx.Tx, rs []normalize.Resource) ([]int64, error) {
	ids := make([]int64, len(rs))
	for i, r := range rs {
		id, err := insertOrGet(ctx, tx, `INSERT INTO resources (workspace_id, hash, schema_url, service_name, attributes, dropped_attributes_count)
			VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (workspace_id, hash) DO NOTHING RETURNING id`,
			`SELECT id FROM resources WHERE workspace_id=$1 AND hash=$2`,
			workspaceID, r.Hash, r.SchemaURL, r.ServiceName, r.Attributes, r.Dropped)
		if err != nil {
			return nil, err
		}
		ids[i] = id
	}
	return ids, nil
}

func upsertScopes(ctx context.Context, tx pgx.Tx, ss []normalize.Scope) ([]int64, error) {
	ids := make([]int64, len(ss))
	for i, s := range ss {
		id, err := insertOrGet(ctx, tx, `INSERT INTO scopes (workspace_id, hash, name, version, schema_url, attributes)
			VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (workspace_id, hash) DO NOTHING RETURNING id`,
			`SELECT id FROM scopes WHERE workspace_id=$1 AND hash=$2`,
			workspaceID, s.Hash, s.Name, s.Version, s.SchemaURL, s.Attributes)
		if err != nil {
			return nil, err
		}
		ids[i] = id
	}
	return ids, nil
}

// storedHash returns the content hash of an already stored span, or nil.
// Safe without ON CONFLICT races because the caller holds the per-trace lock.
func storedHash(ctx context.Context, tx pgx.Tx, s *normalize.Span) ([]byte, error) {
	var h []byte
	err := tx.QueryRow(ctx, `SELECT content_hash FROM spans WHERE workspace_id=$1 AND trace_id=$2 AND span_id=$3`,
		workspaceID, s.TraceID, s.SpanID).Scan(&h)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return h, err
}

// insertOrGet inserts a dedup row or returns the existing id. DO NOTHING (not
// DO UPDATE) so concurrent requests for the same service do not serialize on a
// row lock held until commit. args[0:2] must be (workspace_id, hash).
func insertOrGet(ctx context.Context, tx pgx.Tx, insert, lookup string, args ...any) (int64, error) {
	var id int64
	err := tx.QueryRow(ctx, insert, args...).Scan(&id)
	if err == pgx.ErrNoRows {
		err = tx.QueryRow(ctx, lookup, args[0], args[1]).Scan(&id)
	}
	return id, err
}

func insertSpan(ctx context.Context, tx pgx.Tx, s *normalize.Span, resID, scopeID, ingestionID int64) error {
	_, err := tx.Exec(ctx, `INSERT INTO spans (workspace_id, trace_id, span_id, parent_span_id, trace_state, flags, name, kind,
		start_unix_nano, end_unix_nano, duration_nano, status_code, status_message, resource_id, scope_id, service_name,
		attributes, dropped_attributes_count, events, dropped_events_count, links, dropped_links_count,
		content_hash, ingestion_id, quality_flags)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
		workspaceID, s.TraceID, s.SpanID, s.ParentSpanID, s.TraceState, int64(s.Flags), s.Name, s.Kind,
		s.Start, s.End, s.Duration, s.StatusCode, s.StatusMessage, resID, scopeID, s.ServiceName,
		s.Attributes, s.DroppedAttributes, s.Events, s.DroppedEvents, s.Links, s.DroppedLinks,
		s.ContentHash, ingestionID, s.QualityFlags)
	return err
}

// recomputeSummary rebuilds a trace summary from stored spans (correct under late
// and out-of-order arrival; the per-trace advisory lock serializes writers).
const recomputeSummary = `
INSERT INTO trace_summaries (workspace_id, trace_id, min_start_unix_nano, max_end_unix_nano,
  root_span_id, root_count, root_service_name, root_name, root_duration_nano,
  span_count, error_span_count, service_names, orphan_count, skew_span_count,
  first_received_at, last_received_at)
SELECT $1, $2, min(s.start_unix_nano), max(s.end_unix_nano),
  CASE WHEN count(*) FILTER (WHERE s.parent_span_id IS NULL) = 1 THEN (array_agg(s.span_id) FILTER (WHERE s.parent_span_id IS NULL))[1] END,
  count(*) FILTER (WHERE s.parent_span_id IS NULL),
  CASE WHEN count(*) FILTER (WHERE s.parent_span_id IS NULL) = 1 THEN (array_agg(s.service_name) FILTER (WHERE s.parent_span_id IS NULL))[1] END,
  CASE WHEN count(*) FILTER (WHERE s.parent_span_id IS NULL) = 1 THEN (array_agg(s.name) FILTER (WHERE s.parent_span_id IS NULL))[1] END,
  CASE WHEN count(*) FILTER (WHERE s.parent_span_id IS NULL) = 1 THEN (array_agg(s.duration_nano) FILTER (WHERE s.parent_span_id IS NULL))[1] END,
  count(*),
  count(*) FILTER (WHERE s.status_code = 2),
  (SELECT array_agg(x.service_name ORDER BY x.first_start, x.service_name)
     FROM (SELECT service_name, min(start_unix_nano) AS first_start FROM spans
           WHERE workspace_id = $1 AND trace_id = $2 GROUP BY service_name) x),
  count(*) FILTER (WHERE s.parent_span_id IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM spans p WHERE p.workspace_id = s.workspace_id AND p.trace_id = s.trace_id AND p.span_id = s.parent_span_id)),
  count(*) FILTER (WHERE s.quality_flags & 1 = 1),
  min(s.received_at), max(s.received_at)
FROM spans s
WHERE s.workspace_id = $1 AND s.trace_id = $2
ON CONFLICT (workspace_id, trace_id) DO UPDATE SET
  min_start_unix_nano = EXCLUDED.min_start_unix_nano, max_end_unix_nano = EXCLUDED.max_end_unix_nano,
  root_span_id = EXCLUDED.root_span_id, root_count = EXCLUDED.root_count,
  root_service_name = EXCLUDED.root_service_name, root_name = EXCLUDED.root_name,
  root_duration_nano = EXCLUDED.root_duration_nano, span_count = EXCLUDED.span_count,
  error_span_count = EXCLUDED.error_span_count, service_names = EXCLUDED.service_names,
  orphan_count = EXCLUDED.orphan_count, skew_span_count = EXCLUDED.skew_span_count,
  first_received_at = EXCLUDED.first_received_at, last_received_at = EXCLUDED.last_received_at`
