// SPDX-License-Identifier: Apache-2.0

// Command perf runs the spec §16.2 benchmark against a running trace-api:
//
//  1. peak ingest: -rate spans/s for -ingest-duration over OTLP/HTTP (10-span traces,
//     gateway→orders→inventory shape), counting every accepted/rejected span;
//  2. query load: -vus workers for -query-duration hitting trace list (random filters,
//     windows) and trace detail (random known IDs); reports p50/p95/p99 and errors.
//
// Deterministic with -seed. Prints a JSON report to stdout.
package main

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"os"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	collectortrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

var (
	ingestURL      = flag.String("ingest", "http://127.0.0.1:14318/v1/traces", "OTLP/HTTP traces endpoint")
	queryURL       = flag.String("query", "http://127.0.0.1:18080", "query API base URL")
	token          = flag.String("token", os.Getenv("TRACEFLOW_SERVICE_TOKEN"), "service token")
	rate           = flag.Int("rate", 500, "target spans per second during ingest")
	ingestDuration = flag.Duration("ingest-duration", 10*time.Minute, "peak ingest duration")
	queryDuration  = flag.Duration("query-duration", 5*time.Minute, "query load duration")
	warmup         = flag.Duration("warmup", 30*time.Second, "query warmup excluded from stats")
	vus            = flag.Int("vus", 10, "concurrent query workers")
	seed           = flag.Uint64("seed", 20261122, "PRNG seed")
	spread         = flag.Duration("spread", 0, "backdate trace starts uniformly over the past spread (e.g. 168h for 7-day windows); 0 = now")
	mix            = flag.String("mix", "list", "query mix: list (trace list + detail) or aggregates (overview, services, dependencies, series, histogram)")
)

const spansPerTrace = 10

type latencies struct {
	mu   sync.Mutex
	d    []time.Duration
	errs int
}

func (l *latencies) add(d time.Duration, ok bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if !ok {
		l.errs++
		return
	}
	l.d = append(l.d, d)
}

func (l *latencies) report() map[string]any {
	l.mu.Lock()
	defer l.mu.Unlock()
	sort.Slice(l.d, func(i, j int) bool { return l.d[i] < l.d[j] })
	pct := func(p float64) float64 {
		if len(l.d) == 0 {
			return 0
		}
		i := int(p*float64(len(l.d))+0.5) - 1
		return float64(l.d[min(max(i, 0), len(l.d)-1)].Microseconds()) / 1000
	}
	total := len(l.d) + l.errs
	errRate := 0.0
	if total > 0 {
		errRate = float64(l.errs) / float64(total)
	}
	return map[string]any{"requests": total, "errors": l.errs, "error_rate": errRate, "p50_ms": pct(0.50), "p95_ms": pct(0.95), "p99_ms": pct(0.99)}
}

func kv(k, v string) *commonpb.KeyValue {
	return &commonpb.KeyValue{Key: k, Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: v}}}
}

// trace builds one 10-span trace across 3 services; returns per-service span lists.
func trace(r *rand.Rand, n uint64, start int64) (map[string][]*tracepb.Span, []byte) {
	tid := make([]byte, 16)
	binary.BigEndian.PutUint64(tid, *seed)
	binary.BigEndian.PutUint64(tid[8:], n+1)
	sid := func(j int) []byte {
		b := make([]byte, 8)
		binary.BigEndian.PutUint64(b, (n+1)<<8|uint64(j+1))
		return b
	}
	svcs := []string{"gateway", "gateway", "orders", "orders", "inventory", "inventory", "inventory", "orders", "inventory", "inventory"}
	kinds := []tracepb.Span_SpanKind{2, 3, 2, 3, 2, 3, 1, 3, 2, 3}
	parents := []int{-1, 0, 1, 2, 3, 4, 4, 2, 7, 8}
	names := []string{"GET /checkout", "GET", "GET /orders", "GET", "GET /stock", "SELECT stock", "reserve", "GET", "GET /stock", "SELECT stock"}
	dur := int64(r.IntN(200_000_000)) + 2_000_000
	isErr := r.IntN(20) == 0
	out := map[string][]*tracepb.Span{}
	for j := 0; j < spansPerTrace; j++ {
		s := &tracepb.Span{TraceId: tid, SpanId: sid(j), Name: names[j], Kind: kinds[j],
			StartTimeUnixNano: uint64(start + int64(j)*500_000), EndTimeUnixNano: uint64(start + dur - int64(j)*400_000),
			Attributes: []*commonpb.KeyValue{kv("http.route", names[j]), kv("deployment.environment.name", "perf")}}
		if parents[j] >= 0 {
			s.ParentSpanId = sid(parents[j])
		}
		if isErr && j >= 4 {
			s.Status = &tracepb.Status{Code: tracepb.Status_STATUS_CODE_ERROR}
		}
		out[svcs[j]] = append(out[svcs[j]], s)
	}
	return out, tid
}

func main() {
	flag.Parse()
	r := rand.New(rand.NewPCG(*seed, 1))
	client := &http.Client{Timeout: 30 * time.Second}
	report := map[string]any{"seed": *seed, "rate_target_spans_per_s": *rate, "ingest_duration": ingestDuration.String(),
		"query_duration": queryDuration.String(), "warmup": warmup.String(), "vus": *vus}

	// ---- peak ingest: one request per tick, each carrying `perReq` traces.
	const tracesPerReq = 5 // 50 spans/request
	interval := time.Duration(float64(time.Second) * float64(tracesPerReq*spansPerTrace) / float64(*rate))
	var accepted, rejected, sent, failedReqs, retryable atomic.Int64
	var ids [][]byte
	ingestLat := &latencies{}
	begin := time.Now()
	tick := time.NewTicker(interval)
	var wg sync.WaitGroup
	sem := make(chan struct{}, 16)
	var n uint64
	for time.Since(begin) < *ingestDuration {
		<-tick.C
		bySvc := map[string][]*tracepb.Span{}
		for k := 0; k < tracesPerReq; k++ {
			start := time.Now().UnixNano()
			if *spread > 0 {
				start -= r.Int64N(int64(*spread))
			}
			spans, tid := trace(r, n, start)
			n++
			ids = append(ids, tid)
			for svc, ss := range spans {
				bySvc[svc] = append(bySvc[svc], ss...)
			}
		}
		req := &collectortrace.ExportTraceServiceRequest{}
		for _, svc := range []string{"gateway", "orders", "inventory"} {
			req.ResourceSpans = append(req.ResourceSpans, &tracepb.ResourceSpans{
				Resource:   &resourcepb.Resource{Attributes: []*commonpb.KeyValue{kv("service.name", svc)}},
				ScopeSpans: []*tracepb.ScopeSpans{{Scope: &commonpb.InstrumentationScope{Name: "perf"}, Spans: bySvc[svc]}},
			})
		}
		body, _ := proto.Marshal(req)
		sent.Add(int64(tracesPerReq * spansPerTrace))
		sem <- struct{}{}
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			t0 := time.Now()
			resp, err := client.Post(*ingestURL, "application/x-protobuf", bytes.NewReader(body))
			if err != nil {
				failedReqs.Add(1)
				ingestLat.add(0, false)
				return
			}
			b, _ := io.ReadAll(resp.Body)
			_ = resp.Body.Close()
			if resp.StatusCode != 200 {
				failedReqs.Add(1)
				if resp.StatusCode == 429 || resp.StatusCode >= 502 {
					retryable.Add(1)
				}
				ingestLat.add(0, false)
				return
			}
			var out collectortrace.ExportTraceServiceResponse
			_ = proto.Unmarshal(b, &out)
			rej := out.GetPartialSuccess().GetRejectedSpans()
			rejected.Add(rej)
			accepted.Add(int64(tracesPerReq*spansPerTrace) - rej)
			ingestLat.add(time.Since(t0), true)
		}()
	}
	tick.Stop()
	wg.Wait()
	elapsed := time.Since(begin)
	report["ingest"] = map[string]any{
		"elapsed_s": elapsed.Seconds(), "spans_sent": sent.Load(), "spans_accepted": accepted.Load(), "spans_rejected": rejected.Load(),
		"failed_requests": failedReqs.Load(), "retryable_failures": retryable.Load(),
		"achieved_spans_per_s": float64(accepted.Load()) / elapsed.Seconds(), "request_latency": ingestLat.report(),
		"all_sent_spans_accounted": sent.Load() == accepted.Load()+rejected.Load(),
	}

	// ---- query load
	end := time.Now()
	windowStart := begin.Add(-time.Minute - *spread).UnixNano()
	windowEnd := end.Add(time.Minute).UnixNano()
	listLat, detailLat := &latencies{}, &latencies{}
	aggNames := []string{"overview", "services", "dependencies", "server_latency", "latency_distribution"}
	aggWindows := []time.Duration{time.Hour, 24 * time.Hour, 7 * 24 * time.Hour}
	agg := map[string]*latencies{}
	for _, a := range aggNames {
		for _, w := range aggWindows {
			agg[a+"_"+w.String()] = &latencies{}
		}
	}
	qBegin := time.Now()
	var qwg sync.WaitGroup
	for v := 0; v < *vus; v++ {
		qwg.Add(1)
		go func(v int) {
			defer qwg.Done()
			rr := rand.New(rand.NewPCG(*seed, uint64(v)+100))
			get := func(path string) (bool, time.Duration) {
				req, _ := http.NewRequest("GET", *queryURL+path, nil)
				req.Header.Set("Authorization", "Bearer "+*token)
				t0 := time.Now()
				resp, err := client.Do(req)
				d := time.Since(t0)
				if err != nil {
					return false, d
				}
				_, _ = io.Copy(io.Discard, resp.Body)
				_ = resp.Body.Close()
				return resp.StatusCode == 200, d
			}
			for time.Since(qBegin) < *warmup+*queryDuration {
				measured := time.Since(qBegin) >= *warmup
				if *mix == "aggregates" {
					a := aggNames[rr.IntN(len(aggNames))]
					w := aggWindows[rr.IntN(len(aggWindows))]
					to := windowEnd
					from := to - int64(w)
					q := "from=" + strconv.FormatInt(from, 10) + "&to=" + strconv.FormatInt(to, 10)
					path := map[string]string{
						"overview": "/v1/overview?" + q, "services": "/v1/services?" + q, "dependencies": "/v1/dependencies?" + q,
						"server_latency": "/v1/analytics/server-latency?bucket_seconds=3600&" + q, "latency_distribution": "/v1/analytics/latency-distribution?" + q,
					}[a]
					ok, d := get(path)
					if measured {
						agg[a+"_"+w.String()].add(d, ok)
					}
					continue
				}
				if rr.IntN(2) == 0 {
					// random sub-window of the ingested range, random filter mix
					span := windowEnd - windowStart
					from := windowStart + rr.Int64N(span/2)
					to := from + span/4 + rr.Int64N(span/4)
					q := "from=" + strconv.FormatInt(from, 10) + "&to=" + strconv.FormatInt(to, 10) + "&limit=50"
					switch rr.IntN(4) {
					case 1:
						q += "&service=inventory"
					case 2:
						q += "&status=error"
					case 3:
						q += "&min_duration_nano=100000000"
					}
					ok, d := get("/v1/traces?" + q)
					if measured {
						listLat.add(d, ok)
					}
				} else {
					id := hex.EncodeToString(ids[rr.IntN(len(ids))])
					ok, d := get("/v1/traces/" + id)
					if measured {
						detailLat.add(d, ok)
					}
				}
			}
		}(v)
	}
	qwg.Wait()
	if *mix == "aggregates" {
		out := map[string]any{}
		for k, l := range agg {
			out[k] = l.report()
		}
		report["query"] = out
	} else {
		report["query"] = map[string]any{"trace_list": listLat.report(), "trace_detail": detailLat.report()}
	}
	report["mix"] = *mix
	report["spread"] = spread.String()
	report["dataset"] = map[string]any{"traces": len(ids), "spans": len(ids) * spansPerTrace}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(report); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
