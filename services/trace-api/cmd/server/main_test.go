// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/config"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(context.Context) error { return f.err }

const token = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" // gitleaks:allow test fixture, not a secret

func do(t *testing.T, h http.Handler, method, path, auth string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestQueryHandler(t *testing.T) {
	cfg := config.Config{ServiceToken: token}
	up := newQueryHandler(cfg, fakeDB{}, nil)
	down := newQueryHandler(cfg, fakeDB{err: errors.New("refused")}, nil)

	cases := []struct {
		name        string
		h           http.Handler
		path, auth  string
		status      int
		contentType string
	}{
		{"livez", up, "/livez", "", 200, "application/json"},
		{"livez ignores db", down, "/livez", "", 200, "application/json"},
		{"readyz up", up, "/readyz", "", 200, "application/json"},
		{"readyz down", down, "/readyz", "", 503, "application/problem+json"},
		{"api no token", up, "/v1/overview", "", 401, "application/problem+json"},
		{"api wrong token", up, "/v1/overview", "Bearer nope", 401, "application/problem+json"},
		{"api basic scheme", up, "/v1/overview", "Basic " + token, 401, "application/problem+json"},
		{"api good token, not implemented", up, "/v1/overview", "Bearer " + token, 404, "application/problem+json"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := do(t, tc.h, http.MethodGet, tc.path, tc.auth)
			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d", rec.Code, tc.status)
			}
			if got := rec.Header().Get("Content-Type"); got != tc.contentType {
				t.Fatalf("Content-Type = %q, want %q", got, tc.contentType)
			}
			if got := rec.Header().Get("Cache-Control"); got != "private, no-store" {
				t.Fatalf("Cache-Control = %q", got)
			}
		})
	}
	if got := do(t, down, http.MethodGet, "/readyz", "").Header().Get("Retry-After"); got == "" {
		t.Fatal("readyz 503 missing Retry-After")
	}
}
