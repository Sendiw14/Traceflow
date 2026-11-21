# ADR-0001: Modular monolith with Next.js BFF

- **Status:** Proposed (M1)
- **Date:** 2026-11-22
- **Requirements:** SCOPE-02, SCOPE-05, NFR-07

## Context
Single-operator, single-server V1. Spec §2 proposes a modular monolith; spec §0.7 forbids Kubernetes/Kafka/Redis/ClickHouse without measured need.

## Decision
- One Go binary `trace-api` with two listeners (ingest, query) and internal packages per `docs/architecture/overview.md`.
- PostgreSQL 18 is the only datastore.
- Next.js App Router app is site, docs, dashboard and BFF. Browser talks only to Next.js.
- Docker Compose + Caddy for all profiles.

## Consequences
- Simple ops and one deploy unit; ingest and query share CPU — mitigated by bounded concurrency per listener and separate DB pools.
- Scale-out triggers documented in `capacity-profile.md`; crossing them requires a new ADR.

## Alternatives rejected
Separate ingest/query services (more ops, no measured need); ClickHouse (no measured need, V1 exclusion).
