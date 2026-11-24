// SPDX-License-Identifier: Apache-2.0

// Command server runs trace-api: OTLP/HTTP ingest listener (M3) and the query
// listener (api/openapi.yaml 1.0.0 behind the service token).
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

	"github.com/Sendiw14/Traceflow/services/trace-api/db"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/authz"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/config"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/httpapi"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/ingest"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/ops"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/problem"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/query"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/store"
)

func main() {
	// `trace-api healthcheck` lets Compose probe liveness in a distroless image (no curl).
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(healthcheck())
	}
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	// `trace-api migrate`: one-shot job run with admin credentials before the runtime starts.
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		if err := migrate(log); err != nil {
			log.Error("migrate failed", "err", err)
			os.Exit(1)
		}
		return
	}
	if err := run(log); err != nil {
		log.Error("trace-api exited", "err", err)
		os.Exit(1)
	}
}

// newQueryHandler wires the query listener. Health probes are unauthenticated;
// everything else requires the service token.
func newQueryHandler(cfg config.Config, db ops.Pinger, routes func(*http.ServeMux)) http.Handler {
	api := http.NewServeMux()
	api.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		problem.Write(w, http.StatusNotFound, "not_found", "No such endpoint.")
	})
	if routes != nil {
		routes(api)
	}
	mux := http.NewServeMux()
	mux.Handle("GET /livez", ops.Liveness())
	mux.Handle("GET /readyz", ops.Readiness(db))
	mux.Handle("/", authz.RequireServiceToken(cfg.ServiceToken, api))
	return mux
}

func migrate(log *slog.Logger) error {
	url := os.Getenv("TRACEFLOW_MIGRATE_DATABASE_URL")
	if url == "" {
		return errors.New("TRACEFLOW_MIGRATE_DATABASE_URL is required")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return errors.New("invalid TRACEFLOW_MIGRATE_DATABASE_URL")
	}
	defer pool.Close()
	if err := db.Migrate(pool); err != nil {
		return err
	}
	pw := db.RolePasswords{App: os.Getenv("TRACEFLOW_APP_DB_PASSWORD"), ReadOnly: os.Getenv("TRACEFLOW_RO_DB_PASSWORD"), Auth: os.Getenv("TRACEFLOW_AUTH_DB_PASSWORD")}
	if err := db.EnsureRoles(ctx, pool, pw); err != nil {
		return err
	}
	log.Info("migrations applied and roles ensured")
	return nil
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

	// The runtime role has no DDL rights; schema changes come only from `trace-api migrate`.
	if err := db.CheckMigrated(ctx, pool); err != nil {
		return err
	}

	limits := query.Limits{
		MaxRequestBytesCompressed: int(ingest.DefaultLimits.MaxCompressedBytes), MaxRequestBytesRaw: int(ingest.DefaultLimits.MaxRawBytes),
		MaxSpansPerRequest: ingest.DefaultLimits.MaxSpansPerRequest, MaxSpansPerTrace: store.MaxSpansPerTrace, MaxQueryWindow: httpapi.MaxWindow,
	}
	apiSrv := httpapi.New(query.New(pool), log, string(cfg.Profile), limits)
	servers := []*http.Server{newServer(cfg.QueryAddr, newQueryHandler(cfg, pool, apiSrv.Routes))}
	if cfg.IngestAddr != "" {
		mux := http.NewServeMux()
		mux.Handle("/v1/traces", ingest.NewHandler(store.New(pool), ingest.DefaultLimits, log))
		mux.Handle("GET /livez", ops.Liveness())
		servers = append(servers, newServer(cfg.IngestAddr, mux))
	}
	if cfg.Profile != config.ProfilePublicDemo {
		go retentionLoop(ctx, store.New(pool), log)
	}
	errc := make(chan error, len(servers))
	for _, s := range servers {
		go func(s *http.Server) { errc <- s.ListenAndServe() }(s)
		log.Info("listener up", "addr", s.Addr)
	}

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var errs []error
	for _, s := range servers {
		errs = append(errs, s.Shutdown(shutdownCtx))
	}
	return errors.Join(errs...)
}

// retentionLoop runs retention shortly after start and then hourly.
func retentionLoop(ctx context.Context, st *store.Store, log *slog.Logger) {
	t := time.NewTimer(time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		r, err := st.RunRetention(ctx, time.Now())
		if err != nil {
			log.Warn("retention run failed", "err", err.Error(), "status", r.Status)
		} else {
			log.Info("retention run", "traces_deleted", r.TracesDeleted, "spans_deleted", r.SpansDeleted)
		}
		t.Reset(time.Hour)
	}
}

func newServer(addr string, h http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           h,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second, // ingest bodies up to 4 MiB on slow links
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
}
