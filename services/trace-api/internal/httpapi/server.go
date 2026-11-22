// SPDX-License-Identifier: Apache-2.0

// Package httpapi serves the query API defined in api/openapi.yaml 1.0.0.
package httpapi

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/api"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/query"
)

const (
	MaxWindow      = 7 * 24 * time.Hour
	requestTimeout = 10 * time.Second
)

type Server struct {
	q        *query.Store
	log      *slog.Logger
	profile  string
	readOnly bool // public-demo: no ingestion status, no settings
	limits   query.Limits
}

func New(q *query.Store, log *slog.Logger, profile string, limits query.Limits) *Server {
	return &Server{q: q, log: log, profile: profile, readOnly: profile == "public-demo", limits: limits}
}

// Routes registers all query endpoints on mux (auth is applied by the caller).
func (s *Server) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/overview", s.overview)
	mux.HandleFunc("GET /v1/traces", s.listTraces)
	mux.HandleFunc("GET /v1/traces/{traceId}", s.getTrace)
	mux.HandleFunc("GET /v1/traces/{traceId}/spans/{spanId}", s.getSpan)
	mux.HandleFunc("GET /v1/services", s.listServices)
	mux.HandleFunc("GET /v1/services/{serviceName}", s.getService)
	mux.HandleFunc("GET /v1/dependencies", s.dependencies)
	mux.HandleFunc("GET /v1/analytics/server-latency", s.serverLatency)
	mux.HandleFunc("GET /v1/analytics/latency-distribution", s.latencyDistribution)
	if !s.readOnly {
		mux.HandleFunc("GET /v1/ingestion/status", s.ingestionStatus)
		mux.HandleFunc("GET /v1/settings", s.getSettings)
		mux.HandleFunc("PATCH /v1/settings", s.updateSettings)
	}
}

// ------------------------------------------------------------ responses

type fieldErr struct {
	Code    api.ProblemErrorsCode `json:"code"`
	Field   string                `json:"field"`
	Message string                `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "private, no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func problem(w http.ResponseWriter, status int, code api.ProblemCode, detail string, errs ...fieldErr) {
	p := map[string]any{"type": "about:blank", "title": http.StatusText(status), "status": status, "code": code, "detail": detail}
	if len(errs) > 0 {
		p["errors"] = errs
	}
	if status == http.StatusServiceUnavailable {
		w.Header().Set("Retry-After", "5")
	}
	w.Header().Set("Content-Type", "application/problem+json")
	w.Header().Set("Cache-Control", "private, no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(p)
}

func (s *Server) fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, query.ErrNotFound):
		problem(w, 404, api.ProblemCodeNotFound, "Not found.")
	case errors.Is(err, query.ErrCursorInvalid):
		problem(w, 400, api.ProblemCodeCursorInvalid, "Cursor is malformed.", fieldErr{"invalid_format", "cursor", "malformed cursor"})
	case errors.Is(err, query.ErrCursorMismatch):
		problem(w, 400, api.ProblemCodeCursorFilterMismatch, "Cursor was issued for different filters.", fieldErr{"not_allowed", "cursor", "filters changed"})
	case errors.Is(err, query.ErrTooManyPoints):
		problem(w, 400, api.ProblemCodeWindowTooLarge, "Window and bucket produce more than 2000 points.", fieldErr{"out_of_range", "bucket_seconds", "use a larger bucket"})
	case errors.Is(err, context.DeadlineExceeded):
		problem(w, 503, api.ProblemCodeQueryTimeout, "Query timed out.")
	default:
		s.log.Warn("query failed", "err", err.Error())
		problem(w, 503, api.ProblemCodeStorageUnavailable, "Storage unavailable.")
	}
}

// ------------------------------------------------------------ params

type params struct {
	r    *http.Request
	errs []fieldErr
}

var (
	nanosRe = regexp.MustCompile(`^[0-9]{1,19}$`)
	traceRe = regexp.MustCompile(`^[0-9a-f]{32}$`)
	spanRe  = regexp.MustCompile(`^[0-9a-f]{16}$`)
)

func (p *params) bad(field string, code api.ProblemErrorsCode, msg string) {
	p.errs = append(p.errs, fieldErr{code, field, msg})
}

func (p *params) nanos(name string, required bool) (int64, bool) {
	v := p.r.URL.Query().Get(name)
	if v == "" {
		if required {
			p.bad(name, "required", name+" is required")
		}
		return 0, false
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if !nanosRe.MatchString(v) || err != nil {
		p.bad(name, "invalid_format", name+" must be Unix nanoseconds as a decimal string")
		return 0, false
	}
	return n, true
}

func (p *params) str(name string, max int) string {
	v := p.r.URL.Query().Get(name)
	if len(v) > max {
		p.bad(name, "out_of_range", name+" too long")
		return ""
	}
	return v
}

// window validates from/to; returns false (with a response written) on error.
func (s *Server) window(w http.ResponseWriter, p *params) (query.Window, bool) {
	from, okF := p.nanos("from", true)
	to, okT := p.nanos("to", true)
	if okF && okT && from >= to {
		p.bad("to", "out_of_range", "to must be greater than from")
	}
	if len(p.errs) > 0 {
		problem(w, 400, api.ProblemCodeInvalidParameter, "Invalid parameters.", p.errs...)
		return query.Window{}, false
	}
	if time.Duration(to-from) > MaxWindow {
		problem(w, 400, api.ProblemCodeWindowTooLarge, "Window exceeds 7 days.", fieldErr{"out_of_range", "to", "window must be at most 7 days"})
		return query.Window{}, false
	}
	return query.Window{From: from, To: to}, true
}

func (s *Server) ctx(r *http.Request) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), requestTimeout)
}

func pathID(r *http.Request, name string, re *regexp.Regexp) ([]byte, bool) {
	v := r.PathValue(name)
	if !re.MatchString(v) {
		return nil, false
	}
	b, err := hex.DecodeString(v)
	return b, err == nil
}

// ------------------------------------------------------------ handlers

func (s *Server) overview(w http.ResponseWriter, r *http.Request) {
	p := &params{r: r}
	svc := p.str("service", 256)
	win, ok := s.window(w, p)
	if !ok {
		return
	}
	ctx, cancel := s.ctx(r)
	defer cancel()
	out, err := s.q.Overview(ctx, win, svc)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) listTraces(w http.ResponseWriter, r *http.Request) {
	p := &params{r: r}
	f := query.TraceFilter{Service: p.str("service", 256), Status: r.URL.Query().Get("status"), Limit: 50, Cursor: p.str("cursor", 512)}
	switch f.Status {
	case "":
		f.Status = "any"
	case "any", "error", "ok_or_unset":
	default:
		p.bad("status", "invalid_format", "status must be any, error or ok_or_unset")
	}
	if md, ok := p.nanos("min_duration_nano", false); ok {
		f.MinDuration = &md
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 200 {
			p.bad("limit", "out_of_range", "limit must be 1..200")
		} else {
			f.Limit = n
		}
	}
	win, ok := s.window(w, p)
	if !ok {
		return
	}
	ctx, cancel := s.ctx(r)
	defer cancel()
	out, err := s.q.ListTraces(ctx, win, f)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) getTrace(w http.ResponseWriter, r *http.Request) {
	tid, ok := pathID(r, "traceId", traceRe)
	if !ok {
		problem(w, 400, api.ProblemCodeInvalidParameter, "Invalid trace ID.", fieldErr{"invalid_format", "traceId", "32 lowercase hex chars"})
		return
	}
	detail := r.URL.Query().Get("detail")
	if detail != "" && detail != "full" && detail != "lite" {
		problem(w, 400, api.ProblemCodeInvalidParameter, "Invalid parameters.", fieldErr{"invalid_format", "detail", "detail must be full or lite"})
		return
	}
	ctx, cancel := s.ctx(r)
	defer cancel()
	out, err := s.q.GetTrace(ctx, tid, detail != "lite")
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) getSpan(w http.ResponseWriter, r *http.Request) {
	tid, okT := pathID(r, "traceId", traceRe)
	sid, okS := pathID(r, "spanId", spanRe)
	if !okT || !okS {
		problem(w, 400, api.ProblemCodeInvalidParameter, "Invalid trace or span ID.")
		return
	}
	ctx, cancel := s.ctx(r)
	defer cancel()
	out, err := s.q.GetSpan(ctx, tid, sid)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) listServices(w http.ResponseWriter, r *http.Request) {
	win, ok := s.window(w, &params{r: r})
	if !ok {
		return
	}
	ctx, cancel := s.ctx(r)
	defer cancel()
	svcs, err := s.q.ListServices(ctx, win)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"window": win.API(), "freshness": s.q.Freshness(ctx), "services": svcs})
}

func (s *Server) getService(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("serviceName")
	if name == "" || len(name) > 256 {
		problem(w, 400, api.ProblemCodeInvalidParameter, "Invalid service name.", fieldErr{"out_of_range", "serviceName", "1..256 bytes"})
		return
	}
	win, ok := s.window(w, &params{r: r})
	if !ok {
		return
	}
	ctx, cancel := s.ctx(r)
	defer cancel()
	out, err := s.q.GetService(ctx, win, name)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) dependencies(w http.ResponseWriter, r *http.Request) {
	win, ok := s.window(w, &params{r: r})
	if !ok {
		return
	}
	ctx, cancel := s.ctx(r)
	defer cancel()
	out, err := s.q.Dependencies(ctx, win)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, out)
}

var bucketSizes = map[string]int{"": 300, "60": 60, "300": 300, "900": 900, "3600": 3600}

func (s *Server) serverLatency(w http.ResponseWriter, r *http.Request) {
	p := &params{r: r}
	svc, op := p.str("service", 256), p.str("operation", 512)
	bucket, okB := bucketSizes[r.URL.Query().Get("bucket_seconds")]
	if !okB {
		p.bad("bucket_seconds", "invalid_format", "bucket_seconds must be 60, 300, 900 or 3600")
	}
	win, ok := s.window(w, p)
	if !ok {
		return
	}
	ctx, cancel := s.ctx(r)
	defer cancel()
	out, err := s.q.ServerLatency(ctx, win, svc, op, bucket)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) latencyDistribution(w http.ResponseWriter, r *http.Request) {
	p := &params{r: r}
	svc, op := p.str("service", 256), p.str("operation", 512)
	win, ok := s.window(w, p)
	if !ok {
		return
	}
	ctx, cancel := s.ctx(r)
	defer cancel()
	out, err := s.q.LatencyDistribution(ctx, win, svc, op)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) ingestionStatus(w http.ResponseWriter, r *http.Request) {
	win, ok := s.window(w, &params{r: r})
	if !ok {
		return
	}
	ctx, cancel := s.ctx(r)
	defer cancel()
	out, err := s.q.IngestionStatus(ctx, win)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) getSettings(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := s.ctx(r)
	defer cancel()
	out, err := s.q.Settings(ctx, s.profile, s.readOnly, s.limits)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, out)
}

var actorRe = regexp.MustCompile(`^[0-9]{1,20}$`)

func (s *Server) updateSettings(w http.ResponseWriter, r *http.Request) {
	actor := r.Header.Get("X-Traceflow-Actor")
	if !actorRe.MatchString(actor) {
		problem(w, 400, api.ProblemCodeInvalidParameter, "Invalid actor.", fieldErr{"invalid_format", "X-Traceflow-Actor", "numeric GitHub ID required"})
		return
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10))
	dec.DisallowUnknownFields()
	var patch api.SettingsPatch
	if err := dec.Decode(&patch); err != nil {
		problem(w, 400, api.ProblemCodeInvalidParameter, "Body must be a JSON object with known fields only.", fieldErr{"not_allowed", "/", "unknown or malformed field"})
		return
	}
	if patch.RetentionDays == nil {
		problem(w, 400, api.ProblemCodeInvalidParameter, "At least one field is required.", fieldErr{"required", "/retention_days", "retention_days is required"})
		return
	}
	if d := *patch.RetentionDays; d < 1 || d > 90 {
		problem(w, 400, api.ProblemCodeInvalidParameter, "Invalid retention.", fieldErr{"out_of_range", "/retention_days", "retention_days must be 1..90"})
		return
	}
	ctx, cancel := s.ctx(r)
	defer cancel()
	if err := s.q.UpdateRetention(ctx, *patch.RetentionDays, actor); err != nil {
		s.fail(w, err)
		return
	}
	out, err := s.q.Settings(ctx, s.profile, s.readOnly, s.limits)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, out)
}
