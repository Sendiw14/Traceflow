# ADR-0004: App query API conventions and code generation

- **Status:** Proposed (M1) — needs Sonnet consumer review before freeze
- **Date:** 2026-11-22
- **Requirements:** AC-API-01…03, AC-DATA-02

## Decision
- Contract: `api/openapi.yaml` (OpenAPI 3.1), version in `info.version`; breaking changes bump major and need ADR.
- Go: `oapi-codegen` generates server interfaces/types (std `net/http`). TS: `openapi-typescript` types + `openapi-fetch` client, generated into `apps/web/src/lib/api/generated/` and never hand-edited. CI fails if regeneration produces a diff.
- **Timestamps:** Unix epoch nanoseconds as decimal strings (`"1763800000123456789"`), JSON Schema `type: string, pattern: ^[0-9]{1,20}$`. Durations: nanoseconds as decimal strings. UI converts with BigInt.
- **IDs:** trace ID 32 lowercase hex chars; span ID 16 lowercase hex chars.
- **Errors:** `application/problem+json` (RFC 9457) with `type`, `title`, `status`, `detail`, `code` (stable enum).
- **Pagination:** opaque cursor (base64url of `(start_time_unix_nano, trace_id)` + filter hash). Order `start_time DESC, trace_id DESC`. Cursor with mismatched filters → 400 `cursor_filter_mismatch`. `limit` 1–200, default 50.
- **Time windows:** `from`/`to` required on list/aggregate endpoints (ns strings), max window 7 d (configurable), `to` exclusive.
- **Caching:** all endpoints respond `Cache-Control: private, no-store`. BFF re-applies on its responses.
- **Auth:** query listener requires service bearer token (ADR-0005); user identity is enforced in BFF, not the Go API.
- **Sampling caveat:** aggregate responses include `sample_count` and `population` description fields.

## Consequences
BigInt handling in UI; string comparison of ns values must be numeric-aware (UI helpers own this).
