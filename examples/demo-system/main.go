// SPDX-License-Identifier: Apache-2.0

// Command demo runs one of three instrumented demo services (gateway → orders →
// inventory) or a load driver that triggers deterministic scenarios
// (docs/testing/fixtures.md DATA-01, DATA-05..08). Synthetic data only.
//
//	demo gateway|orders|inventory   serve on :8080
//	demo load                       call gateway once per scenario, print trace IDs
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/baggage"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	sdkresource "go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0"
	"go.opentelemetry.io/otel/trace"
)

var scenarios = []string{"normal", "slow", "error", "parallel", "missing-parent"}

const dropAttr = "demo.drop" // spans carrying this are not exported (missing-parent scenario)

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	if len(os.Args) != 2 {
		log.Fatal("usage: demo gateway|orders|inventory|load")
	}
	role := os.Args[1]
	if role == "load" {
		if err := load(); err != nil {
			log.Fatal(err)
		}
		return
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	shutdown, err := setupTracing(ctx, role)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = shutdown(context.Background()) }()

	handlers := map[string]http.HandlerFunc{"gateway": gateway, "orders": orders, "inventory": inventory}
	h, ok := handlers[role]
	if !ok {
		log.Fatalf("unknown role %q", role)
	}
	srv := &http.Server{Addr: ":8080", Handler: serverSpan(role, h), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()
	log.Printf("%s listening on :8080", role)
	<-ctx.Done()
	sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(sctx)
}

// dropFilter discards spans marked with dropAttr before export.
type dropFilter struct{ sdktrace.SpanProcessor }

func (d dropFilter) OnEnd(s sdktrace.ReadOnlySpan) {
	for _, a := range s.Attributes() {
		if a.Key == dropAttr {
			return
		}
	}
	d.SpanProcessor.OnEnd(s)
}

func setupTracing(ctx context.Context, service string) (func(context.Context) error, error) {
	exp, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpointURL(env("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://collector:4318/v1/traces")))
	if err != nil {
		return nil, err
	}
	res, err := sdkresource.New(ctx, sdkresource.WithAttributes(semconv.ServiceName(service), attribute.String("deployment.environment.name", "demo")))
	if err != nil {
		return nil, err
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithSpanProcessor(dropFilter{sdktrace.NewBatchSpanProcessor(exp, sdktrace.WithBatchTimeout(500*time.Millisecond))}),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	return tp.Shutdown, nil
}

func scenario(ctx context.Context) string {
	return baggage.FromContext(ctx).Member("demo.scenario").Value()
}

// serverSpan extracts W3C context and wraps the handler in a SERVER span.
func serverSpan(service string, next http.HandlerFunc) http.Handler {
	tracer := otel.Tracer("traceflow-demo/" + service)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := otel.GetTextMapPropagator().Extract(r.Context(), propagation.HeaderCarrier(r.Header))
		opts := []trace.SpanStartOption{trace.WithSpanKind(trace.SpanKindServer), trace.WithAttributes(
			semconv.HTTPRequestMethodKey.String(r.Method), semconv.URLPath(r.URL.Path))}
		if service == "gateway" && r.URL.Query().Get("scenario") == "missing-parent" {
			opts = append(opts, trace.WithAttributes(attribute.Bool(dropAttr, true)))
		}
		ctx, span := tracer.Start(ctx, r.Method+" "+r.URL.Path, opts...)
		defer span.End()
		w.Header().Set("X-Trace-Id", span.SpanContext().TraceID().String())
		rec := &statusRecorder{ResponseWriter: w, status: 200}
		next(rec, r.WithContext(ctx))
		span.SetAttributes(semconv.HTTPResponseStatusCode(rec.status))
		if rec.status >= 500 {
			span.SetStatus(codes.Error, http.StatusText(rec.status))
		}
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(c int) { s.status = c; s.ResponseWriter.WriteHeader(c) }

// call performs an HTTP GET inside a CLIENT span with context propagation.
func call(ctx context.Context, url string) (int, error) {
	ctx, span := otel.Tracer("traceflow-demo/client").Start(ctx, "GET", trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(semconv.URLFull(url)))
	defer span.End()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(req.Header))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "request failed")
		return 0, err
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
	span.SetAttributes(semconv.HTTPResponseStatusCode(resp.StatusCode))
	if resp.StatusCode >= 500 {
		span.SetStatus(codes.Error, http.StatusText(resp.StatusCode))
	}
	return resp.StatusCode, nil
}

func gateway(w http.ResponseWriter, r *http.Request) {
	sc := r.URL.Query().Get("scenario")
	if sc == "" {
		sc = "normal"
	}
	m, _ := baggage.NewMember("demo.scenario", sc)
	b, _ := baggage.New(m)
	ctx := baggage.ContextWithBaggage(r.Context(), b)
	code, err := call(ctx, env("ORDERS_URL", "http://orders:8080")+"/orders")
	if err != nil || code >= 500 {
		w.WriteHeader(http.StatusBadGateway)
		return
	}
	_, _ = fmt.Fprintln(w, "ok")
}

func orders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	inv := env("INVENTORY_URL", "http://inventory:8080") + "/stock"
	n := 1
	if scenario(ctx) == "parallel" {
		n = 2
	}
	var wg sync.WaitGroup
	codes := make([]int, n)
	for i := range n {
		wg.Add(1)
		go func(i int) { defer wg.Done(); codes[i], _ = call(ctx, inv) }(i)
	}
	wg.Wait()
	for _, c := range codes {
		if c != http.StatusOK {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
	}
	_, _ = fmt.Fprintln(w, "ok")
}

func inventory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	sc := scenario(ctx)
	_, db := otel.Tracer("traceflow-demo/inventory").Start(ctx, "SELECT stock", trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(attribute.String("db.system.name", "postgresql"), attribute.String("db.query.text", "SELECT qty FROM stock WHERE sku = $1")))
	delay := 20 * time.Millisecond
	if sc == "slow" {
		delay += 800 * time.Millisecond
	}
	time.Sleep(delay)
	db.End()
	if sc == "error" {
		span := trace.SpanFromContext(ctx)
		span.RecordError(errors.New("stock service: sku not found"))
		span.SetStatus(codes.Error, "sku not found")
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	_, _ = fmt.Fprintln(w, "ok")
}

// load triggers each scenario once and prints "scenario trace_id".
func load() error {
	base := env("GATEWAY_URL", "http://gateway:8080")
	var lines []string
	for _, sc := range scenarios {
		resp, err := http.Get(base + "/checkout?scenario=" + sc)
		if err != nil {
			return err
		}
		_ = resp.Body.Close()
		lines = append(lines, fmt.Sprintf("%s %s %d", sc, resp.Header.Get("X-Trace-Id"), resp.StatusCode))
	}
	fmt.Println(strings.Join(lines, "\n"))
	return nil
}
