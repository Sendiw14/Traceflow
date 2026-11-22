// SPDX-License-Identifier: Apache-2.0

// Package config loads and validates trace-api configuration from the environment.
package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

type Profile string

const (
	ProfileLocalDev     Profile = "local-dev"
	ProfileOperatorProd Profile = "operator-prod"
	ProfilePublicDemo   Profile = "public-demo"
)

// minServiceTokenLen is 64 hex chars = 256 bits (ADR-0005).
const minServiceTokenLen = 64

type Config struct {
	Profile      Profile
	DatabaseURL  string
	ServiceToken string
	QueryAddr    string
	IngestAddr   string // empty = ingest listener disabled (always empty in public-demo)
}

// Load reads configuration via getenv (os.Getenv in production) and validates it.
func Load(getenv func(string) string) (Config, error) {
	c := Config{
		Profile:      Profile(getenv("TRACEFLOW_PROFILE")),
		DatabaseURL:  getenv("TRACEFLOW_DATABASE_URL"),
		ServiceToken: getenv("TRACEFLOW_SERVICE_TOKEN"),
		QueryAddr:    getenv("TRACEFLOW_QUERY_ADDR"),
		IngestAddr:   getenv("TRACEFLOW_INGEST_ADDR"),
	}
	if c.QueryAddr == "" {
		c.QueryAddr = ":8080"
	}
	if c.IngestAddr == "" && c.Profile != ProfilePublicDemo {
		c.IngestAddr = ":4318"
	}

	var errs []error
	switch c.Profile {
	case ProfileLocalDev, ProfileOperatorProd, ProfilePublicDemo:
	case "":
		errs = append(errs, errors.New("TRACEFLOW_PROFILE is required"))
	default:
		errs = append(errs, fmt.Errorf("TRACEFLOW_PROFILE %q is not one of local-dev, operator-prod, public-demo", c.Profile))
	}
	if c.DatabaseURL == "" {
		errs = append(errs, errors.New("TRACEFLOW_DATABASE_URL is required"))
	}
	if len(c.ServiceToken) < minServiceTokenLen {
		errs = append(errs, fmt.Errorf("TRACEFLOW_SERVICE_TOKEN must be at least %d characters (openssl rand -hex 32)", minServiceTokenLen))
	}
	// public-demo must never be configured for ingestion (deployment-topology.md guard rails).
	if c.Profile == ProfilePublicDemo && getenv("TRACEFLOW_INGEST_ADDR") != "" {
		errs = append(errs, errors.New("TRACEFLOW_INGEST_ADDR must not be set in public-demo"))
	}
	return c, errors.Join(errs...)
}

// FromEnv loads configuration from the process environment.
func FromEnv() (Config, error) { return Load(os.Getenv) }

// Redacted returns a log-safe description of the config (never the token or DB password).
func (c Config) Redacted() string {
	db := c.DatabaseURL
	if at := strings.LastIndex(db, "@"); at >= 0 {
		if scheme := strings.Index(db, "://"); scheme >= 0 && scheme < at {
			db = db[:scheme+3] + "***" + db[at:]
		}
	}
	return fmt.Sprintf("profile=%s query_addr=%s ingest_addr=%s database=%s", c.Profile, c.QueryAddr, c.IngestAddr, db)
}
