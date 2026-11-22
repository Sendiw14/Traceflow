// SPDX-License-Identifier: Apache-2.0

package query

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/api"
)

var rejectReasons = map[string]bool{"invalid_id": true, "invalid_timestamp": true, "invalid_span": true, "conflicting_replay": true, "trace_span_limit": true}

func (s *Store) IngestionStatus(ctx context.Context, w Window) (api.IngestionStatus, error) {
	from, to := time.Unix(0, w.From), time.Unix(0, w.To)
	out := api.IngestionStatus{Window: w.API(), Freshness: s.Freshness(ctx), Requests: map[string]int{}, RejectReasons: map[string]int{}}
	rows, err := s.pool.Query(ctx, `SELECT http_status, count(*), sum(spans_received), sum(spans_accepted), sum(spans_duplicate), sum(spans_rejected)
		FROM ingestion_records WHERE received_at >= $1 AND received_at < $2 GROUP BY 1`, from, to)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var status, n, recv, acc, dup, rej int
		if err := rows.Scan(&status, &n, &recv, &acc, &dup, &rej); err != nil {
			rows.Close()
			return out, err
		}
		out.Requests[strconv.Itoa(status)] = n
		out.SpansReceived += recv
		out.SpansAccepted += acc
		out.SpansDuplicate += dup
		out.SpansRejected += rej
	}
	rows.Close()
	// Span-level reasons only; request-level failures are visible in Requests by status.
	rows, err = s.pool.Query(ctx, `SELECT key, sum(value::int) FROM ingestion_records, jsonb_each_text(reject_reasons)
		WHERE received_at >= $1 AND received_at < $2 GROUP BY 1`, from, to)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var k string
		var n int
		if err := rows.Scan(&k, &n); err != nil {
			rows.Close()
			return out, err
		}
		if rejectReasons[k] {
			out.RejectReasons[k] = n
		}
	}
	rows.Close()
	out.SpansConflict = out.RejectReasons["conflicting_replay"]

	var last *time.Time
	if err := s.pool.QueryRow(ctx, `SELECT max(received_at) FROM ingestion_records WHERE received_at >= $1 AND received_at < $2`, from, to).Scan(&last); err != nil {
		return out, err
	}
	if last != nil {
		v := ns(last.UnixNano())
		out.LastRequestAt = &v
	}
	var tid []byte
	err = s.pool.QueryRow(ctx, `SELECT trace_id FROM trace_summaries WHERE last_received_at >= $1 AND last_received_at < $2
		ORDER BY last_received_at DESC, trace_id DESC LIMIT 1`, from, to).Scan(&tid)
	if err == nil {
		v := hexID(tid)
		out.LatestTraceId = &v
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return out, err
	}
	var first *string
	if err := s.pool.QueryRow(ctx, `SELECT value #>> '{}' FROM settings WHERE key = 'first_span_received_at'`).Scan(&first); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return out, err
	}
	out.FirstSpanReceivedAt = first
	return out, nil
}

// Limits reported by getSettings; values come from the components that enforce them.
type Limits struct {
	MaxRequestBytesCompressed, MaxRequestBytesRaw int
	MaxSpansPerRequest, MaxSpansPerTrace          int
	MaxQueryWindow                                time.Duration
}

func (s *Store) Settings(ctx context.Context, profile string, readOnly bool, lim Limits) (api.Settings, error) {
	out := api.Settings{GeneratedAt: ns(s.now().UnixNano()), Profile: api.SettingsProfile(profile), ReadOnly: readOnly}
	out.Limits.MaxRequestBytesCompressed = lim.MaxRequestBytesCompressed
	out.Limits.MaxRequestBytesRaw = lim.MaxRequestBytesRaw
	out.Limits.MaxSpansPerRequest = lim.MaxSpansPerRequest
	out.Limits.MaxSpansPerTrace = lim.MaxSpansPerTrace
	out.Limits.MaxQueryWindowSeconds = int(lim.MaxQueryWindow / time.Second)
	if err := s.pool.QueryRow(ctx, `SELECT (value #>> '{}')::int FROM settings WHERE key = 'retention_days'`).Scan(&out.RetentionDays); err != nil {
		return out, err
	}
	var raw []byte
	err := s.pool.QueryRow(ctx, `SELECT value FROM settings WHERE key = 'last_retention_run'`).Scan(&raw)
	if err == nil {
		var r struct {
			FinishedAt    int64  `json:"finished_at"`
			TracesDeleted int    `json:"traces_deleted"`
			SpansDeleted  int    `json:"spans_deleted"`
			Status        string `json:"status"`
		}
		if json.Unmarshal(raw, &r) == nil {
			out.LastRetentionRun = &struct {
				FinishedAt    api.Nanos                          `json:"finished_at"`
				SpansDeleted  int                                `json:"spans_deleted"`
				Status        api.SettingsLastRetentionRunStatus `json:"status"`
				TracesDeleted int                                `json:"traces_deleted"`
			}{FinishedAt: ns(r.FinishedAt), SpansDeleted: r.SpansDeleted, TracesDeleted: r.TracesDeleted, Status: api.SettingsLastRetentionRunStatus(r.Status)}
			if !readOnly {
				next := ns(r.FinishedAt + int64(time.Hour)) // retention loop cadence (cmd/server)
				out.NextRetentionRun = &next
			}
		}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return out, err
	}
	return out, nil
}

// UpdateRetention sets retention_days and writes an audit row in one transaction.
func (s *Store) UpdateRetention(ctx context.Context, days int, actor string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()
	var old []byte
	if err := tx.QueryRow(ctx, `SELECT value FROM settings WHERE key = 'retention_days' FOR UPDATE`).Scan(&old); err != nil {
		return err
	}
	nv, _ := json.Marshal(days)
	if _, err := tx.Exec(ctx, `UPDATE settings SET value = $1, updated_at = now() WHERE key = 'retention_days'`, nv); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO settings_audit (key, old_value, new_value, actor) VALUES ('retention_days', $1, $2, $3)`, old, nv, actor); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
