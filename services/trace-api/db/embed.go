// SPDX-License-Identifier: Apache-2.0

// Package db embeds and applies SQL migrations (goose, forward-only).
package db

import (
	"database/sql"
	"embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Migrate applies all pending migrations. goose's version table replaces the
// design's schema_info table.
func Migrate(pool *pgxpool.Pool) error {
	sqlDB := stdlib.OpenDBFromPool(pool)
	defer func(d *sql.DB) { _ = d.Close() }(sqlDB)
	goose.SetBaseFS(migrations)
	goose.SetLogger(goose.NopLogger())
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	if err := goose.Up(sqlDB, "migrations"); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
