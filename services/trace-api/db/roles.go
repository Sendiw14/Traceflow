// SPDX-License-Identifier: Apache-2.0

package db

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Role names (docs/architecture/data-model.md "DB roles"). Fixed, never user input.
const (
	RoleApp      = "traceflow_app"  // trace-api runtime: DML on trace tables, no DDL
	RoleReadOnly = "traceflow_ro"   // public-demo runtime: SELECT only
	RoleAuth     = "traceflow_auth" // web auth sessions: owns the separate auth database only
	AuthDatabase = "traceflow_auth"
)

// RolePasswords are supplied by the migrate job's environment; never logged.
type RolePasswords struct{ App, ReadOnly, Auth string }

func (p RolePasswords) validate() error {
	for name, v := range map[string]string{RoleApp: p.App, RoleReadOnly: p.ReadOnly, RoleAuth: p.Auth} {
		if len(v) < 32 {
			return fmt.Errorf("password for %s must be at least 32 characters", name)
		}
	}
	return nil
}

// exec builds a DDL statement server-side with format(%I/%L) so identifiers and the
// password literal are quoted by PostgreSQL, then executes it.
func exec(ctx context.Context, pool *pgxpool.Pool, format string, args ...any) error {
	var stmt string
	if err := pool.QueryRow(ctx, "SELECT format($1"+placeholders(len(args))+")", append([]any{format}, args...)...).Scan(&stmt); err != nil {
		return err
	}
	_, err := pool.Exec(ctx, stmt)
	return err
}

func placeholders(n int) string {
	s := ""
	for i := 0; i < n; i++ {
		s += fmt.Sprintf(", $%d::text", i+2)
	}
	return s
}

// EnsureRoles creates or updates the runtime roles, the separate auth database and
// grants. Idempotent; must run as a role allowed to create roles and databases.
// Call after Migrate so grants cover every table.
func EnsureRoles(ctx context.Context, admin *pgxpool.Pool, pw RolePasswords) error {
	if err := pw.validate(); err != nil {
		return err
	}
	for role, password := range map[string]string{RoleApp: pw.App, RoleReadOnly: pw.ReadOnly, RoleAuth: pw.Auth} {
		var exists bool
		if err := admin.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)`, role).Scan(&exists); err != nil {
			return err
		}
		verb := "ALTER"
		if !exists {
			verb = "CREATE"
		}
		if err := exec(ctx, admin, verb+" ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L", role, password); err != nil {
			return fmt.Errorf("%s role %s: %w", verb, role, err)
		}
	}

	var dbName string
	if err := admin.QueryRow(ctx, `SELECT current_database()`).Scan(&dbName); err != nil {
		return err
	}
	stmts := [][]string{
		// Trace database: only listed roles may connect; nobody but the owner may create objects.
		{"REVOKE ALL ON DATABASE %I FROM PUBLIC", dbName},
		{"GRANT CONNECT ON DATABASE %I TO %I", dbName, RoleApp},
		{"GRANT CONNECT ON DATABASE %I TO %I", dbName, RoleReadOnly},
		{"REVOKE CREATE ON SCHEMA public FROM PUBLIC"},
		{"GRANT USAGE ON SCHEMA public TO %I", RoleApp},
		{"GRANT USAGE ON SCHEMA public TO %I", RoleReadOnly},
		{"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I", RoleApp},
		{"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I", RoleApp},
		{"GRANT SELECT ON ALL TABLES IN SCHEMA public TO %I", RoleReadOnly},
		{"REVOKE ALL ON TABLE goose_db_version FROM %I", RoleReadOnly}, // migration bookkeeping is not demo data
		{"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I", RoleApp},
		{"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I", RoleApp},
		{"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO %I", RoleReadOnly},
	}
	for _, st := range stmts {
		args := make([]any, len(st)-1)
		for i, a := range st[1:] {
			args[i] = a
		}
		if err := exec(ctx, admin, st[0], args...); err != nil {
			return fmt.Errorf("%s: %w", st[0], err)
		}
	}

	// Separate auth database owned by the auth role (ADR-0005 amendment): the web
	// service's credentials never reach trace data.
	var authExists bool
	if err := admin.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)`, AuthDatabase).Scan(&authExists); err != nil {
		return err
	}
	if !authExists {
		if err := exec(ctx, admin, "CREATE DATABASE %I OWNER %I", AuthDatabase, RoleAuth); err != nil {
			return fmt.Errorf("create auth database: %w", err)
		}
	}
	if err := exec(ctx, admin, "REVOKE ALL ON DATABASE %I FROM PUBLIC", AuthDatabase); err != nil {
		return err
	}
	return exec(ctx, admin, "GRANT CONNECT, CREATE, TEMPORARY ON DATABASE %I TO %I", AuthDatabase, RoleAuth)
}

// CheckMigrated returns an error if the schema the runtime needs is not present
// (the runtime role cannot migrate). Used at startup instead of migrating.
func CheckMigrated(ctx context.Context, pool *pgxpool.Pool) error {
	var n int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name IN ('spans', 'trace_summaries', 'ingestion_records', 'settings')`).Scan(&n)
	if err != nil {
		return err
	}
	if n != 4 {
		return errors.New("database schema missing: run the migrate job (`trace-api migrate`) first")
	}
	return nil
}
