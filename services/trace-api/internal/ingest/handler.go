// SPDX-License-Identifier: Apache-2.0

// Package ingest implements the OTLP/HTTP binary Protobuf trace receiver
// (POST /v1/traces) per ADR-0003 and docs/testing/fixtures.md.
package ingest

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"sort"
	"strings"
	"time"

	collectortrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/genproto/googleapis/rpc/code"
	rpcstatus "google.golang.org/genproto/googleapis/rpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/normalize"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/store"
)

const protobufType = "application/x-protobuf"

type Limits struct {
	MaxCompressedBytes int64
	MaxRawBytes        int64
	MaxSpansPerRequest int
	MaxConcurrent      int
	StoreTimeout       time.Duration
}

// DefaultLimits are ADR-0003 starting values; tune from M4 measurements.
var DefaultLimits = Limits{
	MaxCompressedBytes: 4 << 20,
	MaxRawBytes:        16 << 20,
	MaxSpansPerRequest: 10000,
	MaxConcurrent:      16,
	StoreTimeout:       10 * time.Second,
}

type Ingester interface {
	Ingest(ctx context.Context, b *normalize.Batch, m store.Meta) (store.Result, error)
	RecordFailure(ctx context.Context, m store.Meta, status, received int, reason string)
}

type Handler struct {
	ing Ingester
	lim Limits
	sem chan struct{}
	log *slog.Logger
}

func NewHandler(ing Ingester, lim Limits, log *slog.Logger) *Handler {
	return &Handler{ing: ing, lim: lim, sem: make(chan struct{}, lim.MaxConcurrent), log: log}
}

func writeStatus(w http.ResponseWriter, httpStatus int, c code.Code, msg string) {
	body, _ := proto.Marshal(&rpcstatus.Status{Code: int32(c), Message: msg})
	w.Header().Set("Content-Type", protobufType)
	w.WriteHeader(httpStatus)
	_, _ = w.Write(body)
}

func source(r *http.Request) string {
	if strings.HasPrefix(r.UserAgent(), "OpenTelemetry Collector") {
		return "collector"
	}
	return "direct"
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeStatus(w, http.StatusMethodNotAllowed, code.Code_UNIMPLEMENTED, "only POST is supported")
		return
	}
	if mt, _, err := mime.ParseMediaType(r.Header.Get("Content-Type")); err != nil || mt != protobufType {
		writeStatus(w, http.StatusUnsupportedMediaType, code.Code_INVALID_ARGUMENT, "Content-Type must be application/x-protobuf")
		return
	}
	enc := strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Encoding")))
	if enc != "" && enc != "identity" && enc != "gzip" {
		writeStatus(w, http.StatusUnsupportedMediaType, code.Code_INVALID_ARGUMENT, "Content-Encoding must be gzip or identity")
		return
	}
	if r.ContentLength > h.lim.MaxCompressedBytes {
		writeStatus(w, http.StatusRequestEntityTooLarge, code.Code_INVALID_ARGUMENT, "request body too large")
		return
	}

	// Bound concurrent work (and memory) before reading the body.
	select {
	case h.sem <- struct{}{}:
		defer func() { <-h.sem }()
	default:
		w.Header().Set("Retry-After", "1")
		writeStatus(w, http.StatusTooManyRequests, code.Code_RESOURCE_EXHAUSTED, "receiver busy, retry later")
		return
	}

	compressed, err := io.ReadAll(http.MaxBytesReader(w, r.Body, h.lim.MaxCompressedBytes))
	if err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			writeStatus(w, http.StatusRequestEntityTooLarge, code.Code_INVALID_ARGUMENT, "request body too large")
			return
		}
		writeStatus(w, http.StatusBadRequest, code.Code_INVALID_ARGUMENT, "could not read request body")
		return
	}
	raw := compressed
	if enc == "gzip" {
		zr, err := gzip.NewReader(bytes.NewReader(compressed))
		if err != nil {
			writeStatus(w, http.StatusBadRequest, code.Code_INVALID_ARGUMENT, "invalid gzip body")
			return
		}
		raw, err = io.ReadAll(io.LimitReader(zr, h.lim.MaxRawBytes+1))
		if err != nil {
			writeStatus(w, http.StatusBadRequest, code.Code_INVALID_ARGUMENT, "invalid gzip body")
			return
		}
	}
	if int64(len(raw)) > h.lim.MaxRawBytes {
		writeStatus(w, http.StatusRequestEntityTooLarge, code.Code_INVALID_ARGUMENT, "decompressed body too large")
		return
	}
	meta := store.Meta{Source: source(r), BytesCompressed: len(compressed), BytesRaw: len(raw)}

	var req collectortrace.ExportTraceServiceRequest
	if err := proto.Unmarshal(raw, &req); err != nil {
		h.ing.RecordFailure(r.Context(), meta, http.StatusBadRequest, 0, "invalid_protobuf")
		writeStatus(w, http.StatusBadRequest, code.Code_INVALID_ARGUMENT, "body is not a valid ExportTraceServiceRequest")
		return
	}
	if n := normalize.CountSpans(&req); n > h.lim.MaxSpansPerRequest {
		h.ing.RecordFailure(r.Context(), meta, http.StatusRequestEntityTooLarge, n, "too_many_spans")
		writeStatus(w, http.StatusRequestEntityTooLarge, code.Code_INVALID_ARGUMENT,
			fmt.Sprintf("request has %d spans; limit is %d", n, h.lim.MaxSpansPerRequest))
		return
	}

	batch := normalize.Normalize(&req)
	ctx, cancel := context.WithTimeout(r.Context(), h.lim.StoreTimeout)
	defer cancel()
	res, err := h.ing.Ingest(ctx, batch, meta)
	if err != nil {
		// Never acknowledge uncommitted data (ADR-0003). 503 is retryable per OTLP.
		h.log.Warn("ingest storage failure", "err", err.Error(), "spans", batch.Received)
		w.Header().Set("Retry-After", "5")
		writeStatus(w, http.StatusServiceUnavailable, code.Code_UNAVAILABLE, "storage unavailable, retry later")
		return
	}

	resp := &collectortrace.ExportTraceServiceResponse{}
	if n := res.RejectedTotal(); n > 0 {
		resp.PartialSuccess = &collectortrace.ExportTracePartialSuccess{RejectedSpans: int64(n), ErrorMessage: summarize(res.Rejected)}
	}
	body, _ := proto.Marshal(resp)
	w.Header().Set("Content-Type", protobufType)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

// summarize renders reject counts deterministically, e.g. "rejected spans: invalid_id=2, conflicting_replay=1".
func summarize(m map[string]int) string {
	keys := make([]string, 0, len(m))
	for k, v := range m {
		if v > 0 {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	parts := make([]string, len(keys))
	for i, k := range keys {
		parts[i] = fmt.Sprintf("%s=%d", k, m[k])
	}
	return "rejected spans: " + strings.Join(parts, ", ")
}
