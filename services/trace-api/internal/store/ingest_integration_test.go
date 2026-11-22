// SPDX-License-Identifier: Apache-2.0

// Integration tests against a real PostgreSQL. Set TRACEFLOW_TEST_DATABASE_URL
// to a disposable database; tests truncate all tables. Skipped when unset.
package store

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	collectortrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/normalize"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/testdb"
)

var ctx = context.Background()

func testStore(t *testing.T) (*Store, *pgxpool.Pool) {
	t.Helper()
	pool := testdb.Open(t, "store")
	if _, err := pool.Exec(ctx, `TRUNCATE spans, span_conflicts, trace_summaries, resources, scopes, ingestion_records RESTART IDENTITY CASCADE`); err != nil {
		t.Fatal(err)
	}
	return New(pool), pool
}

var trace = bytes.Repeat([]byte{0x7a}, 16)

func id(b byte) []byte { return bytes.Repeat([]byte{b}, 8) }

func sp(spanID, parent byte, name string, start, end uint64) *tracepb.Span {
	s := &tracepb.Span{TraceId: trace, SpanId: id(spanID), Name: name, Kind: tracepb.Span_SPAN_KIND_SERVER, StartTimeUnixNano: start, EndTimeUnixNano: end}
	if parent != 0 {
		s.ParentSpanId = id(parent)
	}
	return s
}

func batch(svc string, spans ...*tracepb.Span) *normalize.Batch {
	return normalize.Normalize(&collectortrace.ExportTraceServiceRequest{ResourceSpans: []*tracepb.ResourceSpans{{
		Resource:   &resourcepb.Resource{Attributes: []*commonpb.KeyValue{{Key: "service.name", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: svc}}}}},
		ScopeSpans: []*tracepb.ScopeSpans{{Scope: &commonpb.InstrumentationScope{Name: "it-" + svc}, Spans: spans}},
	}}})
}

func ingest(t *testing.T, s *Store, b *normalize.Batch) Result {
	t.Helper()
	r, err := s.Ingest(ctx, b, Meta{Source: "direct"})
	if err != nil {
		t.Fatalf("ingest: %v", err)
	}
	return r
}

func scalar[T any](t *testing.T, pool *pgxpool.Pool, sql string, args ...any) T {
	t.Helper()
	var v T
	if err := pool.QueryRow(ctx, sql, args...).Scan(&v); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
	return v
}

type summary struct {
	SpanCount, ErrorCount, RootCount, OrphanCount, SkewCount int
	RootSpanID                                               []byte
	RootDuration                                             *int64
	Services                                                 []string
}

func getSummary(t *testing.T, pool *pgxpool.Pool) summary {
	t.Helper()
	var s summary
	if err := pool.QueryRow(ctx, `SELECT span_count, error_span_count, root_count, orphan_count, skew_span_count, root_span_id, root_duration_nano, service_names
		FROM trace_summaries WHERE trace_id=$1`, trace).Scan(&s.SpanCount, &s.ErrorCount, &s.RootCount, &s.OrphanCount, &s.SkewCount, &s.RootSpanID, &s.RootDuration, &s.Services); err != nil {
		t.Fatal(err)
	}
	return s
}

func TestOTLP11IdenticalReplay(t *testing.T) {
	s, pool := testStore(t)
	b := func() *normalize.Batch {
		return batch("gateway", sp(1, 0, "GET /", 100, 400), sp(2, 1, "call", 150, 300))
	}
	r1 := ingest(t, s, b())
	r2 := ingest(t, s, b())
	if r1.Accepted != 2 || r1.Duplicate != 0 || r2.Accepted != 2 || r2.Duplicate != 2 || r2.RejectedTotal() != 0 {
		t.Fatalf("r1=%+v r2=%+v", r1, r2)
	}
	if n := scalar[int](t, pool, `SELECT count(*) FROM spans`); n != 2 {
		t.Fatalf("spans=%d after identical replay", n)
	}
	if n := getSummary(t, pool).SpanCount; n != 2 {
		t.Fatalf("summary span_count=%d (double counted)", n)
	}
	if d := scalar[int](t, pool, `SELECT sum(spans_duplicate)::int FROM ingestion_records`); d != 2 {
		t.Fatalf("duplicate counter=%d", d)
	}
}

func TestOTLP12ConflictingReplayFirstWriteWins(t *testing.T) {
	s, pool := testStore(t)
	ingest(t, s, batch("gateway", sp(1, 0, "original", 100, 400)))
	r := ingest(t, s, batch("gateway", sp(1, 0, "changed", 100, 400)))
	if r.Accepted != 0 || r.Rejected[normalize.ReasonConflict] != 1 {
		t.Fatalf("result=%+v", r)
	}
	if name := scalar[string](t, pool, `SELECT name FROM spans`); name != "original" {
		t.Fatalf("stored name=%q; first write must win", name)
	}
	if n := scalar[int](t, pool, `SELECT count(*) FROM span_conflicts WHERE payload IS NOT NULL AND existing_hash <> incoming_hash`); n != 1 {
		t.Fatalf("span_conflicts=%d", n)
	}
}

func TestOTLP13LateParentReconcilesSummary(t *testing.T) {
	s, pool := testStore(t)
	ingest(t, s, batch("orders", sp(2, 1, "child", 150, 300)))
	if g := getSummary(t, pool); g.OrphanCount != 1 || g.RootCount != 0 || g.RootSpanID != nil {
		t.Fatalf("before parent: %+v", g)
	}
	ingest(t, s, batch("gateway", sp(1, 0, "root", 100, 400)))
	g := getSummary(t, pool)
	if g.OrphanCount != 0 || g.RootCount != 1 || !bytes.Equal(g.RootSpanID, id(1)) || g.RootDuration == nil || *g.RootDuration != 300 || g.SpanCount != 2 {
		t.Fatalf("after parent: %+v", g)
	}
	if len(g.Services) != 2 || g.Services[0] != "gateway" || g.Services[1] != "orders" {
		t.Fatalf("services ordered by first start: %v", g.Services)
	}
}

func TestOTLP14ClockSkewStoredAndFlagged(t *testing.T) {
	s, pool := testStore(t)
	ingest(t, s, batch("gateway", sp(1, 0, "skewed", 500, 400)))
	if d := scalar[int64](t, pool, `SELECT duration_nano FROM spans`); d != -100 {
		t.Fatalf("duration=%d", d)
	}
	if g := getSummary(t, pool); g.SkewCount != 1 {
		t.Fatalf("skew_span_count=%d", g.SkewCount)
	}
}

func TestMultipleRootsAndErrors(t *testing.T) {
	s, pool := testStore(t)
	e := sp(2, 0, "root2", 100, 200)
	e.Status = &tracepb.Status{Code: tracepb.Status_STATUS_CODE_ERROR, Message: "boom"}
	ingest(t, s, batch("gateway", sp(1, 0, "root1", 100, 300), e))
	g := getSummary(t, pool)
	if g.RootCount != 2 || g.RootSpanID != nil || g.RootDuration != nil || g.ErrorCount != 1 {
		t.Fatalf("summary=%+v", g)
	}
}

func TestOTLP15ResourceScopeDedup(t *testing.T) {
	s, pool := testStore(t)
	ingest(t, s, batch("gateway", sp(1, 0, "a", 1, 2)))
	ingest(t, s, batch("gateway", sp(2, 0, "b", 1, 2)))
	ingest(t, s, batch("orders", sp(3, 0, "c", 1, 2)))
	if n := scalar[int](t, pool, `SELECT count(*) FROM resources`); n != 2 {
		t.Fatalf("resources=%d want 2", n)
	}
	if n := scalar[int](t, pool, `SELECT count(*) FROM scopes`); n != 2 {
		t.Fatalf("scopes=%d want 2 (one per service in this fixture)", n)
	}
}

func TestOTLP16JSONBRoundTripAndSanitize(t *testing.T) {
	s, pool := testStore(t)
	x := sp(1, 0, "nul\x00name", 1, 2)
	x.Attributes = []*commonpb.KeyValue{{Key: "n", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_IntValue{IntValue: math.MaxInt64}}},
		{Key: "s\x00k", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "v\x00"}}}}
	x.Events = []*tracepb.Span_Event{{TimeUnixNano: math.MaxInt64, Name: "exception"}}
	x.Links = []*tracepb.Span_Link{{TraceId: bytes.Repeat([]byte{1}, 16), SpanId: id(9)}}
	ingest(t, s, batch("gateway", x))
	var attrs, events, links []byte
	if err := pool.QueryRow(ctx, `SELECT attributes, events, links FROM spans`).Scan(&attrs, &events, &links); err != nil {
		t.Fatal(err)
	}
	var a []map[string]any
	_ = json.Unmarshal(attrs, &a)
	if a[0]["v"] != "9223372036854775807" {
		t.Fatalf("int64 not exact after jsonb round trip: %v", a[0])
	}
	var ev []map[string]any
	_ = json.Unmarshal(events, &ev)
	if ev[0]["time_unix_nano"] != "9223372036854775807" {
		t.Fatalf("event time not exact: %v", ev)
	}
	if !bytes.Contains(links, []byte(`"span_id": "0909090909090909"`)) {
		t.Fatalf("links=%s", links)
	}
}

func TestTraceSpanLimit(t *testing.T) {
	s, pool := testStore(t)
	old := MaxSpansPerTrace
	MaxSpansPerTrace = 2
	t.Cleanup(func() { MaxSpansPerTrace = old })
	ingest(t, s, batch("gateway", sp(1, 0, "a", 1, 2), sp(2, 1, "b", 1, 2)))
	r := ingest(t, s, batch("gateway", sp(1, 0, "a", 1, 2), sp(3, 1, "c", 1, 2)))
	if r.Duplicate != 1 || r.Rejected[normalize.ReasonTraceSpanLimit] != 1 {
		t.Fatalf("at cap: duplicate must still be accepted, new span rejected: %+v", r)
	}
	if n := scalar[int](t, pool, `SELECT count(*) FROM spans`); n != 2 {
		t.Fatalf("spans=%d", n)
	}
}

// Many writers append disjoint spans to one trace at once; without per-trace
// serialization the recomputed summary misses spans committed concurrently.
func TestConcurrentWritersSameTrace(t *testing.T) {
	const writers, perWriter, rounds = 8, 150, 3
	for round := 0; round < rounds; round++ {
		s, pool := testStore(t)
		var wg sync.WaitGroup
		errs := make(chan error, writers)
		for w := 0; w < writers; w++ {
			wg.Add(1)
			go func(w int) {
				defer wg.Done()
				spans := make([]*tracepb.Span, perWriter)
				for i := range spans {
					n := uint64(w*perWriter + i + 1)
					x := &tracepb.Span{TraceId: trace, SpanId: []byte{0, 0, 0, 0, byte(n >> 24), byte(n >> 16), byte(n >> 8), byte(n)},
						Name: "op", StartTimeUnixNano: n, EndTimeUnixNano: n + 10}
					spans[i] = x
				}
				if _, err := s.Ingest(ctx, batch("svc", spans...), Meta{Source: "direct"}); err != nil {
					errs <- err
				}
			}(w)
		}
		wg.Wait()
		close(errs)
		for err := range errs {
			t.Fatal(err)
		}
		if g := getSummary(t, pool); g.SpanCount != writers*perWriter {
			t.Fatalf("round %d: summary span_count=%d want %d (lost concurrent spans)", round, g.SpanCount, writers*perWriter)
		}
	}
}

func TestFailedTransactionCommitsNothing(t *testing.T) {
	s, pool := testStore(t)
	c, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := s.Ingest(c, batch("gateway", sp(1, 0, "a", 1, 2)), Meta{Source: "direct"}); err == nil {
		t.Fatal("expected error with cancelled context")
	}
	if n := scalar[int](t, pool, `SELECT count(*) FROM spans`); n != 0 {
		t.Fatalf("spans=%d after failed ingest", n)
	}
}

// Writer A has written its summary but not committed when writer B recomputes.
// Without per-trace serialization B's summary omits A's span.
func TestSummaryNotLostWhenWriterCommitsLate(t *testing.T) {
	s, pool := testStore(t)
	inHook := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	afterSummaryHook = func() {
		once.Do(func() { close(inHook); <-release })
	}
	t.Cleanup(func() { afterSummaryHook = nil })

	errA := make(chan error, 1)
	go func() {
		_, err := s.Ingest(ctx, batch("svc", sp(1, 0, "a", 1, 10)), Meta{Source: "direct"})
		errA <- err
	}()
	<-inHook // A is between summary write and commit
	errB := make(chan error, 1)
	go func() {
		_, err := s.Ingest(ctx, batch("svc-b", sp(2, 1, "b", 2, 9)), Meta{Source: "direct"}) // distinct resource+scope: no shared dedup row
		errB <- err
	}()
	time.Sleep(300 * time.Millisecond) // give B time to reach its recompute if nothing blocks it
	close(release)
	if err := <-errA; err != nil {
		t.Fatal(err)
	}
	if err := <-errB; err != nil {
		t.Fatal(err)
	}
	if g := getSummary(t, pool); g.SpanCount != 2 || g.OrphanCount != 0 {
		t.Fatalf("summary=%+v; want both spans and no orphan", g)
	}
}

func TestRetentionDeletesOnlyExpiredTraces(t *testing.T) {
	s, pool := testStore(t)
	ingest(t, s, batch("gateway", sp(1, 0, "old", 1, 2), sp(2, 1, "old-child", 1, 2)))
	fresh := &tracepb.Span{TraceId: bytes.Repeat([]byte{0x11}, 16), SpanId: id(3), Name: "fresh", StartTimeUnixNano: 1, EndTimeUnixNano: 2}
	ingest(t, s, batch("gateway", fresh))
	if _, err := pool.Exec(ctx, `UPDATE trace_summaries SET last_received_at = now() - interval '8 days' WHERE trace_id = $1`, trace); err != nil {
		t.Fatal(err)
	}
	r, err := s.RunRetention(ctx, time.Now())
	if err != nil || r.Status != "ok" || r.TracesDeleted != 1 || r.SpansDeleted != 2 {
		t.Fatalf("retention=%+v err=%v", r, err)
	}
	if n := scalar[int](t, pool, `SELECT count(*) FROM spans`); n != 1 {
		t.Fatalf("spans left=%d want 1 (fresh trace)", n)
	}
	if st := scalar[string](t, pool, `SELECT value->>'status' FROM settings WHERE key='last_retention_run'`); st != "ok" {
		t.Fatalf("last_retention_run status=%q", st)
	}
	r2, _ := s.RunRetention(ctx, time.Now())
	if r2.TracesDeleted != 0 {
		t.Fatalf("second run deleted %d", r2.TracesDeleted)
	}
}
