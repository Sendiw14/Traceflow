// SPDX-License-Identifier: Apache-2.0

package ingest

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	collectortrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	rpcstatus "google.golang.org/genproto/googleapis/rpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/normalize"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/store"
)

type fakeIngester struct {
	err      error
	calls    int
	failures []int
}

func (f *fakeIngester) Ingest(_ context.Context, b *normalize.Batch, _ store.Meta) (store.Result, error) {
	f.calls++
	if f.err != nil {
		return store.Result{}, f.err
	}
	return store.Result{Accepted: len(b.Spans), Rejected: b.Rejected}, nil
}

func (f *fakeIngester) RecordFailure(_ context.Context, _ store.Meta, status, _ int, _ string) {
	f.failures = append(f.failures, status)
}

func span(id byte) *tracepb.Span {
	return &tracepb.Span{TraceId: bytes.Repeat([]byte{0xaa}, 16), SpanId: bytes.Repeat([]byte{id}, 8),
		Name: "op", StartTimeUnixNano: 1, EndTimeUnixNano: 2}
}

func request(spans ...*tracepb.Span) []byte {
	b, _ := proto.Marshal(&collectortrace.ExportTraceServiceRequest{ResourceSpans: []*tracepb.ResourceSpans{{
		Resource:   &resourcepb.Resource{Attributes: []*commonpb.KeyValue{{Key: "service.name", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "svc"}}}}},
		ScopeSpans: []*tracepb.ScopeSpans{{Spans: spans}},
	}}})
	return b
}

func gz(b []byte) []byte {
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	_, _ = w.Write(b)
	_ = w.Close()
	return buf.Bytes()
}

type call struct {
	method, ctype, enc string
	body               []byte
}

func post(h http.Handler, c call) *httptest.ResponseRecorder {
	if c.method == "" {
		c.method = http.MethodPost
	}
	if c.ctype == "" {
		c.ctype = protobufType
	}
	req := httptest.NewRequest(c.method, "/v1/traces", bytes.NewReader(c.body))
	req.Header.Set("Content-Type", c.ctype)
	if c.enc != "" {
		req.Header.Set("Content-Encoding", c.enc)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decodeOK(t *testing.T, rec *httptest.ResponseRecorder) *collectortrace.ExportTraceServiceResponse {
	t.Helper()
	if rec.Code != 200 || rec.Header().Get("Content-Type") != protobufType {
		t.Fatalf("status=%d ctype=%q body=%q", rec.Code, rec.Header().Get("Content-Type"), rec.Body.String())
	}
	var r collectortrace.ExportTraceServiceResponse
	if err := proto.Unmarshal(rec.Body.Bytes(), &r); err != nil {
		t.Fatalf("response is not ExportTraceServiceResponse: %v", err)
	}
	return &r
}

func decodeStatus(t *testing.T, rec *httptest.ResponseRecorder, wantHTTP int, wantCode int32) {
	t.Helper()
	if rec.Code != wantHTTP {
		t.Fatalf("status=%d want %d", rec.Code, wantHTTP)
	}
	if rec.Header().Get("Content-Type") != protobufType {
		t.Fatalf("ctype=%q", rec.Header().Get("Content-Type"))
	}
	var s rpcstatus.Status
	if err := proto.Unmarshal(rec.Body.Bytes(), &s); err != nil {
		t.Fatalf("body is not google.rpc.Status: %v", err)
	}
	if s.Code != wantCode || s.Message == "" {
		t.Fatalf("rpc code=%d msg=%q want code %d", s.Code, s.Message, wantCode)
	}
}

func newH(ing Ingester, mut func(*Limits)) *Handler {
	l := DefaultLimits
	if mut != nil {
		mut(&l)
	}
	return NewHandler(ing, l, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func TestOTLP01to04Success(t *testing.T) {
	h := newH(&fakeIngester{}, nil)
	if r := decodeOK(t, post(h, call{body: request(span(1), span(2))})); r.PartialSuccess != nil {
		t.Fatalf("OTLP-01: partial_success must be unset, got %v", r.PartialSuccess)
	}
	if r := decodeOK(t, post(h, call{body: gz(request(span(1))), enc: "gzip"})); r.PartialSuccess != nil {
		t.Fatal("OTLP-02: gzip partial_success must be unset")
	}
	if r := decodeOK(t, post(h, call{body: nil})); r.PartialSuccess != nil {
		t.Fatal("OTLP-03: empty request partial_success must be unset")
	}
	bad := span(3)
	bad.SpanId = []byte{1, 2, 3, 4}
	bad2 := span(4)
	bad2.SpanId = []byte{9}
	r := decodeOK(t, post(h, call{body: request(span(1), span(2), span(5), bad, bad2)}))
	if r.PartialSuccess == nil || r.PartialSuccess.RejectedSpans != 2 || r.PartialSuccess.ErrorMessage != "rejected spans: invalid_id=2" {
		t.Fatalf("OTLP-04: got %v", r.PartialSuccess)
	}
}

func TestOTLPErrors(t *testing.T) {
	f := &fakeIngester{}
	h := newH(f, func(l *Limits) { l.MaxCompressedBytes = 1 << 10; l.MaxRawBytes = 64 << 10; l.MaxSpansPerRequest = 3 })

	decodeStatus(t, post(h, call{body: []byte("\xff\xff\xff garbage")}), 400, 3)                   // OTLP-05
	decodeStatus(t, post(h, call{body: []byte(`{}`), ctype: "application/json"}), 415, 3)          // OTLP-06
	decodeStatus(t, post(h, call{body: bytes.Repeat([]byte{0}, 2<<10)}), 413, 3)                   // OTLP-07
	decodeStatus(t, post(h, call{body: gz(bytes.Repeat([]byte{0}, 10<<20)), enc: "gzip"}), 413, 3) // OTLP-08 bomb: ~10 KiB → 10 MiB
	decodeStatus(t, post(h, call{body: request(span(1)), enc: "br"}), 415, 3)                      // unsupported encoding
	decodeStatus(t, post(h, call{body: gz([]byte("not gzip"))[:5], enc: "gzip"}), 400, 3)          // truncated gzip
	decodeStatus(t, post(h, call{method: http.MethodGet}), 405, 12)                                // method
	decodeStatus(t, post(h, call{body: request(span(1), span(2), span(3), span(4))}), 413, 3)      // too many spans
	if f.calls != 0 {
		t.Fatalf("storage called %d times for rejected requests", f.calls)
	}
}

func TestOTLP09StorageFailureIsRetryable(t *testing.T) {
	h := newH(&fakeIngester{err: errors.New("conn refused")}, nil)
	rec := post(h, call{body: request(span(1))})
	decodeStatus(t, rec, 503, 14)
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("503 must carry Retry-After")
	}
}

func TestOTLP10Saturation(t *testing.T) {
	f := &fakeIngester{}
	h := newH(f, func(l *Limits) { l.MaxConcurrent = 1 })
	h.sem <- struct{}{} // occupy the only slot
	rec := post(h, call{body: request(span(1))})
	decodeStatus(t, rec, 429, 8)
	if rec.Header().Get("Retry-After") == "" || f.calls != 0 {
		t.Fatal("429 must carry Retry-After and not touch storage")
	}
}
