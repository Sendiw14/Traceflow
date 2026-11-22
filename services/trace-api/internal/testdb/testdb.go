// SPDX-License-Identifier: Apache-2.0

// Package testdb gives each test package its own PostgreSQL database so packages
// can run in parallel (go test ./...). Base URL: TRACEFLOW_TEST_DATABASE_URL.
package testdb

import (
	"context"
	"net/url"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Sendiw14/Traceflow/services/trace-api/db"
)

// Open returns a migrated pool on database "traceflow_test_<name>", creating it if needed.
// Skips the test when TRACEFLOW_TEST_DATABASE_URL is unset.
func Open(t *testing.T, name string) *pgxpool.Pool {
	t.Helper()
	ctx := context.Background()
	base := os.Getenv("TRACEFLOW_TEST_DATABASE_URL")
	if base == "" {
		t.Skip("TRACEFLOW_TEST_DATABASE_URL not set")
	}
	dbName := "traceflow_test_" + name
	admin, err := pgx.Connect(ctx, base)
	if err != nil {
		t.Fatal(err)
	}
	var exists bool
	if err := admin.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)`, dbName).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if !exists {
		if _, err := admin.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{dbName}.Sanitize()); err != nil {
			t.Fatal(err)
		}
	}
	_ = admin.Close(ctx)
	u, err := url.Parse(base)
	if err != nil {
		t.Fatal(err)
	}
	u.Path = "/" + dbName
	pool, err := pgxpool.New(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := db.Migrate(pool); err != nil {
		t.Fatal(err)
	}
	return pool
}
