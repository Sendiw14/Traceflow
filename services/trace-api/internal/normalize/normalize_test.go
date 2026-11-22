// SPDX-License-Identifier: Apache-2.0

package normalize

import (
	"bytes"
	"encoding/json"
	"math"
	"strings"
	"testing"

	collectortrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

var (
	tid = bytes.Repeat([]byte{0xab}, 16)
	sid = bytes.Repeat([]byte{0x01}, 8)
)

func str(k, v string) *commonpb.KeyValue {
	return &commonpb.KeyValue{Key: k, Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: v}}}
}

func req(spans ...*tracepb.Span) *collectortrace.ExportTraceServiceRequest {
	return &collectortrace.ExportTraceServiceRequest{ResourceSpans: []*tracepb.ResourceSpans{{
		Resource:   &resourcepb.Resource{Attributes: []*commonpb.KeyValue{str("service.name", "orders")}},
		ScopeSpans: []*tracepb.ScopeSpans{{Scope: &commonpb.InstrumentationScope{Name: "test"}, Spans: spans}},
	}}}
}

func good() *tracepb.Span {
	return &tracepb.Span{TraceId: tid, SpanId: sid, Name: "GET /x", Kind: tracepb.Span_SPAN_KIND_SERVER, StartTimeUnixNano: 100, EndTimeUnixNano: 250}
}

func TestRejectReasons(t *testing.T) {
	mut := func(f func(*tracepb.Span)) *tracepb.Span { s := good(); f(s); return s }
	cases := map[string]*tracepb.Span{
		ReasonInvalidID:        mut(func(s *tracepb.Span) { s.SpanId = []byte{1, 2, 3, 4} }),
		ReasonInvalidTimestamp: mut(func(s *tracepb.Span) { s.StartTimeUnixNano = 0 }),
		ReasonInvalidSpan:      mut(func(s *tracepb.Span) { s.Name = "" }),
	}
	cases["zero trace id"] = mut(func(s *tracepb.Span) { s.TraceId = make([]byte, 16) })
	cases["huge ts"] = mut(func(s *tracepb.Span) { s.EndTimeUnixNano = math.MaxInt64 + 1 })
	cases["bad parent"] = mut(func(s *tracepb.Span) { s.ParentSpanId = []byte{1} })
	want := map[string]string{"zero trace id": ReasonInvalidID, "huge ts": ReasonInvalidTimestamp, "bad parent": ReasonInvalidID}
	for name, sp := range cases {
		b := Normalize(req(sp))
		reason := name
		if w, ok := want[name]; ok {
			reason = w
		}
		if len(b.Spans) != 0 || b.Rejected[reason] != 1 || b.Received != 1 {
			t.Errorf("%s: spans=%d rejected=%v", name, len(b.Spans), b.Rejected)
		}
	}
}

func TestGoodSpanAndFlags(t *testing.T) {
	neg := good()
	neg.SpanId = bytes.Repeat([]byte{0x02}, 8)
	neg.EndTimeUnixNano = 50
	zeroParent := good()
	zeroParent.SpanId = bytes.Repeat([]byte{0x03}, 8)
	zeroParent.ParentSpanId = make([]byte, 8)
	b := Normalize(req(good(), neg, zeroParent))
	if len(b.Spans) != 3 {
		t.Fatalf("spans=%d rejected=%v", len(b.Spans), b.Rejected)
	}
	if s := b.Spans[0]; s.Duration != 150 || s.ServiceName != "orders" || s.ParentSpanID != nil {
		t.Fatalf("bad span: %+v", s)
	}
	if s := b.Spans[1]; s.Duration != -50 || s.QualityFlags&FlagNegativeDuration == 0 {
		t.Fatalf("negative duration not flagged: %+v", s)
	}
	if b.Spans[2].ParentSpanID != nil {
		t.Fatal("all-zero parent should be stored as root")
	}
}

func TestContentHashStableAndSensitive(t *testing.T) {
	a := Normalize(req(good())).Spans[0].ContentHash
	b := Normalize(req(good())).Spans[0].ContentHash
	c := good()
	c.Name = "GET /y"
	d := Normalize(req(c)).Spans[0].ContentHash
	if !bytes.Equal(a, b) || bytes.Equal(a, d) {
		t.Fatal("content hash must be stable for identical spans and differ for changed ones")
	}
}

func TestSanitizeAndRedactAndTypes(t *testing.T) {
	sp := good()
	sp.Name = "bad\x00name\xff"
	sp.Attributes = []*commonpb.KeyValue{
		str("http.request.header.authorization", "Bearer abc"),
		str("http.request.header.x-custom", "v"),
		str("http.request.header.content-type", "json"),
		str("db.password", "pw"),
		{Key: "big", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_IntValue{IntValue: math.MaxInt64}}},
		{Key: "nan", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_DoubleValue{DoubleValue: math.NaN()}}},
		str("long", strings.Repeat("é", MaxValueBytes)),
	}
	b := Normalize(req(sp))
	s := b.Spans[0]
	if strings.ContainsRune(s.Name, 0) || !strings.Contains(s.Name, "�") {
		t.Fatalf("name not sanitized: %q", s.Name)
	}
	var attrs []map[string]any
	if err := json.Unmarshal(s.Attributes, &attrs); err != nil {
		t.Fatal(err)
	}
	got := map[string]map[string]any{}
	for _, a := range attrs {
		got[a["k"].(string)] = a
	}
	for _, k := range []string{"http.request.header.authorization", "http.request.header.x-custom", "db.password"} {
		if got[k]["v"] != redacted {
			t.Errorf("%s not redacted: %v", k, got[k])
		}
	}
	if got["http.request.header.content-type"]["v"] != "json" {
		t.Error("allowlisted header was redacted")
	}
	if b.Redacted != 3 {
		t.Errorf("Redacted=%d want 3", b.Redacted)
	}
	if got["big"]["t"] != "i" || got["big"]["v"] != "9223372036854775807" {
		t.Errorf("int64 not encoded as exact string: %v", got["big"])
	}
	if got["nan"]["t"] != "s" {
		t.Errorf("NaN must not be emitted as JSON number: %v", got["nan"])
	}
	if got["long"]["tr"] != true || len(got["long"]["v"].(string)) > MaxValueBytes || s.QualityFlags&FlagTruncated == 0 {
		t.Error("long value not truncated/flagged")
	}
	if !json.Valid(s.Attributes) || !json.Valid(s.Events) || !json.Valid(s.Links) {
		t.Fatal("invalid JSON")
	}
}

func TestAttributeLimits(t *testing.T) {
	sp := good()
	for i := 0; i < MaxAttributes+5; i++ {
		sp.Attributes = append(sp.Attributes, str("k"+strings.Repeat("x", i%3)+string(rune('a'+i%26))+strings.Repeat("y", i), "v"))
	}
	sp.Attributes = append(sp.Attributes, str(strings.Repeat("k", MaxKeyBytes+1), "v"))
	s := Normalize(req(sp)).Spans[0]
	if s.DroppedAttributes < 6 {
		t.Fatalf("dropped=%d", s.DroppedAttributes)
	}
}
