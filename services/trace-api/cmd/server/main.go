// SPDX-License-Identifier: Apache-2.0

// Command server runs trace-api. M2: query listener with health probes only;
// ingest (M3) and query endpoints (M4) are not implemented yet.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/authz"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/config"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/ops"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/problem"
)

func main() {
	// `trace-api healthcheck` lets Compose probe liveness in a distroless image (no curl).
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(healthcheck())
	}
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("trace-api exited", "err", err)
		os.Exit(1)
	}
}

// newQueryHandler wires the query listener. Health probes are unauthenticated;
// everything else requires the service token.
func newQueryHandler(cfg config.Config, db ops.Pinger) http.Handler {
	api := http.NewServeMux()
	api.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		problem.Write(w, http.StatusNotFound, "not_found", "No such endpoint.")
	})
	mux := http.NewServeMux()
	mux.Handle("GET /livez", ops.Liveness())
	mux.Handle("GET /readyz", ops.Readiness(db))
	mux.Handle("/", authz.RequireServiceToken(cfg.ServiceToken, api))
	return mux
}

func healthcheck() int {
	addr := os.Getenv("TRACEFLOW_QUERY_ADDR")
	if addr == "" || addr[0] == ':' {
		addr = "127.0.0.1" + addr
		if addr == "127.0.0.1" {
			addr += ":8080"
		}
	}
	c := http.Client{Timeout: 2 * time.Second}
	resp, err := c.Get("http://" + addr + "/livez")
	if err != nil {
		return 1
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

func run(log *slog.Logger) error {
	cfg, err := config.FromEnv()
	if err != nil {
		return err
	}
	log.Info("starting trace-api", "config", cfg.Redacted())

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return errors.New("invalid TRACEFLOW_DATABASE_URL") // pgx error may echo the URL; keep secrets out of logs
	}
	defer pool.Close()

	srv := &http.Server{
		Addr:              cfg.QueryAddr,
		Handler:           newQueryHandler(cfg, pool),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	log.Info("query listener up", "addr", cfg.QueryAddr)

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
