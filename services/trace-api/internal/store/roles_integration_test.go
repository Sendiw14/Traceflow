// SPDX-License-Identifier: Apache-2.0

package store

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/Sendiw14/Traceflow/services/trace-api/db"
	"github.com/Sendiw14/Traceflow/services/trace-api/internal/testdb"
)

// T-14: runtime roles are least-privileged; the auth role cannot reach trace data.
func TestDatabaseRolesLeastPrivilege(t *testing.T) {
	admin := testdb.Open(t, "store")
	pw := db.RolePasswords{App: strings.Repeat("a", 40), ReadOnly: strings.Repeat("r", 40), Auth: strings.Repeat("z", 40)} // gitleaks:allow test-only passwords
	if err := db.EnsureRoles(ctx, admin, pw); err != nil {
		t.Fatal(err)
	}
	if err := db.EnsureRoles(ctx, admin, pw); err != nil { // idempotent
		t.Fatalf("second EnsureRoles: %v", err)
	}
	base, _ := url.Parse(admin.Config().ConnString())
	as := func(user, pass, dbName string) (*pgx.Conn, error) {
		u := *base
		u.User = url.UserPassword(user, pass)
		if dbName != "" {
			u.Path = "/" + dbName
		}
		return pgx.Connect(context.Background(), u.String())
	}
	must := func(c *pgx.Conn, err error) *pgx.Conn {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = c.Close(ctx) })
		return c
	}
	app := must(as(db.RoleApp, pw.App, ""))
	ro := must(as(db.RoleReadOnly, pw.ReadOnly, ""))

	ok := func(c *pgx.Conn, sql string) {
		t.Helper()
		if _, err := c.Exec(ctx, sql); err != nil {
			t.Fatalf("expected allowed: %s: %v", sql, err)
		}
	}
	denied := func(c *pgx.Conn, sql string) {
		t.Helper()
		_, err := c.Exec(ctx, sql)
		var pg *pgconn.PgError
		if !errors.As(err, &pg) || pg.Code != "42501" { // insufficient_privilege (incl. "must be owner")
			t.Fatalf("expected SQLSTATE 42501: %s: %v", sql, err)
		}
	}
	ok(app, `SELECT count(*) FROM spans`)
	ok(app, `UPDATE settings SET updated_at = now() WHERE key = 'retention_days'`)
	ok(app, `INSERT INTO ingestion_records (source, bytes_compressed, bytes_raw, spans_received, spans_accepted, spans_duplicate, spans_rejected, http_status) VALUES ('direct',0,0,0,0,0,0,200)`)
	denied(app, `CREATE TABLE evil (x int)`)
	denied(app, `DROP TABLE spans`)
	denied(app, `ALTER TABLE spans ADD COLUMN x int`)
	denied(app, `TRUNCATE spans`)

	ok(ro, `SELECT count(*) FROM trace_summaries`)
	denied(ro, `INSERT INTO settings (key, value) VALUES ('x', '1')`)
	denied(ro, `DELETE FROM spans`)
	denied(ro, `SELECT * FROM goose_db_version`)

	// Auth role: may not connect to the trace database at all; owns only its own database.
	if c, err := as(db.RoleAuth, pw.Auth, ""); err == nil {
		_ = c.Close(ctx)
		t.Fatal("auth role connected to the trace database")
	} else if !strings.Contains(err.Error(), "permission denied") {
		t.Fatalf("auth role trace-db error: %v", err)
	}
	auth := must(as(db.RoleAuth, pw.Auth, db.AuthDatabase))
	ok(auth, `CREATE TABLE IF NOT EXISTS probe (x int)`)
	ok(auth, `DROP TABLE probe`)
	if c, err := as(db.RoleApp, pw.App, db.AuthDatabase); err == nil {
		_ = c.Close(ctx)
		t.Fatal("app role connected to the auth database")
	}

	// Runtime refuses to start on an unmigrated database.
	if err := db.CheckMigrated(ctx, admin); err != nil {
		t.Fatalf("CheckMigrated on migrated db: %v", err)
	}
}
