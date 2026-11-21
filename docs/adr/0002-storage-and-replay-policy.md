# ADR-0002: Span storage, deduplication and replay-conflict policy

- **Status:** Proposed (M1)
- **Date:** 2026-11-22
- **Requirements:** SCOPE-03, SCOPE-04, AC-OTLP-07, AC-DATA-04

## Context
OTLP delivery is at-least-once (Collector retries, SDK retries). Same span may arrive many times; a misbehaving producer may send a different payload under the same `(trace_id, span_id)`.

## Decision
1. Unique key `(workspace_id, trace_id, span_id)`. V1 has one workspace (`workspace_id = 1`).
2. Each span row stores `content_hash` = SHA-256 over a canonical encoding of the span **as received** (the protobuf `Span` message bytes re-marshalled deterministically with `proto.MarshalOptions{Deterministic: true}`) plus resource and scope identity.
3. Insert with `ON CONFLICT (workspace_id, trace_id, span_id) DO NOTHING RETURNING`. If no row returned, compare stored `content_hash`:
   - **Equal** → identical replay. Count `spans_duplicate_total`. Span counts as *accepted* in the OTLP response (it is durably stored). No summary change.
   - **Different** → conflicting replay. **First write wins.** Incoming payload written to `span_conflicts` (bounded: keep hash, received_at, size, ingestion record id; payload bytes only up to 64 KiB). Count `spans_conflict_total`. Span counts as *rejected* in `partial_success` with message `conflicting replay of existing span`.
4. Attributes, resource attributes, events and links stored as JSONB (typed-value encoding, see `data-model.md`). Hot fields (service name, span name, kind, status, times, duration) are columns.
5. `trace_summaries` maintained in the same transaction as span inserts (upsert, recomputed from aggregate deltas). Late spans update the summary; summary carries `span_count`, `root_span_id` (nullable), `root_count`, `orphan_count`, `is_complete_estimate` flags.

## Consequences
- Deterministic: replays never double-count; conflicts visible and auditable; no silent overwrite.
- First-write-wins can preserve a bad first payload; operator sees conflict counter and can inspect.
- Deterministic protobuf marshalling is stable within a library version, not across versions; hash covers *our* re-encoding, so library upgrades may cause spurious conflicts for replays spanning an upgrade. Documented limitation; upgrade notes must mention it.

## Alternatives rejected
Last-write-wins (silent corruption); reject entire request on conflict (punishes valid spans in same batch).
