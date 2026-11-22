// SPDX-License-Identifier: Apache-2.0

// Contract + oracle tests against a real PostgreSQL (TRACEFLOW_TEST_DATABASE_URL).
// Every response body is validated against api/openapi.yaml; aggregates are
// compared with an independent in-memory oracle over the same seeded dataset.
package httpapi

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/santhosh-tekuri/jsonschema/v6"
	collectortrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"gopkg.in/yaml.v3"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/normalize"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/query"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/store"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/testdb"
)

var ctx = context.Background()

// ---------------------------------------------------------------- schema

func compiler(t *testing.T) *jsonschema.Compiler {
	t.Helper()
	raw, err := os.ReadFile("../../../../api/openapi.yaml")
	if err != nil {
		t.Fatal(err)
	}
	var y any
	if err := yaml.Unmarshal(raw, &y); err != nil {
		t.Fatal(err)
	}
	js, _ := json.Marshal(y)
	doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(js))
	if err != nil {
		t.Fatal(err)
	}
	c := jsonschema.NewCompiler()
	c.DefaultDraft(jsonschema.Draft2020)
	if err := c.AddResource("openapi.json", doc); err != nil {
		t.Fatal(err)
	}
	return c
}

func ptr(s string) string { return strings.ReplaceAll(strings.ReplaceAll(s, "~", "~0"), "/", "~1") }

// validate checks body against the 200 schema of path/method, or the Problem schema for errors.
func validate(t *testing.T, c *jsonschema.Compiler, path, method string, status int, body []byte) {
	t.Helper()
	loc := "openapi.json#/components/schemas/Problem"
	if status == 200 {
		loc = fmt.Sprintf("openapi.json#/paths/%s/%s/responses/200/content/%s/schema", ptr(path), method, ptr("application/json"))
	}
	sch, err := c.Compile(loc)
	if err != nil {
		t.Fatalf("compile %s: %v", loc, err)
	}
	inst, err := jsonschema.UnmarshalJSON(bytes.NewReader(body))
	if err != nil {
		t.Fatalf("%s %s: response is not JSON: %v", method, path, err)
	}
	if err := sch.Validate(inst); err != nil {
		t.Fatalf("%s %s (%d) violates contract: %v\nbody: %.600s", method, path, status, err, body)
	}
}

// ---------------------------------------------------------------- dataset

type oSpan struct {
	trace, span, parent string
	svc, name           string
	kind                tracepb.Span_SpanKind
	start, end          int64
	err                 bool
}

const base = int64(1_763_800_000_000_000_000)

func tid(i int) []byte {
	b := make([]byte, 16)
	binary.BigEndian.PutUint64(b[8:], uint64(i+1))
	b[0] = 0x0a
	return b
}
func sid(i, j int) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint32(b, uint32(i+1))
	binary.BigEndian.PutUint32(b[4:], uint32(j+1))
	return b
}

// dataset: 120 traces gateway→orders→inventory (S/C chains), deterministic durations,
// ~10% errors at inventory, one negative-duration server span, one orphan trace.
func dataset() ([]*collectortrace.ExportTraceServiceRequest, []oSpan) {
	r := rand.New(rand.NewPCG(42, 7))
	var all []oSpan
	bySvc := map[string][]*tracepb.Span{}
	add := func(o oSpan, tr, sp, par []byte) {
		all = append(all, o)
		s := &tracepb.Span{TraceId: tr, SpanId: sp, ParentSpanId: par, Name: o.name, Kind: o.kind,
			StartTimeUnixNano: uint64(o.start), EndTimeUnixNano: uint64(o.end)}
		if o.err {
			s.Status = &tracepb.Status{Code: tracepb.Status_STATUS_CODE_ERROR}
		}
		bySvc[o.svc] = append(bySvc[o.svc], s)
	}
	hx := func(b []byte) string { return fmt.Sprintf("%x", b) }
	for i := 0; i < 120; i++ {
		t0 := base + int64(i)*int64(time.Second)
		tr := tid(i)
		inv := int64(r.IntN(50_000_000)) + 1_000_000 // 1–51 ms
		isErr := i%10 == 3
		ids := [][]byte{sid(i, 0), sid(i, 1), sid(i, 2), sid(i, 3), sid(i, 4)}
		gwS := oSpan{hx(tr), hx(ids[0]), "", "gateway", "GET /checkout", tracepb.Span_SPAN_KIND_SERVER, t0, t0 + inv + 4_000_000, isErr}
		gwC := oSpan{hx(tr), hx(ids[1]), hx(ids[0]), "gateway", "GET", tracepb.Span_SPAN_KIND_CLIENT, t0 + 500_000, t0 + inv + 3_500_000, isErr}
		orS := oSpan{hx(tr), hx(ids[2]), hx(ids[1]), "orders", "GET /orders", tracepb.Span_SPAN_KIND_SERVER, t0 + 1_000_000, t0 + inv + 3_000_000, isErr}
		orC := oSpan{hx(tr), hx(ids[3]), hx(ids[2]), "orders", "GET", tracepb.Span_SPAN_KIND_CLIENT, t0 + 1_500_000, t0 + inv + 2_500_000, isErr}
		inS := oSpan{hx(tr), hx(ids[4]), hx(ids[3]), "inventory", "GET /stock", tracepb.Span_SPAN_KIND_SERVER, t0 + 2_000_000, t0 + 2_000_000 + inv, isErr}
		if i == 7 { // clock skew on one inventory server span
			inS.end = inS.start - 5_000_000
		}
		parents := [][]byte{nil, ids[0], ids[1], ids[2], ids[3]}
		for j, o := range []oSpan{gwS, gwC, orS, orC, inS} {
			if i == 11 && j == 0 { // orphan trace: root never sent
				continue
			}
			add(o, tr, ids[j], parents[j])
		}
	}
	var reqs []*collectortrace.ExportTraceServiceRequest
	for _, svc := range []string{"gateway", "orders", "inventory"} {
		spans := bySvc[svc]
		for k := 0; k < len(spans); k += 100 {
			end := min(k+100, len(spans))
			reqs = append(reqs, &collectortrace.ExportTraceServiceRequest{ResourceSpans: []*tracepb.ResourceSpans{{
				Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{{Key: "service.name",
					Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: svc}}}}},
				ScopeSpans: []*tracepb.ScopeSpans{{Scope: &commonpb.InstrumentationScope{Name: "oracle"}, Spans: spans[k:end]}},
			}}})
		}
	}
	var kept []oSpan
	for _, o := range all {
		kept = append(kept, o)
	}
	return reqs, kept
}

// ---------------------------------------------------------------- oracle

func nearestRank(sorted []int64, p float64) int64 {
	i := int(math.Ceil(p*float64(len(sorted)))) - 1
	return sorted[max(i, 0)]
}

type oracleStats struct {
	total, errs   int
	p50, p95, p99 *int64
}

func oracle(spans []oSpan, svc string) oracleStats {
	var d []int64
	st := oracleStats{}
	for _, s := range spans {
		if s.kind != tracepb.Span_SPAN_KIND_SERVER || (svc != "" && s.svc != svc) {
			continue
		}
		st.total++
		if s.err {
			st.errs++
		}
		if s.end-s.start >= 0 {
			d = append(d, s.end-s.start)
		}
	}
	sort.Slice(d, func(i, j int) bool { return d[i] < d[j] })
	set := func(n int, p float64) *int64 {
		if len(d) < n {
			return nil
		}
		v := nearestRank(d, p)
		return &v
	}
	st.p50, st.p95, st.p99 = set(1, 0.5), set(20, 0.95), set(100, 0.99)
	return st
}

// ---------------------------------------------------------------- harness

func setup(t *testing.T, profile string) (http.Handler, []oSpan) {
	t.Helper()
	pool := testdb.Open(t, "httpapi")
	if _, err := pool.Exec(ctx, `TRUNCATE spans, span_conflicts, trace_summaries, resources, scopes, ingestion_records, settings_audit RESTART IDENTITY CASCADE;
		DELETE FROM settings WHERE key <> 'retention_days'; UPDATE settings SET value = '7' WHERE key = 'retention_days'`); err != nil {
		t.Fatal(err)
	}
	reqs, spans := dataset()
	st := store.New(pool)
	for _, r := range reqs {
		if _, err := st.Ingest(ctx, normalize.Normalize(r), store.Meta{Source: "direct"}); err != nil {
			t.Fatal(err)
		}
	}
	s := New(query.New(pool), slog.New(slog.NewTextHandler(testLog(), nil)), profile, query.Limits{MaxQueryWindow: MaxWindow})
	mux := http.NewServeMux()
	s.Routes(mux)
	return mux, spans
}

type resp struct {
	status int
	body   []byte
	header http.Header
}

func call(t *testing.T, h http.Handler, method, path string, q url.Values, body string, hdr ...string) resp {
	t.Helper()
	target := path
	if len(q) > 0 {
		target += "?" + q.Encode()
	}
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if cc := rec.Header().Get("Cache-Control"); cc != "private, no-store" {
		t.Fatalf("%s %s: Cache-Control=%q", method, path, cc)
	}
	return resp{rec.Code, rec.Body.Bytes(), rec.Header()}
}

func win() url.Values {
	return url.Values{"from": {strconv.FormatInt(base, 10)}, "to": {strconv.FormatInt(base+int64(time.Hour), 10)}}
}

func with(v url.Values, kv ...string) url.Values {
	out := url.Values{}
	for k, vs := range v {
		out[k] = vs
	}
	for i := 0; i+1 < len(kv); i += 2 {
		out.Set(kv[i], kv[i+1])
	}
	return out
}

// ---------------------------------------------------------------- tests

func TestEveryOperationMatchesContract(t *testing.T) {
	h, _ := setup(t, "local-dev")
	c := compiler(t)
	trace := fmt.Sprintf("%x", tid(3))
	span := fmt.Sprintf("%x", sid(3, 4))
	cases := []struct {
		method, route, path string
		q                   url.Values
		body                string
		hdr                 []string
	}{
		{"get", "/v1/overview", "/v1/overview", win(), "", nil},
		{"get", "/v1/overview", "/v1/overview", with(win(), "service", "orders"), "", nil},
		{"get", "/v1/traces", "/v1/traces", with(win(), "limit", "10"), "", nil},
		{"get", "/v1/traces", "/v1/traces", with(win(), "status", "error", "service", "inventory", "min_duration_nano", "1000"), "", nil},
		{"get", "/v1/traces/{traceId}", "/v1/traces/" + trace, nil, "", nil},
		{"get", "/v1/traces/{traceId}", "/v1/traces/" + trace, url.Values{"detail": {"lite"}}, "", nil},
		{"get", "/v1/traces/{traceId}/spans/{spanId}", "/v1/traces/" + trace + "/spans/" + span, nil, "", nil},
		{"get", "/v1/services", "/v1/services", win(), "", nil},
		{"get", "/v1/services/{serviceName}", "/v1/services/orders", win(), "", nil},
		{"get", "/v1/dependencies", "/v1/dependencies", win(), "", nil},
		{"get", "/v1/analytics/server-latency", "/v1/analytics/server-latency", with(win(), "bucket_seconds", "60"), "", nil},
		{"get", "/v1/analytics/latency-distribution", "/v1/analytics/latency-distribution", with(win(), "service", "inventory"), "", nil},
		{"get", "/v1/ingestion/status", "/v1/ingestion/status", url.Values{"from": {strconv.FormatInt(time.Now().Add(-time.Hour).UnixNano(), 10)}, "to": {strconv.FormatInt(time.Now().Add(time.Hour).UnixNano(), 10)}}, "", nil},
		{"get", "/v1/settings", "/v1/settings", nil, "", nil},
		{"patch", "/v1/settings", "/v1/settings", nil, `{"retention_days":3}`, []string{"X-Traceflow-Actor", "1001", "Content-Type", "application/json"}},
	}
	for _, tc := range cases {
		r := call(t, h, strings.ToUpper(tc.method), tc.path, tc.q, tc.body, tc.hdr...)
		if r.status != 200 {
			t.Fatalf("%s %s: status %d body %s", tc.method, tc.path, r.status, r.body)
		}
		validate(t, c, tc.route, tc.method, r.status, r.body)
	}
	// Errors are Problem documents.
	for _, e := range []struct {
		path   string
		q      url.Values
		status int
	}{
		{"/v1/overview", nil, 400},
		{"/v1/overview", url.Values{"from": {"10"}, "to": {"5"}}, 400},
		{"/v1/traces", with(win(), "to", strconv.FormatInt(base+int64(8*24*time.Hour), 10)), 400},
		{"/v1/traces", with(win(), "limit", "500"), 400},
		{"/v1/traces/zz", nil, 400},
		{"/v1/traces/" + strings.Repeat("0", 32), nil, 404},
		{"/v1/services/nosuch", win(), 404},
		{"/v1/analytics/server-latency", url.Values{"from": {"0"}, "to": {strconv.FormatInt(int64(7*24*time.Hour), 10)}, "bucket_seconds": {"60"}}, 400},
	} {
		r := call(t, h, "GET", e.path, e.q, "")
		if r.status != e.status {
			t.Fatalf("GET %s %v: status %d want %d (%s)", e.path, e.q, r.status, e.status, r.body)
		}
		validate(t, c, e.path, "get", r.status, r.body)
	}
}

func TestStatsMatchOracle(t *testing.T) {
	h, spans := setup(t, "local-dev")
	for _, svc := range []string{"", "gateway", "orders", "inventory"} {
		r := call(t, h, "GET", "/v1/overview", with(win(), "service", svc), "")
		var ov struct {
			Totals struct {
				RequestCount  int      `json:"request_count"`
				ErrorCount    int      `json:"error_count"`
				ErrorFraction *float64 `json:"error_fraction"`
				Latency       struct{ P50, P95, P99 *string }
			}
		}
		_ = json.Unmarshal(r.body, &ov)
		want := oracle(spans, svc)
		got := ov.Totals
		if got.RequestCount != want.total || got.ErrorCount != want.errs {
			t.Fatalf("svc=%q counts got %d/%d want %d/%d", svc, got.RequestCount, got.ErrorCount, want.total, want.errs)
		}
		if math.Abs(*got.ErrorFraction-float64(want.errs)/float64(want.total)) > 1e-6 {
			t.Fatalf("svc=%q error_fraction %v", svc, *got.ErrorFraction)
		}
		for name, pair := range map[string][2]any{"p50": {got.Latency.P50, want.p50}, "p95": {got.Latency.P95, want.p95}, "p99": {got.Latency.P99, want.p99}} {
			g, w := pair[0].(*string), pair[1].(*int64)
			if (g == nil) != (w == nil) || (g != nil && *g != strconv.FormatInt(*w, 10)) {
				t.Fatalf("svc=%q %s got %v want %v", svc, name, deref(g), derefI(w))
			}
		}
	}
	// 120 inventory server spans: p99 needs >= 100 samples → present; per-operation slices are smaller.
	r := call(t, h, "GET", "/v1/services/inventory", win(), "")
	if !bytes.Contains(r.body, []byte(`"p99":"`)) {
		t.Fatalf("expected p99 for 119 non-negative samples: %.300s", r.body)
	}
}

func deref(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}
func derefI(v *int64) string {
	if v == nil {
		return "<nil>"
	}
	return strconv.FormatInt(*v, 10)
}

func TestHistogramInvariant(t *testing.T) {
	h, spans := setup(t, "local-dev")
	r := call(t, h, "GET", "/v1/analytics/latency-distribution", with(win(), "service", "inventory"), "")
	var d struct {
		Buckets    []struct{ Count int } `json:"buckets"`
		Excluded   int                   `json:"excluded_negative_duration"`
		Population struct {
			SampleCount int `json:"sample_count"`
		} `json:"population"`
	}
	_ = json.Unmarshal(r.body, &d)
	sum := 0
	for _, b := range d.Buckets {
		sum += b.Count
	}
	if sum+d.Excluded != d.Population.SampleCount || d.Excluded != 1 || d.Population.SampleCount != oracle(spans, "inventory").total {
		t.Fatalf("sum=%d excluded=%d sample=%d", sum, d.Excluded, d.Population.SampleCount)
	}
}

func TestPaginationNoSkipNoDuplicate(t *testing.T) {
	h, _ := setup(t, "local-dev")
	seen := map[string]bool{}
	var order []string
	q := with(win(), "limit", "7")
	for page := 0; page < 50; page++ {
		r := call(t, h, "GET", "/v1/traces", q, "")
		var l struct {
			Items []struct {
				TraceID string `json:"trace_id"`
				Start   string `json:"start_unix_nano"`
			} `json:"items"`
			Next *string `json:"next_cursor"`
		}
		_ = json.Unmarshal(r.body, &l)
		for _, it := range l.Items {
			if seen[it.TraceID] {
				t.Fatalf("duplicate %s on page %d", it.TraceID, page)
			}
			seen[it.TraceID] = true
			order = append(order, it.Start+it.TraceID)
		}
		if l.Next == nil {
			break
		}
		q = with(q, "cursor", *l.Next)
	}
	if len(seen) != 120 {
		t.Fatalf("paged %d traces, want 120", len(seen))
	}
	if !sort.SliceIsSorted(order, func(i, j int) bool { return order[i] > order[j] }) {
		t.Fatal("pages not in (start, trace_id) DESC order")
	}
	// Cursor bound to filters.
	r := call(t, h, "GET", "/v1/traces", with(win(), "limit", "7"), "")
	var l struct {
		Next *string `json:"next_cursor"`
	}
	_ = json.Unmarshal(r.body, &l)
	r = call(t, h, "GET", "/v1/traces", with(win(), "limit", "7", "status", "error", "cursor", *l.Next), "")
	if r.status != 400 || !bytes.Contains(r.body, []byte("cursor_filter_mismatch")) {
		t.Fatalf("cursor reuse with new filter: %d %s", r.status, r.body)
	}
	if r := call(t, h, "GET", "/v1/traces", with(win(), "cursor", "!!"), ""); r.status != 400 {
		t.Fatalf("bad cursor status %d", r.status)
	}
}

func TestTraceDetailSemantics(t *testing.T) {
	h, _ := setup(t, "local-dev")
	get := func(i int) map[string]any {
		r := call(t, h, "GET", fmt.Sprintf("/v1/traces/%x", tid(i)), nil, "")
		var m map[string]any
		_ = json.Unmarshal(r.body, &m)
		return m
	}
	normal := get(3)
	if b := normal["summary"].(map[string]any)["duration"].(map[string]any)["basis"]; b != "root_span" {
		t.Fatalf("normal trace basis %v", b)
	}
	orphan := get(11)
	sum := orphan["summary"].(map[string]any)
	if sum["duration"].(map[string]any)["basis"] != "observed_range_estimate" || sum["root"] != nil {
		t.Fatalf("orphan summary %v", sum)
	}
	missing := 0
	for _, s := range orphan["spans"].([]any) {
		sp := s.(map[string]any)
		if sp["parent_span_id"] != nil && sp["parent_present"] == false {
			missing++
		}
	}
	if missing != 1 {
		t.Fatalf("orphan trace: %d spans with missing parent, want 1", missing)
	}
	skew := get(7)
	if skew["summary"].(map[string]any)["completeness"].(map[string]any)["has_clock_skew"] != true {
		t.Fatal("skewed trace not flagged")
	}
	lite := call(t, h, "GET", fmt.Sprintf("/v1/traces/%x", tid(3)), url.Values{"detail": {"lite"}}, "")
	if bytes.Contains(lite.body, []byte(`"attributes"`)) && bytes.Contains(lite.body, []byte(`"events"`)) {
		var m map[string]any
		_ = json.Unmarshal(lite.body, &m)
		if _, ok := m["spans"].([]any)[0].(map[string]any)["attributes"]; ok {
			t.Fatal("lite detail must omit per-span attributes")
		}
	}
}

func TestDependenciesEvidenceOnly(t *testing.T) {
	h, _ := setup(t, "local-dev")
	r := call(t, h, "GET", "/v1/dependencies", win(), "")
	var g struct {
		Nodes []struct {
			ServiceName string `json:"service_name"`
		} `json:"nodes"`
		Edges []struct {
			Source, Target string
			Evidence       struct {
				Basis      string   `json:"basis"`
				Pairs      int      `json:"parent_child_pairs"`
				TraceCount int      `json:"trace_count"`
				Samples    []string `json:"sample_trace_ids"`
			}
		} `json:"edges"`
	}
	_ = json.Unmarshal(r.body, &g)
	nodes := map[string]bool{}
	for _, n := range g.Nodes {
		nodes[n.ServiceName] = true
	}
	got := map[string]int{}
	for _, e := range g.Edges {
		if !nodes[e.Source] || !nodes[e.Target] {
			t.Fatalf("edge %s→%s endpoint missing from nodes", e.Source, e.Target)
		}
		if e.Evidence.Basis != "client_server_parent_child" || len(e.Evidence.Samples) == 0 || len(e.Evidence.Samples) > 5 {
			t.Fatalf("edge evidence %+v", e.Evidence)
		}
		got[e.Source+"→"+e.Target] = e.Evidence.Pairs
	}
	// gateway→orders: 120 pairs (orphan trace keeps gateway CLIENT); orders→inventory: 120.
	if len(got) != 2 || got["gateway→orders"] != 120 || got["orders→inventory"] != 120 {
		t.Fatalf("edges %v", got)
	}
}

func TestPublicDemoHidesOperationalEndpoints(t *testing.T) {
	h, _ := setup(t, "public-demo")
	for _, p := range []string{"/v1/ingestion/status", "/v1/settings"} {
		req := httptest.NewRequest("GET", p+"?"+win().Encode(), nil)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != 404 {
			t.Fatalf("public-demo %s status %d", p, rec.Code)
		}
	}
	req := httptest.NewRequest("PATCH", "/v1/settings", strings.NewReader(`{"retention_days":1}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 404 && rec.Code != 405 {
		t.Fatalf("public-demo PATCH settings status %d", rec.Code)
	}
}

func TestSettingsPatchValidationAndAudit(t *testing.T) {
	h, _ := setup(t, "local-dev")
	c := compiler(t)
	for _, tc := range []struct {
		body, actor string
	}{
		{`{"retention_days":0}`, "1001"},
		{`{"retention_days":5,"extra":1}`, "1001"},
		{`{}`, "1001"},
		{`{"retention_days":5}`, "alice"},
	} {
		r := call(t, h, "PATCH", "/v1/settings", nil, tc.body, "X-Traceflow-Actor", tc.actor)
		if r.status != 400 || !bytes.Contains(r.body, []byte(`"errors"`)) {
			t.Fatalf("PATCH %s actor %s: %d %s", tc.body, tc.actor, r.status, r.body)
		}
		validate(t, c, "/v1/settings", "patch", r.status, r.body)
	}
	r := call(t, h, "PATCH", "/v1/settings", nil, `{"retention_days":14}`, "X-Traceflow-Actor", "1001")
	if r.status != 200 || !bytes.Contains(r.body, []byte(`"retention_days":14`)) {
		t.Fatalf("patch ok: %d %s", r.status, r.body)
	}
}

// testLog shows server-side errors when TRACEFLOW_TEST_VERBOSE is set.
func testLog() io.Writer {
	if os.Getenv("TRACEFLOW_TEST_VERBOSE") != "" {
		return os.Stderr
	}
	return io.Discard
}

// TestValidatorRejectsViolations proves the contract check is not vacuous.
func TestValidatorRejectsViolations(t *testing.T) {
	c := compiler(t)
	sch, err := c.Compile("openapi.json#/components/schemas/TraceList")
	if err != nil {
		t.Fatal(err)
	}
	for name, body := range map[string]string{
		"missing freshness": `{"window":{"from":"1","to":"2"},"items":[],"next_cursor":null}`,
		"number nanos":      `{"window":{"from":1,"to":"2"},"freshness":{"generated_at":"1","last_span_received_at":null},"items":[],"next_cursor":null}`,
		"bad trace id":      `{"window":{"from":"1","to":"2"},"freshness":{"generated_at":"1","last_span_received_at":null},"items":[{"trace_id":"XYZ"}],"next_cursor":null}`,
	} {
		inst, _ := jsonschema.UnmarshalJSON(strings.NewReader(body))
		if sch.Validate(inst) == nil {
			t.Fatalf("%s: validator accepted an invalid body", name)
		}
	}
}
