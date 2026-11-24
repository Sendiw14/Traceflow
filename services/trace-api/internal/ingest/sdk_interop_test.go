// SPDX-License-Identifier: Apache-2.0

package ingest

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/normalize"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/store"
)

// flakyIngester fails the first `failures` calls (storage outage), then accepts.
type flakyIngester struct {
	mu       sync.Mutex
	failures int
	calls    int
	stored   int
}

func (f *flakyIngester) Ingest(_ context.Context, b *normalize.Batch, _ store.Meta) (store.Result, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.calls <= f.failures {
		return store.Result{}, errors.New("db down")
	}
	f.stored += len(b.Spans)
	return store.Result{Accepted: len(b.Spans), Rejected: b.Rejected}, nil
}

func (f *flakyIngester) RecordFailure(context.Context, store.Meta, int, int, string) {}

// OTLP-19: the reference OTel Go SDK exporter, pointed directly at the receiver,
// retries 503 + Retry-After and the spans are stored exactly once.
func TestOTLP19ReferenceSDKRetriesOn503(t *testing.T) {
	f := &flakyIngester{failures: 2}
	srv := httptest.NewServer(NewHandler(f, DefaultLimits, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer srv.Close()

	ctx := context.Background()
	exp, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpointURL(srv.URL+"/v1/traces"),
		otlptracehttp.WithRetry(otlptracehttp.RetryConfig{
			Enabled: true, InitialInterval: 50 * time.Millisecond, MaxInterval: 200 * time.Millisecond, MaxElapsedTime: 30 * time.Second,
		}),
	)
	if err != nil {
		t.Fatal(err)
	}
	tp := sdktrace.NewTracerProvider(sdktrace.WithSyncer(exp)) // export synchronously on span end
	_, span := tp.Tracer("otlp19").Start(ctx, "retry-me")
	start := time.Now()
	span.End()
	if err := tp.Shutdown(ctx); err != nil {
		t.Fatalf("shutdown: %v", err)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.calls != 3 || f.stored != 1 {
		t.Fatalf("calls=%d stored=%d; want 3 attempts (2×503 then 200) and 1 stored span", f.calls, f.stored)
	}
	// Retry-After: 5 from the receiver must be honoured over the SDK's 50 ms backoff.
	if elapsed := time.Since(start); elapsed < 9*time.Second {
		t.Fatalf("elapsed %v: SDK did not honour Retry-After 5 s between attempts", elapsed)
	}
}
