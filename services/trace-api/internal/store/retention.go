// SPDX-License-Identifier: Apache-2.0

package store

import (
	"context"
	"encoding/json"
	"time"
)

// RetentionBatch bounds each delete transaction (data-model.md "Retention").
const RetentionBatch = 5000

type RetentionResult struct {
	TracesDeleted int64
	SpansDeleted  int64
	Status        string // ok | partial | failed
}

// RunRetention deletes traces whose last span arrived before now - retention_days,
// in bounded batches, then old operational rows. Records the outcome in settings.
func (s *Store) RunRetention(ctx context.Context, now time.Time) (RetentionResult, error) {
	var days int
	if err := s.pool.QueryRow(ctx, `SELECT (value #>> '{}')::int FROM settings WHERE key = 'retention_days'`).Scan(&days); err != nil {
		return RetentionResult{Status: "failed"}, err
	}
	cutoff := now.Add(-time.Duration(days) * 24 * time.Hour)
	res := RetentionResult{Status: "ok"}
	for {
		var traces, spans int64
		err := s.pool.QueryRow(ctx, `
			WITH victims AS (
			  SELECT workspace_id, trace_id FROM trace_summaries
			  WHERE last_received_at < $1 ORDER BY last_received_at LIMIT $2),
			del_spans AS (
			  DELETE FROM spans s USING victims v
			  WHERE s.workspace_id = v.workspace_id AND s.trace_id = v.trace_id RETURNING 1),
			del_traces AS (
			  DELETE FROM trace_summaries t USING victims v
			  WHERE t.workspace_id = v.workspace_id AND t.trace_id = v.trace_id RETURNING 1)
			SELECT (SELECT count(*) FROM del_traces), (SELECT count(*) FROM del_spans)`, cutoff, RetentionBatch).Scan(&traces, &spans)
		if err != nil {
			res.Status = "partial"
			if res.TracesDeleted == 0 {
				res.Status = "failed"
			}
			s.recordRetention(ctx, now, res)
			return res, err
		}
		res.TracesDeleted += traces
		res.SpansDeleted += spans
		if traces < RetentionBatch {
			break
		}
		select {
		case <-ctx.Done():
			res.Status = "partial"
			s.recordRetention(context.WithoutCancel(ctx), now, res)
			return res, ctx.Err()
		case <-time.After(100 * time.Millisecond): // let ingest breathe between batches
		}
	}
	// Conflicts and ingestion records have no trace summary; age them out by their own timestamps.
	// ingestion_records still referenced by surviving spans (FK) are kept.
	if _, err := s.pool.Exec(ctx, `DELETE FROM span_conflicts WHERE received_at < $1`, cutoff); err != nil {
		res.Status = "partial"
	}
	if _, err := s.pool.Exec(ctx, `DELETE FROM ingestion_records r WHERE r.received_at < $1
		AND NOT EXISTS (SELECT 1 FROM spans s WHERE s.ingestion_id = r.id)
		AND NOT EXISTS (SELECT 1 FROM span_conflicts c WHERE c.ingestion_id = r.id)`, cutoff); err != nil {
		res.Status = "partial"
	}
	s.recordRetention(ctx, now, res)
	return res, nil
}

func (s *Store) recordRetention(ctx context.Context, now time.Time, r RetentionResult) {
	v, _ := json.Marshal(map[string]any{
		"finished_at":    now.UnixNano(),
		"traces_deleted": r.TracesDeleted,
		"spans_deleted":  r.SpansDeleted,
		"status":         r.Status,
	})
	_, _ = s.pool.Exec(ctx, `INSERT INTO settings (key, value) VALUES ('last_retention_run', $1)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, v)
}
