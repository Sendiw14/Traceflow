// SPDX-License-Identifier: Apache-2.0

// Package normalize validates OTLP trace data and converts it to storage rows
// (docs/architecture/data-model.md). It never touches the database.
package normalize

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"math"
	"strconv"
	"strings"
	"unicode/utf8"

	collectortrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

// Limits from data-model.md "Invariants and edge-case policy".
const (
	MaxAttributes    = 128
	MaxKeyBytes      = 256
	MaxValueBytes    = 4 << 10
	MaxDepth         = 8
	MaxEvents        = 128
	MaxLinks         = 128
	MaxNameBytes     = 1 << 10
	MaxServiceName   = 256
	MaxTraceState    = 512
	MaxConflictBytes = 64 << 10
)

// Reject reason codes (API RejectReason).
const (
	ReasonInvalidID        = "invalid_id"
	ReasonInvalidTimestamp = "invalid_timestamp"
	ReasonInvalidSpan      = "invalid_span"
	ReasonConflict         = "conflicting_replay"
	ReasonTraceSpanLimit   = "trace_span_limit"
)

// Quality flag bits.
const (
	FlagNegativeDuration = 1 << 0
	FlagZeroDuration     = 1 << 1
	FlagTruncated        = 1 << 2
)

const redacted = "[REDACTED]"

type Resource struct {
	Hash        []byte
	SchemaURL   string
	ServiceName string
	Attributes  []byte // JSON
	Dropped     int
}

type Scope struct {
	Hash       []byte
	Name       string
	Version    string
	SchemaURL  string
	Attributes []byte // JSON
}

type Span struct {
	TraceID, SpanID, ParentSpanID []byte // ParentSpanID nil for roots
	TraceState                    string
	Flags                         uint32
	Name                          string
	Kind                          int16
	Start, End, Duration          int64
	StatusCode                    int16
	StatusMessage                 string
	Resource, Scope               int // indexes into Batch.Resources / Batch.Scopes
	ServiceName                   string
	Attributes, Events, Links     []byte // JSON
	DroppedAttributes             int
	DroppedEvents, DroppedLinks   int
	ContentHash                   []byte
	QualityFlags                  int
	Payload                       []byte // canonical span bytes, nil if > MaxConflictBytes
}

type Batch struct {
	Resources []Resource
	Scopes    []Scope
	Spans     []Span
	Received  int
	Rejected  map[string]int
	Redacted  int
}

// CountSpans returns the number of spans in a request without normalizing it.
func CountSpans(req *collectortrace.ExportTraceServiceRequest) int {
	n := 0
	for _, rs := range req.GetResourceSpans() {
		for _, ss := range rs.GetScopeSpans() {
			n += len(ss.GetSpans())
		}
	}
	return n
}

var det = proto.MarshalOptions{Deterministic: true}

func hashOf(parts ...[]byte) []byte {
	h := sha256.New()
	for _, p := range parts {
		var n [8]byte
		l := uint64(len(p))
		for i := range n {
			n[i] = byte(l >> (8 * i))
		}
		h.Write(n[:]) // length-prefix so concatenations cannot collide
		h.Write(p)
	}
	return h.Sum(nil)
}

// Sanitize makes s storable in PostgreSQL text/jsonb: valid UTF-8, no NUL.
func Sanitize(s string) string {
	s = strings.ToValidUTF8(s, "�")
	return strings.ReplaceAll(s, "\x00", "�")
}

// truncate cuts s to at most n bytes on a rune boundary.
func truncate(s string, n int) (string, bool) {
	if len(s) <= n {
		return s, false
	}
	for n > 0 && !utf8.RuneStart(s[n]) {
		n--
	}
	return s[:n], true
}

func nonZero(b []byte) bool {
	for _, c := range b {
		if c != 0 {
			return true
		}
	}
	return false
}

// Normalize converts a request. Invalid spans are counted in Rejected, never stored.
func Normalize(req *collectortrace.ExportTraceServiceRequest) *Batch {
	b := &Batch{Rejected: map[string]int{}}
	for _, rs := range req.GetResourceSpans() {
		res := rs.GetResource()
		resBytes, _ := det.Marshal(res)
		rAttrs, rDropped, _ := b.attributes(res.GetAttributes())
		svc := "unknown_service"
		for _, kv := range res.GetAttributes() {
			if kv.GetKey() == "service.name" {
				if s := kv.GetValue().GetStringValue(); s != "" {
					svc = s
				}
			}
		}
		svc, _ = truncate(Sanitize(svc), MaxServiceName)
		resSchema := Sanitize(rs.GetSchemaUrl())
		resHash := hashOf(resBytes, []byte(resSchema))
		b.Resources = append(b.Resources, Resource{
			Hash: resHash, SchemaURL: resSchema, ServiceName: svc,
			Attributes: rAttrs, Dropped: int(res.GetDroppedAttributesCount()) + rDropped,
		})
		ri := len(b.Resources) - 1

		for _, ss := range rs.GetScopeSpans() {
			sc := ss.GetScope()
			scBytes, _ := det.Marshal(sc)
			scSchema := Sanitize(ss.GetSchemaUrl())
			sAttrs, _, _ := b.attributes(sc.GetAttributes())
			name, _ := truncate(Sanitize(sc.GetName()), MaxNameBytes)
			ver, _ := truncate(Sanitize(sc.GetVersion()), MaxNameBytes)
			b.Scopes = append(b.Scopes, Scope{
				Hash: hashOf(scBytes, []byte(scSchema)), Name: name, Version: ver,
				SchemaURL: scSchema, Attributes: sAttrs,
			})
			si := len(b.Scopes) - 1

			for _, sp := range ss.GetSpans() {
				b.Received++
				out, reason := b.span(sp)
				if reason != "" {
					b.Rejected[reason]++
					continue
				}
				out.Resource, out.Scope, out.ServiceName = ri, si, svc
				raw, _ := det.Marshal(sp)
				out.ContentHash = hashOf(resHash, b.Scopes[si].Hash, raw)
				if len(raw) <= MaxConflictBytes {
					out.Payload = raw
				}
				b.Spans = append(b.Spans, out)
			}
		}
	}
	return b
}

func (b *Batch) span(sp *tracepb.Span) (Span, string) {
	var s Span
	if len(sp.GetTraceId()) != 16 || !nonZero(sp.GetTraceId()) || len(sp.GetSpanId()) != 8 || !nonZero(sp.GetSpanId()) {
		return s, ReasonInvalidID
	}
	switch p := sp.GetParentSpanId(); {
	case len(p) == 0:
	case len(p) == 8 && nonZero(p):
		s.ParentSpanID = p
	case len(p) == 8: // all-zero parent is treated as "no parent"
	default:
		return s, ReasonInvalidID
	}
	st, en := sp.GetStartTimeUnixNano(), sp.GetEndTimeUnixNano()
	if st == 0 || en == 0 || st > math.MaxInt64 || en > math.MaxInt64 {
		return s, ReasonInvalidTimestamp
	}
	if sp.GetKind() < 0 || sp.GetKind() > tracepb.Span_SPAN_KIND_CONSUMER {
		return s, ReasonInvalidSpan
	}
	code := sp.GetStatus().GetCode()
	if code < 0 || code > tracepb.Status_STATUS_CODE_ERROR {
		return s, ReasonInvalidSpan
	}
	name := Sanitize(sp.GetName())
	if name == "" {
		return s, ReasonInvalidSpan
	}

	s.TraceID, s.SpanID = sp.GetTraceId(), sp.GetSpanId()
	s.Start, s.End = int64(st), int64(en)
	s.Duration = s.End - s.Start
	switch {
	case s.Duration < 0:
		s.QualityFlags |= FlagNegativeDuration
	case s.Duration == 0:
		s.QualityFlags |= FlagZeroDuration
	}
	var trunc bool
	if s.Name, trunc = truncate(name, MaxNameBytes); trunc {
		s.QualityFlags |= FlagTruncated
	}
	s.TraceState, _ = truncate(Sanitize(sp.GetTraceState()), MaxTraceState)
	s.Flags = sp.GetFlags()
	s.Kind = int16(sp.GetKind())
	s.StatusCode = int16(code)
	s.StatusMessage, _ = truncate(Sanitize(sp.GetStatus().GetMessage()), MaxValueBytes)

	attrs, dropped, t := b.attributes(sp.GetAttributes())
	s.Attributes, s.DroppedAttributes = attrs, int(sp.GetDroppedAttributesCount())+dropped
	if t {
		s.QualityFlags |= FlagTruncated
	}

	events := sp.GetEvents()
	s.DroppedEvents = int(sp.GetDroppedEventsCount())
	if len(events) > MaxEvents {
		s.DroppedEvents += len(events) - MaxEvents
		events = events[:MaxEvents]
	}
	ev := make([]map[string]any, 0, len(events))
	for _, e := range events {
		a, d, _ := b.attributes(e.GetAttributes())
		n, _ := truncate(Sanitize(e.GetName()), MaxNameBytes)
		ev = append(ev, map[string]any{
			"time_unix_nano":           strconv.FormatUint(e.GetTimeUnixNano(), 10),
			"name":                     n,
			"attributes":               json.RawMessage(a),
			"dropped_attributes_count": int(e.GetDroppedAttributesCount()) + d,
		})
	}
	s.Events, _ = json.Marshal(ev)

	links := sp.GetLinks()
	s.DroppedLinks = int(sp.GetDroppedLinksCount())
	lk := make([]map[string]any, 0, len(links))
	for _, l := range links {
		if len(lk) == MaxLinks || len(l.GetTraceId()) != 16 || len(l.GetSpanId()) != 8 {
			s.DroppedLinks++
			continue
		}
		a, d, _ := b.attributes(l.GetAttributes())
		ts, _ := truncate(Sanitize(l.GetTraceState()), MaxTraceState)
		lk = append(lk, map[string]any{
			"trace_id":                 hex.EncodeToString(l.GetTraceId()),
			"span_id":                  hex.EncodeToString(l.GetSpanId()),
			"trace_state":              ts,
			"flags":                    l.GetFlags(),
			"attributes":               json.RawMessage(a),
			"dropped_attributes_count": int(l.GetDroppedAttributesCount()) + d,
		})
	}
	s.Links, _ = json.Marshal(lk)
	return s, ""
}

// attributes encodes key/values as [{"k","t","v"[,"tr"]}] applying limits and redaction.
// Returns JSON, number dropped, and whether anything was truncated.
func (b *Batch) attributes(kvs []*commonpb.KeyValue) ([]byte, int, bool) {
	out := make([]map[string]any, 0, min(len(kvs), MaxAttributes))
	dropped, anyTrunc := 0, false
	for _, kv := range kvs {
		key := Sanitize(kv.GetKey())
		if len(out) == MaxAttributes || len(key) > MaxKeyBytes {
			dropped++
			continue
		}
		var t, v any
		var trunc bool
		if sensitive(key) {
			t, v = "s", redacted
			b.Redacted++
		} else {
			t, v, trunc = encodeValue(kv.GetValue(), 1)
		}
		m := map[string]any{"k": key, "t": t}
		if v != nil {
			m["v"] = v
		}
		if trunc {
			m["tr"] = true
			anyTrunc = true
		}
		out = append(out, m)
	}
	js, _ := json.Marshal(out)
	return js, dropped, anyTrunc
}

func encodeValue(v *commonpb.AnyValue, depth int) (typ string, val any, trunc bool) {
	if depth > MaxDepth {
		return "e", nil, true
	}
	switch x := v.GetValue().(type) {
	case *commonpb.AnyValue_StringValue:
		s, t := truncate(Sanitize(x.StringValue), MaxValueBytes)
		return "s", s, t
	case *commonpb.AnyValue_BoolValue:
		return "b", x.BoolValue, false
	case *commonpb.AnyValue_IntValue:
		return "i", strconv.FormatInt(x.IntValue, 10), false // string: JS-safe int64
	case *commonpb.AnyValue_DoubleValue:
		f := x.DoubleValue
		if math.IsNaN(f) || math.IsInf(f, 0) {
			return "s", strconv.FormatFloat(f, 'g', -1, 64), false // JSON cannot carry NaN/Inf
		}
		return "d", f, false
	case *commonpb.AnyValue_BytesValue:
		bs := x.BytesValue
		t := false
		if len(bs) > MaxValueBytes {
			bs, t = bs[:MaxValueBytes], true
		}
		return "bytes", base64.StdEncoding.EncodeToString(bs), t
	case *commonpb.AnyValue_ArrayValue:
		vals := x.ArrayValue.GetValues()
		arr := make([]map[string]any, 0, min(len(vals), MaxAttributes))
		tr := len(vals) > MaxAttributes
		for i, e := range vals {
			if i == MaxAttributes {
				break
			}
			et, ev, t := encodeValue(e, depth+1)
			m := map[string]any{"t": et}
			if ev != nil {
				m["v"] = ev
			}
			tr = tr || t
			arr = append(arr, m)
		}
		return "a", arr, tr
	case *commonpb.AnyValue_KvlistValue:
		kvs := x.KvlistValue.GetValues()
		arr := make([]map[string]any, 0, min(len(kvs), MaxAttributes))
		tr := len(kvs) > MaxAttributes
		for i, kv := range kvs {
			if i == MaxAttributes {
				break
			}
			k, kt := truncate(Sanitize(kv.GetKey()), MaxKeyBytes)
			et, ev, t := encodeValue(kv.GetValue(), depth+1)
			m := map[string]any{"k": k, "t": et}
			if ev != nil {
				m["v"] = ev
			}
			tr = tr || t || kt
			arr = append(arr, m)
		}
		return "kv", arr, tr
	default:
		return "e", nil, false
	}
}

var denySubstrings = []string{"authorization", "cookie", "password", "passwd", "secret", "token", "api_key", "apikey", "api-key", "session"}

var headerAllow = map[string]bool{"content-type": true, "content-length": true, "user-agent": true, "accept": true}

// sensitive implements the Go-side denylist (docs/security/privacy.md layer 2).
func sensitive(key string) bool {
	k := strings.ToLower(key)
	for _, d := range denySubstrings {
		if strings.Contains(k, d) {
			return true
		}
	}
	if k == "http.request.body" || k == "http.response.body" {
		return true
	}
	for _, p := range []string{"http.request.header.", "http.response.header."} {
		if h, ok := strings.CutPrefix(k, p); ok {
			return !headerAllow[h]
		}
	}
	return false
}
