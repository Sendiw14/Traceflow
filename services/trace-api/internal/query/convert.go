// SPDX-License-Identifier: Apache-2.0

package query

import (
	"encoding/hex"
	"encoding/json"
	"strconv"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/api"
)

func ns(v int64) api.Nanos { return strconv.FormatInt(v, 10) }

func nsPtr(v *int64) *api.Nanos {
	if v == nil {
		return nil
	}
	s := ns(*v)
	return &s
}

func hexID(b []byte) string { return hex.EncodeToString(b) }

var kindNames = []api.SpanKind{api.SpanKindUnspecified, api.SpanKindInternal, api.SpanKindServer, api.SpanKindClient, api.SpanKindProducer, api.SpanKindConsumer}

func kindName(k int16) api.SpanKind {
	if k >= 0 && int(k) < len(kindNames) {
		return kindNames[k]
	}
	return api.SpanKindUnspecified
}

var statusNames = []api.StatusCode{api.StatusCodeUnset, api.StatusCodeOk, api.StatusCodeError}

func statusName(c int16) api.StatusCode {
	if c >= 0 && int(c) < len(statusNames) {
		return statusNames[c]
	}
	return api.StatusCodeUnset
}

// stored attribute encoding (normalize package): {"k","t","v","tr"}; nested array
// elements {"t","v"}; kvlist elements {"k","t","v"}.
type storedValue struct {
	K  string          `json:"k"`
	T  string          `json:"t"`
	V  json.RawMessage `json:"v"`
	Tr bool            `json:"tr"`
}

var typeNames = map[string]string{"s": "string", "b": "bool", "i": "int", "d": "double", "bytes": "bytes", "a": "array", "kv": "kvlist", "e": "empty"}

// anyValueJSON converts one stored value to the API AnyValue shape.
func anyValueJSON(t string, v json.RawMessage) map[string]any {
	name, ok := typeNames[t]
	if !ok {
		return map[string]any{"type": "empty"}
	}
	out := map[string]any{"type": name}
	switch t {
	case "e":
	case "a":
		var elems []storedValue
		_ = json.Unmarshal(v, &elems)
		arr := make([]any, len(elems))
		for i, e := range elems {
			arr[i] = anyValueJSON(e.T, e.V)
		}
		out["value"] = arr
	case "kv":
		var elems []storedValue
		_ = json.Unmarshal(v, &elems)
		arr := make([]any, len(elems))
		for i, e := range elems {
			arr[i] = map[string]any{"key": e.K, "value": anyValueJSON(e.T, e.V)}
		}
		out["value"] = arr
	default:
		out["value"] = v
	}
	return out
}

// attributes converts a stored attribute list to API attributes.
func attributes(raw []byte) []api.Attribute {
	var stored []storedValue
	if err := json.Unmarshal(raw, &stored); err != nil {
		return []api.Attribute{}
	}
	conv := make([]map[string]any, len(stored))
	for i, s := range stored {
		m := map[string]any{"key": s.K, "value": anyValueJSON(s.T, s.V)}
		if s.Tr {
			m["truncated"] = true
		}
		conv[i] = m
	}
	b, _ := json.Marshal(conv)
	out := []api.Attribute{}
	_ = json.Unmarshal(b, &out)
	return out
}

type storedEvent struct {
	Time       string          `json:"time_unix_nano"`
	Name       string          `json:"name"`
	Attributes json.RawMessage `json:"attributes"`
	Dropped    int             `json:"dropped_attributes_count"`
}

func events(raw []byte) []api.SpanEvent {
	var stored []storedEvent
	_ = json.Unmarshal(raw, &stored)
	out := make([]api.SpanEvent, len(stored))
	for i, e := range stored {
		d := e.Dropped
		out[i] = api.SpanEvent{TimeUnixNano: e.Time, Name: e.Name, Attributes: attributes(e.Attributes), DroppedAttributesCount: &d}
	}
	return out
}

type storedLink struct {
	TraceID    string          `json:"trace_id"`
	SpanID     string          `json:"span_id"`
	TraceState string          `json:"trace_state"`
	Attributes json.RawMessage `json:"attributes"`
}

func links(raw []byte) []api.SpanLink {
	var stored []storedLink
	_ = json.Unmarshal(raw, &stored)
	out := make([]api.SpanLink, len(stored))
	for i, l := range stored {
		ts := l.TraceState
		out[i] = api.SpanLink{TraceId: l.TraceID, SpanId: l.SpanID, TraceState: &ts, Attributes: attributes(l.Attributes)}
	}
	return out
}
