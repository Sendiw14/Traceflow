# Changelog

All notable changes to TRACEFLOW. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).
A release is cut by moving `Unreleased` to a `## [x.y.z] - YYYY-MM-DD` section and pushing tag `vx.y.z` (see `docs/runbooks/release.md`).

## [Unreleased]

Readiness: (C) integrated functionality — see `docs/testing/release-evidence.md` for what is and is not verified.

### Added
- OTLP/HTTP binary Protobuf trace ingest (`POST /v1/traces`, gzip) with spec-conformant 200 / partial success / 400 / 413 / 415 / 429 / 503 responses; success only after the database commit.
- Storage in PostgreSQL 18 with idempotent replay, first-write-wins conflict handling, per-trace serialized summaries, size limits, Go-side redaction and hourly retention.
- Query API 1.0.0 (`api/openapi.yaml`): overview, traces with cursor pagination, trace and span detail, services, evidence-only dependency graph, latency series and histogram, ingestion status, settings.
- Web app: editorial site, docs, synthetic `/demo`, and the `/app` diagnostics workspace (overview, traces, waterfall/tree/inspector, services, map with edge table, analytics, onboarding, settings).
- Operator sign-in with GitHub (numeric-ID allowlist, `__Host-` session cookies, 12 h idle / 7 d absolute), enforced on pages, server actions and every data read.
- Deployment profiles `local-dev`, `operator-prod`, `public-demo` with server-side gating; `compose.production.yaml` with Caddy TLS.
- Least-privilege database roles and a one-shot `migrate` job; separate auth database.
- Encrypted backup and restore scripts (`age`), runbooks, failure drills.
- Demo system (gateway → orders → inventory) with five deterministic scenarios and a traffic generator.
- CI: Go (race, PostgreSQL integration, contract + oracle tests, codegen drift), web (lint, typecheck, unit, build), secrets scan, Trivy image/lockfile gate with SBOM, Compose smoke running the README quickstart and Playwright journeys.

### Security
- better-auth's origin/CSRF checks are forced on (they are skipped by default when `NODE_ENV=test`).
- Known third-party findings: `postgres:18.7` (gosu) and Collector 0.165.0 — see `docs/security/security-testing.md`.
