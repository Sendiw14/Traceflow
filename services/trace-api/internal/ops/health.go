// SPDX-License-Identifier: Apache-2.0

// Package ops serves liveness/readiness probes.
package ops

import (
	"context"
	"net/http"
	"time"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/problem"
)

// Pinger is satisfied by *pgxpool.Pool.
type Pinger interface {
	Ping(ctx context.Context) error
}

const readyTimeout = 2 * time.Second

func writeOK(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "private, no-store")
	_, _ = w.Write([]byte(`{"status":"ok"}` + "\n"))
}

// Liveness reports the process is serving; it never touches dependencies.
func Liveness() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { writeOK(w) })
}

// Readiness reports 200 only when the database answers within readyTimeout.
func Readiness(db Pinger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), readyTimeout)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			w.Header().Set("Retry-After", "5")
			problem.Write(w, http.StatusServiceUnavailable, "storage_unavailable", "Database is not reachable.")
			return
		}
		writeOK(w)
	})
}
