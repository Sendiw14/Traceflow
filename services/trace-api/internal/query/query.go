// SPDX-License-Identifier: Apache-2.0

// Package query implements read paths for api/openapi.yaml 1.0.0.
// Populations are observed SERVER spans whose start falls in [from, to)
// (spec §5.2); sampling is never reconstructed.
package query

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/api"
)

const (
	workspaceID    = 1
	PopulationNote = "Observed SERVER spans only; sampling is not reconstructed."
	// Reliability floors for percentiles (api-contract.md).
	floorP50, floorP95, floorP99 = 1, 20, 100
	MaxSeriesPoints              = 2000
	MaxTraceSpans                = 50000
)

// ErrNotFound and ErrCursor are mapped to 404 / 400 by the HTTP layer.
var (
	ErrNotFound       = errors.New("not found")
	ErrCursorInvalid  = errors.New("cursor invalid")
	ErrCursorMismatch = errors.New("cursor filter mismatch")
	ErrTooManyPoints  = errors.New("too many points")
)

type Store struct {
	pool *pgxpool.Pool
	now  func() time.Time
}

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool, now: time.Now} }

// Window is a validated [From, To) range in Unix ns.
type Window struct{ From, To int64 }

func (w Window) API() api.Window { return api.Window{From: ns(w.From), To: ns(w.To)} }

func (s *Store) Freshness(ctx context.Context) api.Freshness {
	f := api.Freshness{GeneratedAt: ns(s.now().UnixNano())}
	var last *time.Time
	if err := s.pool.QueryRow(ctx, `SELECT max(received_at) FROM spans`).Scan(&last); err == nil && last != nil {
		v := ns(last.UnixNano())
		f.LastSpanReceivedAt = &v
	}
	return f
}

// ---------------------------------------------------------------- statistics

// Filter narrows a SERVER-span population. Group selects a whitelisted column.
type Filter struct {
	Service, Operation string
	Group              string // "", "service_name" or "name"
}

var groupCols = map[string]string{"": "''::text", "service_name": "service_name", "name": "name"}

func floors(n int, p50, p95, p99 *int64) api.Percentiles {
	var out api.Percentiles
	if n >= floorP50 && p50 != nil {
		out.P50 = nsPtr(p50)
	}
	if n >= floorP95 && p95 != nil {
		out.P95 = nsPtr(p95)
	}
	if n >= floorP99 && p99 != nil {
		out.P99 = nsPtr(p99)
	}
	return out
}

func fraction(errs, total int) *float32 {
	if total == 0 {
		return nil
	}
	f := float32(errs) / float32(total)
	return &f
}

func emptyStats() *api.ServerStats {
	st := &api.ServerStats{Population: api.Population{SpanKind: api.PopulationSpanKindServer, Note: PopulationNote}}
	zero := 0
	st.UnsetStatusCount = &zero
	return st
}

// ServerStats returns stats per group key for the filtered SERVER population.
func (s *Store) ServerStats(ctx context.Context, w Window, f Filter) (map[string]*api.ServerStats, error) {
	col, ok := groupCols[f.Group]
	if !ok {
		return nil, fmt.Errorf("bad group %q", f.Group)
	}
	where := `workspace_id = $1 AND kind = 2 AND start_unix_nano >= $2 AND start_unix_nano < $3
		AND ($4 = '' OR service_name = $4) AND ($5 = '' OR name = $5)`
	args := []any{workspaceID, w.From, w.To, f.Service, f.Operation}
	out := map[string]*api.ServerStats{}

	rows, err := s.pool.Query(ctx, `SELECT `+col+` AS k, count(*), count(*) FILTER (WHERE status_code = 2), count(*) FILTER (WHERE status_code = 0),
		count(*) FILTER (WHERE duration_nano >= 0),
		percentile_disc(0.5)  WITHIN GROUP (ORDER BY duration_nano) FILTER (WHERE duration_nano >= 0),
		percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_nano) FILTER (WHERE duration_nano >= 0),
		percentile_disc(0.99) WITHIN GROUP (ORDER BY duration_nano) FILTER (WHERE duration_nano >= 0)
		FROM spans WHERE `+where+` GROUP BY 1`, args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var k string
		var total, errs, unset, nLat int
		var p50, p95, p99 *int64
		if err := rows.Scan(&k, &total, &errs, &unset, &nLat, &p50, &p95, &p99); err != nil {
			rows.Close()
			return nil, err
		}
		st := emptyStats()
		st.Population.SampleCount = total
		st.RequestCount, st.ErrorCount = total, errs
		st.UnsetStatusCount = &unset
		st.ErrorFraction = fraction(errs, total)
		st.Latency = floors(nLat, p50, p95, p99)
		out[k] = st
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Exemplars: slowest (non-negative) and latest error span per group. Ties broken by ids.
	rows, err = s.pool.Query(ctx, `SELECT DISTINCT ON (`+col+`) `+col+`, trace_id, span_id FROM spans
		WHERE `+where+` AND duration_nano >= 0 ORDER BY `+col+`, duration_nano DESC, trace_id, span_id`, args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var k string
		var t, sp []byte
		if err := rows.Scan(&k, &t, &sp); err != nil {
			rows.Close()
			return nil, err
		}
		if st := out[k]; st != nil {
			ti, si := hexID(t), hexID(sp)
			st.Exemplars.SlowestTraceId, st.Exemplars.SlowestSpanId = &ti, &si
		}
	}
	rows.Close()
	rows, err = s.pool.Query(ctx, `SELECT DISTINCT ON (`+col+`) `+col+`, trace_id, span_id FROM spans
		WHERE `+where+` AND status_code = 2 ORDER BY `+col+`, start_unix_nano DESC, trace_id, span_id`, args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var k string
		var t, sp []byte
		if err := rows.Scan(&k, &t, &sp); err != nil {
			rows.Close()
			return nil, err
		}
		if st := out[k]; st != nil {
			ti, si := hexID(t), hexID(sp)
			st.Exemplars.LatestErrorTraceId, st.Exemplars.LatestErrorSpanId = &ti, &si
		}
	}
	rows.Close()
	return out, rows.Err()
}

// sampleErrorTraces returns up to 3 most recent distinct traces with an error SERVER span, per group.
func (s *Store) sampleErrorTraces(ctx context.Context, w Window, f Filter) (map[string][]api.TraceId, error) {
	col := groupCols[f.Group]
	rows, err := s.pool.Query(ctx, `SELECT k, trace_id FROM (
		  SELECT k, trace_id, row_number() OVER (PARTITION BY k ORDER BY last_start DESC, trace_id) rn FROM (
		    SELECT `+col+` AS k, trace_id, max(start_unix_nano) last_start FROM spans
		    WHERE workspace_id = $1 AND kind = 2 AND status_code = 2 AND start_unix_nano >= $2 AND start_unix_nano < $3
		      AND ($4 = '' OR service_name = $4) AND ($5 = '' OR name = $5)
		    GROUP BY 1, 2) x) y
		WHERE rn <= 3 ORDER BY k, rn`, workspaceID, w.From, w.To, f.Service, f.Operation)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string][]api.TraceId{}
	for rows.Next() {
		var k string
		var t []byte
		if err := rows.Scan(&k, &t); err != nil {
			return nil, err
		}
		out[k] = append(out[k], hexID(t))
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------- traces

const summaryCols = `trace_id, min_start_unix_nano, max_end_unix_nano, root_span_id, root_count, root_service_name, root_name,
	root_duration_nano, span_count, error_span_count, service_names, orphan_count, skew_span_count, last_received_at`

// durationExpr: trusted root duration when exactly one non-negative root, else observed range.
const durationExpr = `CASE WHEN root_count = 1 AND root_duration_nano >= 0 THEN root_duration_nano ELSE max_end_unix_nano - min_start_unix_nano END`

func scanSummary(row pgx.Row) (api.TraceSummary, error) {
	var tid, rootID []byte
	var minStart, maxEnd int64
	var rootCount, spanCount, errCount, orphans, skew int
	var rootSvc, rootName *string
	var rootDur *int64
	var services []string
	var lastRecv time.Time
	if err := row.Scan(&tid, &minStart, &maxEnd, &rootID, &rootCount, &rootSvc, &rootName, &rootDur, &spanCount, &errCount, &services, &orphans, &skew, &lastRecv); err != nil {
		return api.TraceSummary{}, err
	}
	ts := api.TraceSummary{
		TraceId: hexID(tid), StartUnixNano: ns(minStart), SpanCount: spanCount, ErrorSpanCount: errCount,
		ServiceCount: len(services),
	}
	if len(services) > 50 {
		services = services[:50]
	}
	ts.ServiceNames = append([]string{}, services...)
	if rootCount == 1 && rootDur != nil && *rootDur >= 0 {
		ts.Duration = api.TraceDuration{ValueNano: ns(*rootDur), Basis: "root_span"}
	} else {
		ts.Duration = api.TraceDuration{ValueNano: ns(maxEnd - minStart), Basis: "observed_range_estimate"}
	}
	if rootID != nil && rootSvc != nil && rootName != nil {
		ts.Root = &struct {
			Name        string          `json:"name"`
			ServiceName api.ServiceName `json:"service_name"`
			SpanId      api.SpanId      `json:"span_id"`
		}{Name: *rootName, ServiceName: *rootSvc, SpanId: hexID(rootID)}
	}
	lr := ns(lastRecv.UnixNano())
	ts.Completeness = api.TraceCompleteness{RootCount: rootCount, OrphanCount: orphans, HasClockSkew: skew > 0, LastReceivedAt: &lr}
	return ts, nil
}

type TraceFilter struct {
	Service     string
	Status      string // any | error | ok_or_unset
	MinDuration *int64
	Limit       int
	Cursor      string
}

type cursor struct {
	Start int64  `json:"s"`
	Trace string `json:"t"`
	Hash  string `json:"f"`
}

func (f TraceFilter) hash(w Window) string {
	md := ""
	if f.MinDuration != nil {
		md = strconv.FormatInt(*f.MinDuration, 10)
	}
	return fmt.Sprintf("%d|%d|%s|%s|%s", w.From, w.To, f.Service, f.Status, md)
}

func (s *Store) ListTraces(ctx context.Context, w Window, f TraceFilter) (api.TraceList, error) {
	var cStart int64 = 1<<63 - 1
	cTrace := []byte{0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff}
	if f.Cursor != "" {
		raw, err := base64.RawURLEncoding.DecodeString(f.Cursor)
		var c cursor
		if err != nil || json.Unmarshal(raw, &c) != nil {
			return api.TraceList{}, ErrCursorInvalid
		}
		t, err := hex.DecodeString(c.Trace)
		if err != nil || len(t) != 16 {
			return api.TraceList{}, ErrCursorInvalid
		}
		if c.Hash != f.hash(w) {
			return api.TraceList{}, ErrCursorMismatch
		}
		cStart, cTrace = c.Start, t
	}
	minDur := int64(-1 << 63)
	if f.MinDuration != nil {
		minDur = *f.MinDuration
	}
	rows, err := s.pool.Query(ctx, `SELECT `+summaryCols+` FROM trace_summaries
		WHERE workspace_id = $1 AND min_start_unix_nano >= $2 AND min_start_unix_nano < $3
		  AND ($4 = '' OR service_names @> ARRAY[$4]::text[])
		  AND ($5 = 'any' OR ($5 = 'error' AND error_span_count > 0) OR ($5 = 'ok_or_unset' AND error_span_count = 0))
		  AND `+durationExpr+` >= $6
		  AND (min_start_unix_nano, trace_id) < ($7, $8)
		ORDER BY min_start_unix_nano DESC, trace_id DESC
		LIMIT $9`, workspaceID, w.From, w.To, f.Service, f.Status, minDur, cStart, cTrace, f.Limit+1)
	if err != nil {
		return api.TraceList{}, err
	}
	defer rows.Close()
	items := []api.TraceSummary{}
	for rows.Next() {
		ts, err := scanSummary(rows)
		if err != nil {
			return api.TraceList{}, err
		}
		items = append(items, ts)
	}
	if err := rows.Err(); err != nil {
		return api.TraceList{}, err
	}
	out := api.TraceList{Window: w.API(), Freshness: s.Freshness(ctx)}
	if len(items) > f.Limit {
		last := items[f.Limit-1]
		start, _ := strconv.ParseInt(last.StartUnixNano, 10, 64)
		b, _ := json.Marshal(cursor{Start: start, Trace: last.TraceId, Hash: f.hash(w)})
		c := base64.RawURLEncoding.EncodeToString(b)
		out.NextCursor = &c
		items = items[:f.Limit]
	}
	out.Items = items
	return out, nil
}

func (s *Store) recentTraces(ctx context.Context, w Window, service string, n int) ([]api.TraceSummary, error) {
	l, err := s.ListTraces(ctx, w, TraceFilter{Service: service, Status: "any", Limit: n})
	return l.Items, err
}

type spanRow struct {
	api.Span
	resourceID, scopeID int64
	attrs, evs, lks     []byte
	dropA, dropE, dropL int
}

func (s *Store) loadSpans(ctx context.Context, traceID []byte, spanID []byte, full bool) ([]spanRow, error) {
	jsonCols := `'[]'::jsonb, '[]'::jsonb, '[]'::jsonb`
	if full {
		jsonCols = `attributes, events, links`
	}
	rows, err := s.pool.Query(ctx, `SELECT span_id, parent_span_id, trace_state, name, kind, start_unix_nano, end_unix_nano, duration_nano,
		status_code, status_message, service_name, resource_id, scope_id, quality_flags,
		jsonb_array_length(attributes), jsonb_array_length(events), jsonb_array_length(links),
		dropped_attributes_count, dropped_events_count, dropped_links_count, `+jsonCols+`
		FROM spans WHERE workspace_id = $1 AND trace_id = $2 AND ($3::bytea IS NULL OR span_id = $3)
		ORDER BY start_unix_nano, span_id LIMIT $4`, workspaceID, traceID, spanID, MaxTraceSpans+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []spanRow
	for rows.Next() {
		var r spanRow
		var sid, pid []byte
		var traceState, name, statusMsg, svc string
		var kind, status int16
		var start, end, dur int64
		var q int
		if err := rows.Scan(&sid, &pid, &traceState, &name, &kind, &start, &end, &dur, &status, &statusMsg, &svc,
			&r.resourceID, &r.scopeID, &q, &r.AttributeCount, &r.EventCount, &r.LinkCount,
			&r.dropA, &r.dropE, &r.dropL, &r.attrs, &r.evs, &r.lks); err != nil {
			return nil, err
		}
		r.SpanId, r.Name, r.Kind, r.ServiceName = hexID(sid), name, kindName(kind), svc
		if pid != nil {
			p := hexID(pid)
			r.ParentSpanId = &p
		}
		r.TraceState = &traceState
		r.StartUnixNano, r.EndUnixNano, r.DurationNano = ns(start), ns(end), ns(dur)
		r.Status.Code = statusName(status)
		if statusMsg != "" {
			r.Status.Message = &statusMsg
		}
		r.Quality.NegativeDuration = q&1 != 0
		r.Quality.ZeroDuration = q&2 != 0
		r.Quality.Truncated = q&4 != 0
		if r.dropA+r.dropE+r.dropL > 0 {
			a, e, l := r.dropA, r.dropE, r.dropL
			r.Dropped = &struct {
				Attributes *int `json:"attributes,omitempty"`
				Events     *int `json:"events,omitempty"`
				Links      *int `json:"links,omitempty"`
			}{&a, &e, &l}
		}
		if full {
			a, e, l := attributes(r.attrs), events(r.evs), links(r.lks)
			r.Attributes, r.Events, r.Links = &a, &e, &l
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) resource(ctx context.Context, id int64) (api.Resource, error) {
	var res api.Resource
	var schema string
	var attrs []byte
	err := s.pool.QueryRow(ctx, `SELECT service_name, schema_url, attributes FROM resources WHERE id = $1`, id).Scan(&res.ServiceName, &schema, &attrs)
	res.SchemaUrl, res.Attributes = &schema, attributes(attrs)
	return res, err
}

func (s *Store) scope(ctx context.Context, id int64) (api.InstrumentationScope, error) {
	var sc api.InstrumentationScope
	var ver, schema string
	err := s.pool.QueryRow(ctx, `SELECT name, version, schema_url FROM scopes WHERE id = $1`, id).Scan(&sc.Name, &ver, &schema)
	sc.Version, sc.SchemaUrl = &ver, &schema
	return sc, err
}

func (s *Store) summary(ctx context.Context, traceID []byte) (api.TraceSummary, error) {
	ts, err := scanSummary(s.pool.QueryRow(ctx, `SELECT `+summaryCols+` FROM trace_summaries WHERE workspace_id = $1 AND trace_id = $2`, workspaceID, traceID))
	if errors.Is(err, pgx.ErrNoRows) {
		return ts, ErrNotFound
	}
	return ts, err
}

func (s *Store) GetTrace(ctx context.Context, traceID []byte, full bool) (api.TraceDetail, error) {
	sum, err := s.summary(ctx, traceID)
	if err != nil {
		return api.TraceDetail{}, err
	}
	rows, err := s.loadSpans(ctx, traceID, nil, full)
	if err != nil {
		return api.TraceDetail{}, err
	}
	out := api.TraceDetail{Summary: sum, Detail: "lite", Spans: []api.Span{}, Resources: []api.Resource{}, Scopes: []api.InstrumentationScope{}, Freshness: s.Freshness(ctx)}
	if full {
		out.Detail = "full"
	}
	if len(rows) > MaxTraceSpans {
		out.Truncation = &struct {
			SpansReturned int `json:"spans_returned"`
			SpansTotal    int `json:"spans_total"`
		}{SpansReturned: MaxTraceSpans, SpansTotal: sum.SpanCount}
		rows = rows[:MaxTraceSpans]
	}
	// parent_present is computed against all stored spans (api-contract.md N-3).
	present := map[string]bool{}
	if out.Truncation != nil {
		r, err := s.pool.Query(ctx, `SELECT span_id FROM spans WHERE workspace_id = $1 AND trace_id = $2`, workspaceID, traceID)
		if err != nil {
			return api.TraceDetail{}, err
		}
		for r.Next() {
			var b []byte
			_ = r.Scan(&b)
			present[hexID(b)] = true
		}
		r.Close()
	} else {
		for _, sp := range rows {
			present[sp.SpanId] = true
		}
	}
	resIdx, scIdx := map[int64]int{}, map[int64]int{}
	for i := range rows {
		r := &rows[i]
		if _, ok := resIdx[r.resourceID]; !ok {
			res, err := s.resource(ctx, r.resourceID)
			if err != nil {
				return api.TraceDetail{}, err
			}
			resIdx[r.resourceID] = len(out.Resources)
			out.Resources = append(out.Resources, res)
		}
		if _, ok := scIdx[r.scopeID]; !ok {
			sc, err := s.scope(ctx, r.scopeID)
			if err != nil {
				return api.TraceDetail{}, err
			}
			scIdx[r.scopeID] = len(out.Scopes)
			out.Scopes = append(out.Scopes, sc)
		}
		r.ResourceRef, r.ScopeRef = resIdx[r.resourceID], scIdx[r.scopeID]
		r.ParentPresent = r.ParentSpanId != nil && present[*r.ParentSpanId]
		out.Spans = append(out.Spans, r.Span)
	}
	return out, nil
}

func (s *Store) GetSpan(ctx context.Context, traceID, spanID []byte) (api.SpanDetail, error) {
	rows, err := s.loadSpans(ctx, traceID, spanID, true)
	if err != nil {
		return api.SpanDetail{}, err
	}
	if len(rows) == 0 {
		return api.SpanDetail{}, ErrNotFound
	}
	r := rows[0]
	if r.ParentSpanId != nil {
		pid, _ := hex.DecodeString(*r.ParentSpanId)
		_ = s.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM spans WHERE workspace_id = $1 AND trace_id = $2 AND span_id = $3)`,
			workspaceID, traceID, pid).Scan(&r.ParentPresent)
	}
	res, err := s.resource(ctx, r.resourceID)
	if err != nil {
		return api.SpanDetail{}, err
	}
	sc, err := s.scope(ctx, r.scopeID)
	if err != nil {
		return api.SpanDetail{}, err
	}
	out := api.SpanDetail{TraceId: hexID(traceID), Resource: res, Scope: sc, Freshness: s.Freshness(ctx)}
	b, _ := json.Marshal(r.Span) // SpanDetail.span is an allOf-generated struct with the same JSON shape
	if err := json.Unmarshal(b, &out.Span); err != nil {
		return api.SpanDetail{}, err
	}
	return out, nil
}

// ---------------------------------------------------------------- services

// serviceSummaries returns summaries for services with any span in the window (or the named service).
func (s *Store) serviceSummaries(ctx context.Context, w Window, only string) ([]api.ServiceSummary, error) {
	rows, err := s.pool.Query(ctx, `SELECT service_name, max(start_unix_nano) FROM spans
		WHERE workspace_id = $1 AND start_unix_nano >= $2 AND start_unix_nano < $3 AND ($4 = '' OR service_name = $4)
		GROUP BY 1 ORDER BY 1`, workspaceID, w.From, w.To, only)
	if err != nil {
		return nil, err
	}
	type svc struct {
		name string
		last int64
	}
	var names []svc
	for rows.Next() {
		var x svc
		if err := rows.Scan(&x.name, &x.last); err != nil {
			rows.Close()
			return nil, err
		}
		names = append(names, x)
	}
	rows.Close()
	stats, err := s.ServerStats(ctx, w, Filter{Service: only, Group: "service_name"})
	if err != nil {
		return nil, err
	}
	samples, err := s.sampleErrorTraces(ctx, w, Filter{Service: only, Group: "service_name"})
	if err != nil {
		return nil, err
	}
	out := make([]api.ServiceSummary, 0, len(names))
	for _, n := range names {
		st := stats[n.name]
		if st == nil {
			st = emptyStats()
		}
		ids := samples[n.name]
		if ids == nil {
			ids = []api.TraceId{}
		}
		out = append(out, api.ServiceSummary{ServiceName: n.name, LastObservedUnixNano: ns(n.last), ObservedInWindow: true, Server: *st, SampleErrorTraceIds: ids})
	}
	return out, nil
}

func (s *Store) ListServices(ctx context.Context, w Window) ([]api.ServiceSummary, error) {
	return s.serviceSummaries(ctx, w, "")
}

func (s *Store) GetService(ctx context.Context, w Window, name string) (api.ServiceDetail, error) {
	sums, err := s.serviceSummaries(ctx, w, name)
	if err != nil {
		return api.ServiceDetail{}, err
	}
	var svc api.ServiceSummary
	if len(sums) == 1 {
		svc = sums[0]
	} else {
		var last *int64
		if err := s.pool.QueryRow(ctx, `SELECT max(start_unix_nano) FROM spans WHERE workspace_id = $1 AND service_name = $2`, workspaceID, name).Scan(&last); err != nil {
			return api.ServiceDetail{}, err
		}
		if last == nil {
			return api.ServiceDetail{}, ErrNotFound
		}
		svc = api.ServiceSummary{ServiceName: name, LastObservedUnixNano: ns(*last), ObservedInWindow: false, Server: *emptyStats(), SampleErrorTraceIds: []api.TraceId{}}
	}
	stats, err := s.ServerStats(ctx, w, Filter{Service: name, Group: "name"})
	if err != nil {
		return api.ServiceDetail{}, err
	}
	samples, err := s.sampleErrorTraces(ctx, w, Filter{Service: name, Group: "name"})
	if err != nil {
		return api.ServiceDetail{}, err
	}
	ops := []api.OperationSummary{}
	for k, st := range stats {
		ids := samples[k]
		if ids == nil {
			ids = []api.TraceId{}
		}
		ops = append(ops, api.OperationSummary{Name: k, Server: *st, SampleErrorTraceIds: ids})
	}
	sort.Slice(ops, func(i, j int) bool {
		if ops[i].Server.RequestCount != ops[j].Server.RequestCount {
			return ops[i].Server.RequestCount > ops[j].Server.RequestCount
		}
		return ops[i].Name < ops[j].Name
	})
	if len(ops) > 500 {
		ops = ops[:500]
	}
	edges, err := s.edges(ctx, w)
	if err != nil {
		return api.ServiceDetail{}, err
	}
	out := api.ServiceDetail{Window: w.API(), Freshness: s.Freshness(ctx), Service: svc, Operations: ops, Downstream: []api.DependencyEdge{}, Upstream: []api.DependencyEdge{}}
	for _, e := range edges {
		if e.Source == name {
			out.Downstream = append(out.Downstream, e)
		}
		if e.Target == name {
			out.Upstream = append(out.Upstream, e)
		}
	}
	if out.RecentTraces, err = s.recentTraces(ctx, w, name, 20); err != nil {
		return api.ServiceDetail{}, err
	}
	return out, nil
}

// ---------------------------------------------------------------- topology

// edges derives caller→callee edges only from stored parent→child pairs across services.
func (s *Store) edges(ctx context.Context, w Window) ([]api.DependencyEdge, error) {
	rows, err := s.pool.Query(ctx, `WITH pairs AS (
		  SELECT p.service_name AS src, c.service_name AS dst, c.trace_id, c.start_unix_nano AS t, c.status_code,
		         (p.kind IN (3,4) AND c.kind IN (2,5)) AS cs
		  FROM spans c JOIN spans p ON p.workspace_id = c.workspace_id AND p.trace_id = c.trace_id AND p.span_id = c.parent_span_id
		  WHERE c.workspace_id = $1 AND c.start_unix_nano >= $2 AND c.start_unix_nano < $3 AND p.service_name <> c.service_name)
		SELECT src, dst, count(*), count(*) FILTER (WHERE status_code = 2), count(DISTINCT trace_id), bool_or(cs), min(t), max(t),
		       (SELECT array_agg(trace_id) FROM (SELECT trace_id FROM pairs q WHERE q.src = pairs.src AND q.dst = pairs.dst
		         GROUP BY trace_id ORDER BY max(t) DESC, trace_id LIMIT 5) z)
		FROM pairs GROUP BY src, dst ORDER BY src, dst LIMIT 5000`, workspaceID, w.From, w.To)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []api.DependencyEdge{}
	for rows.Next() {
		var e api.DependencyEdge
		var pairs, errPairs, traces int
		var cs bool
		var first, last int64
		var samples [][]byte
		if err := rows.Scan(&e.Source, &e.Target, &pairs, &errPairs, &traces, &cs, &first, &last, &samples); err != nil {
			return nil, err
		}
		e.Evidence.ParentChildPairs, e.Evidence.ErrorPairs, e.Evidence.TraceCount = pairs, &errPairs, traces
		// Basis is client_server when at least one pair is CLIENT/PRODUCER→SERVER/CONSUMER (strongest evidence present).
		e.Evidence.Basis = "other_parent_child"
		if cs {
			e.Evidence.Basis = "client_server_parent_child"
		}
		e.Evidence.FirstSeenUnixNano, e.Evidence.LastSeenUnixNano = ns(first), ns(last)
		e.Evidence.SampleTraceIds = make([]api.TraceId, len(samples))
		for i, t := range samples {
			e.Evidence.SampleTraceIds[i] = hexID(t)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) Dependencies(ctx context.Context, w Window) (api.DependencyGraph, error) {
	edges, err := s.edges(ctx, w)
	if err != nil {
		return api.DependencyGraph{}, err
	}
	nodes, err := s.ListServices(ctx, w)
	if err != nil {
		return api.DependencyGraph{}, err
	}
	// Invariant: every edge endpoint is a node. Parent spans may start before the
	// window; add such services with an observed summary outside the window.
	have := map[string]bool{}
	for _, n := range nodes {
		have[n.ServiceName] = true
	}
	for _, e := range edges {
		for _, name := range []string{e.Source, e.Target} {
			if have[name] {
				continue
			}
			var last *int64
			if err := s.pool.QueryRow(ctx, `SELECT max(start_unix_nano) FROM spans WHERE workspace_id = $1 AND service_name = $2`, workspaceID, name).Scan(&last); err != nil {
				return api.DependencyGraph{}, err
			}
			l := int64(0)
			if last != nil {
				l = *last
			}
			nodes = append(nodes, api.ServiceSummary{ServiceName: name, LastObservedUnixNano: ns(l), ObservedInWindow: false, Server: *emptyStats(), SampleErrorTraceIds: []api.TraceId{}})
			have[name] = true
		}
	}
	return api.DependencyGraph{Window: w.API(), Nodes: nodes, Edges: edges, Freshness: s.Freshness(ctx)}, nil
}

// ---------------------------------------------------------------- overview & analytics

func (s *Store) Overview(ctx context.Context, w Window, service string) (api.Overview, error) {
	tot, err := s.ServerStats(ctx, w, Filter{Service: service})
	if err != nil {
		return api.Overview{}, err
	}
	totals := emptyStats()
	if t := tot[""]; t != nil {
		totals = t
	}
	var traceCount int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM trace_summaries WHERE workspace_id = $1
		AND min_start_unix_nano >= $2 AND min_start_unix_nano < $3 AND ($4 = '' OR service_names @> ARRAY[$4]::text[])`,
		workspaceID, w.From, w.To, service).Scan(&traceCount); err != nil {
		return api.Overview{}, err
	}
	svcs, err := s.serviceSummaries(ctx, w, service)
	if err != nil {
		return api.Overview{}, err
	}
	sort.SliceStable(svcs, func(i, j int) bool {
		if svcs[i].Server.RequestCount != svcs[j].Server.RequestCount {
			return svcs[i].Server.RequestCount > svcs[j].Server.RequestCount
		}
		return svcs[i].ServiceName < svcs[j].ServiceName
	})
	if len(svcs) > 20 {
		svcs = svcs[:20]
	}
	recent, err := s.recentTraces(ctx, w, service, 20)
	if err != nil {
		return api.Overview{}, err
	}
	return api.Overview{Window: w.API(), Freshness: s.Freshness(ctx), Totals: *totals, TraceCount: traceCount, TopServices: svcs, RecentTraces: recent}, nil
}

func (s *Store) ServerLatency(ctx context.Context, w Window, service, op string, bucketSec int) (api.LatencySeries, error) {
	width := int64(bucketSec) * int64(time.Second)
	n := (w.To - w.From + width - 1) / width
	if n > MaxSeriesPoints {
		return api.LatencySeries{}, ErrTooManyPoints
	}
	rows, err := s.pool.Query(ctx, `SELECT (start_unix_nano - $2) / $6 AS b, count(*), count(*) FILTER (WHERE status_code = 2),
		count(*) FILTER (WHERE duration_nano >= 0),
		percentile_disc(0.5)  WITHIN GROUP (ORDER BY duration_nano) FILTER (WHERE duration_nano >= 0),
		percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_nano) FILTER (WHERE duration_nano >= 0),
		percentile_disc(0.99) WITHIN GROUP (ORDER BY duration_nano) FILTER (WHERE duration_nano >= 0)
		FROM spans WHERE workspace_id = $1 AND kind = 2 AND start_unix_nano >= $2 AND start_unix_nano < $3
		  AND ($4 = '' OR service_name = $4) AND ($5 = '' OR name = $5)
		GROUP BY 1`, workspaceID, w.From, w.To, service, op, width)
	if err != nil {
		return api.LatencySeries{}, err
	}
	byBucket := map[int64]*api.BucketStats{}
	for rows.Next() {
		var b int64
		var total, errs, nLat int
		var p50, p95, p99 *int64
		if err := rows.Scan(&b, &total, &errs, &nLat, &p50, &p95, &p99); err != nil {
			rows.Close()
			return api.LatencySeries{}, err
		}
		byBucket[b] = &api.BucketStats{SampleCount: total, RequestCount: total, ErrorCount: errs, ErrorFraction: fraction(errs, total), Latency: floors(nLat, p50, p95, p99)}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return api.LatencySeries{}, err
	}
	fresh := s.Freshness(ctx)
	gen, _ := strconv.ParseInt(fresh.GeneratedAt, 10, 64)
	points := make([]api.LatencyPoint, n)
	for i := int64(0); i < n; i++ {
		start := w.From + i*width
		points[i] = api.LatencyPoint{BucketStartUnixNano: ns(start), Partial: start+width > gen, Stats: byBucket[i]}
	}
	overall, err := s.ServerStats(ctx, w, Filter{Service: service, Operation: op})
	if err != nil {
		return api.LatencySeries{}, err
	}
	ov := emptyStats()
	if o := overall[""]; o != nil {
		ov = o
	}
	out := api.LatencySeries{Window: w.API(), Freshness: fresh, BucketSeconds: bucketSec, Points: points, Overall: *ov}
	if service != "" {
		out.Service = &service
	}
	if op != "" {
		out.Operation = &op
	}
	return out, nil
}

// HistogramBounds are fixed 1-2-5 log-spaced upper bounds (ns) from 100 µs to 60 s; a final open bucket follows.
var HistogramBounds = func() []int64 {
	var b []int64
	for _, decade := range []int64{100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000, 10_000_000_000} {
		for _, m := range []int64{1, 2, 5} {
			b = append(b, decade*m)
		}
	}
	return append(b, 60_000_000_000)
}()

func (s *Store) LatencyDistribution(ctx context.Context, w Window, service, op string) (api.LatencyDistribution, error) {
	counts := make([]int, len(HistogramBounds)+1)
	var negative, total int
	rows, err := s.pool.Query(ctx, `SELECT width_bucket(duration_nano, $6::bigint[]) AS b, count(*)
		FROM spans WHERE workspace_id = $1 AND kind = 2 AND start_unix_nano >= $2 AND start_unix_nano < $3
		  AND ($4 = '' OR service_name = $4) AND ($5 = '' OR name = $5) AND duration_nano >= 0
		GROUP BY 1`, workspaceID, w.From, w.To, service, op, HistogramBounds)
	if err != nil {
		return api.LatencyDistribution{}, err
	}
	for rows.Next() {
		var b, c int
		if err := rows.Scan(&b, &c); err != nil {
			rows.Close()
			return api.LatencyDistribution{}, err
		}
		counts[b] += c // width_bucket: 0 = below first bound, i = [bound[i-1], bound[i]), len = >= last bound
		total += c
	}
	rows.Close()
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM spans WHERE workspace_id = $1 AND kind = 2 AND start_unix_nano >= $2 AND start_unix_nano < $3
		AND ($4 = '' OR service_name = $4) AND ($5 = '' OR name = $5) AND duration_nano < 0`, workspaceID, w.From, w.To, service, op).Scan(&negative); err != nil {
		return api.LatencyDistribution{}, err
	}
	out := api.LatencyDistribution{Window: w.API(), Freshness: s.Freshness(ctx), ExcludedNegativeDuration: negative,
		Population: api.Population{SpanKind: api.PopulationSpanKindServer, Note: PopulationNote, SampleCount: total + negative}}
	lower := int64(0)
	for i, c := range counts {
		b := struct {
			Count     int        `json:"count"`
			LowerNano api.Nanos  `json:"lower_nano"`
			UpperNano *api.Nanos `json:"upper_nano"`
		}{Count: c, LowerNano: ns(lower)}
		if i < len(HistogramBounds) {
			u := ns(HistogramBounds[i])
			b.UpperNano = &u
			lower = HistogramBounds[i]
		}
		out.Buckets = append(out.Buckets, b)
	}
	if service != "" {
		out.Service = &service
	}
	if op != "" {
		out.Operation = &op
	}
	return out, nil
}
