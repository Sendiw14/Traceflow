# TRACEFLOW — OpenAPI Consumer Review (M1-R1)

**Reviewer / owner:** Sonnet (frontend consumer) · **Date:** 2026-11-22 · **Reviewed artifact:** `api/openapi.yaml` `0.1.0-draft` @ base commit `9089e9b` · **Spec:** §11, §10
**Method:** read-through of the YAML against every route in `page-matrix.md`; payload sizes are **back-of-envelope estimates, not measurements** (marked *est.*). No code run; nothing generated or linted by me (`redocly lint` result in `api-contract.md` is taken from the Opus note, not re-run: **NOT TESTED** by this reviewer).
**This review does not edit `api/openapi.yaml`** (Opus owns it). Recommendation levels: **B** = blocks contract freeze, **S** = should change before freeze (cheap now, costly later), **N** = nice/optional, **D** = decision for Opus/owner.

## 1. Answers to the three open questions (`docs/architecture/api-contract.md`)

### Q1 — Is `TraceDetail` (all spans, up to 50 000) acceptable?
**Answer: acceptable for V1 *as the default representation*, conditional on four changes (R-1). Not acceptable as an unbounded browser payload.**
- *Est.* size: a span with ~8 attributes and 1 event is roughly 1–1.5 KB JSON (each `Attribute` carries `type`+`value` wrappers). 5 000 spans ≈ 5–8 MB raw (≈ 0.6–1 MB gzip); 50 000 spans ≈ 50–75 MB raw — too heavy to parse, hold and render in a browser tab, and it also stresses the BFF. All **est., NOT TESTED**.
- Waterfall rows need only: `span_id, parent_span_id, parent_present, name, kind, service_name, start/end/duration, status.code, quality, resource_ref`. Attributes/events/links are needed **only for the focused span** (inspector). So >80% of payload is not needed to draw the waterfall.
- Proposal, additive and non-breaking:
  1. `GET /v1/traces/{traceId}` gets query `detail=lite|full` (default `full` for forward compatibility; UI uses `lite` above a client threshold of ~1 000 spans—threshold set by M4 measurement). `lite` omits `attributes/events/links` (keeps counts `attribute_count,event_count,link_count` so UI can show "3 events").
  2. New `GET /v1/traces/{traceId}/spans/{spanId}` returning one full `Span` (+ its resource/scope entries) for the inspector.
  3. When the stored span count exceeds a server cap, return `TraceDetail.truncation: {spans_total, spans_returned}` and never silently drop; the cap must be consistent with `Settings.limits.max_spans_per_trace` (today `maxItems: 50000` in the schema is a *second, separately maintained* constant — **S**: tie them or document that `maxItems` is a hard ceiling).
  4. BFF streams/gzips; no full buffering in Node (note for Sonnet/BFF, not API).
- Keep V1 default `full` (J-02/J-03 need attributes quickly for small traces). Decision on lite-by-default threshold deferred to the M4 5k-span measurement as proposed, **but the endpoints/params must be in the frozen contract** (adding later is additive but the freeze should include them so generated client and test fixtures cover them).
- Also: spec says span order is `start_unix_nano asc, span_id asc` — keep; client builds the tree. Cross-service late arrivals mean span set grows: see R-11 freshness/ETag note.

### Q2 — Overview polling at 5 s: is payload size OK?
**Answer: `getOverview` itself is fine at 5 s; the *series* is not, and the overview needs one more call.**
- `Overview` *est.* ≈ 20 `ServiceSummary` (~0.7 KB each: three percentile strings, population note) + 20 `TraceSummary` (~0.6 KB; `service_names` unbounded) + totals ≈ **25–35 KB raw, 4–7 KB gzip**. Acceptable at 5 s while visible (≈ 1 req/5 s/tab; no memory growth), **provided** (R-2): `Population.note` strings are not repeated per row (it is a constant sentence repeated in every `ServerStats`) — wasteful but small here; and `TraceSummary.service_names` gets `maxItems` (50).
- The overview page also needs the charts (`getServerLatency`). **`LatencyPoint.stats` embeds a full `ServerStats` including `Population.note` per bucket**: *est.* ~350 B × up to 10 080 points ≈ 3.5 MB for 7 d @ 60 s. The UI will cap points (~≤ 300, see page matrix bucket rule) so real payload ≈ 100 KB, but the *schema permits* megabytes and the repeated note is pure waste. **S (R-2b):** make `LatencyPoint.stats` a slimmer `BucketStats` (`request_count, error_count, error_fraction, latency{p50,p95,p99}, sample_count`) and keep `Population` only on `LatencySeries.overall`.
- Polling plan the UI will use: overview 5 s; series + ingestion 30 s (bucket-aligned); abort in-flight; hidden-tab pause. If measured too heavy, UI falls back to 10 s without contract change.
- Windows: relative `range` resolved client-side to `from/to` once per tick. **R-18:** client clock may skew from server; the UI will derive a clock offset from `freshness.generated_at` (already available on Overview) — please also add `freshness` to the other aggregate responses (R-11) so the offset is available everywhere.

### Q3 — Missing fields for page-matrix states (e.g., per-service sparkline in list)?
**Answer:** per-service sparkline in the list is **not needed for V1 — don't add** (spec §8.2 asks for "traffic/latency/error summaries"; the table columns cover it; a sparkline would add N series queries). Real gaps found are listed in §2; the blocking one is the **latency distribution** (R-3).

## 2. Findings (ranked)

### Blocking (B)
**R-3 · No source for "latency distribution" (spec §8.2 `/app/analytics`).** `getServerLatency` returns percentiles per bucket only. Spec requires "Time series, latency distribution, p50/p95/p99 where meaningful, error breakdown". Proposal: `GET /v1/analytics/latency-distribution?from&to&service&operation` → `{window, population, buckets:[{lower_nano, upper_nano, count}], overall}` with fixed server-defined log-spaced buckets (1 ms…60 s, ≈ 24 buckets) so shape is stable across windows; `upper_nano` open-ended last bucket (`null`). Must state the same SERVER-span population and sample count. Without this, `/app/analytics` cannot meet its gate.

**R-4 · No "error breakdown" and no exemplar trace links.** Needed by `/app/analytics` (error breakdown) and J-02 ("from a slow service … navigate to the corresponding trace and highlight the known slow span"). Today the only path from a service/operation to a *slow* trace is `listTraces(service, min_duration_nano)` and the UI picking a threshold itself. Proposal (additive): (a) `ServerStats` gets optional `exemplars: {slowest_trace_id, latest_error_trace_id}` (nullable) — computed for the same population; (b) error breakdown = per-service (already from `listServices`: `error_count/error_fraction`) and per-operation (from `getService.operations`); add **`sample_error_trace_ids` (≤3)** to `OperationSummary` and `ServiceSummary`. If Opus declines (b), UI can build the breakdown from existing data, but exemplars (a) are strongly recommended for J-02 (fixture: known slow span must be reachable in ≤ 3 clicks without hints).

### Should change before freeze (S)
**R-1 · Trace detail size controls** — see Q1 (`detail=lite|full`, `GET …/spans/{spanId}`, `truncation`, unify cap).

**R-5 · Field-level validation errors.** `Problem` has no per-field errors; `updateSettings` (retention) and any future form need inline validation (spec §11, WCAG 3.3.1). Add optional `errors: [{field, code, message}]` to `Problem` for `invalid_parameter`. Also `Problem.detail` is displayed to humans: please state it is plain text, no markup, no secrets.

**R-6 · Partial (still-filling) last bucket.** `LatencySeries.points` includes the current in-progress bucket; its values drop at the right edge and mislead. Add `LatencyPoint.partial: boolean` (true when bucket end > `freshness.generated_at`/now) or document how to derive it. Also confirm that **points are dense** (`stats: null` buckets are present rather than omitted) — the schema description implies yes; state it explicitly, because gap rendering depends on it. Also add `freshness` (R-11).

**R-11 · `freshness` only on Overview/TraceDetail/DependencyGraph.** Spec §8 requires "data freshness indicators" on every route. Add `freshness` (`generated_at`, `last_span_received_at`) to `TraceList`, services list, `ServiceDetail`, `LatencySeries`, `IngestionStatus`, `Settings`(only `generated_at`). Rationale: freshness indicator, clock offset (R-18), stale-data labelling.

**R-12 · Onboarding "first trace" link.** `getIngestionStatus` has counters and `last_request_at` but no pointer to a received trace. Add `latest_trace_id: TraceId|null` (+ `first_span_received_at`). Interim UI fallback: `listTraces(limit=1)` over the last 15 min. Also note `reject_reasons` keys are free-form strings: please enumerate (stable codes) in the schema or doc so the UI can map to advice.

**R-13 · Graph/list invariants to state in the contract.** (a) Every `DependencyEdge.source/target` **must** appear in `DependencyGraph.nodes` (a service with only CLIENT spans has no SERVER stats; return it with `population.sample_count: 0` and null percentiles), otherwise the graph/table cannot render the node. (b) `Overview.trace_count` is optional in the schema but required by the KPI; make it required. (c) `Overview.top_services` — define the ranking (suggest: by `request_count` desc, then name) and whether it is filtered by `service`. (d) `TraceSummary.service_names` — `maxItems`/ordering (suggest ≤ 50, sorted by first appearance). (e) `listTraces.service` semantics: "any span from service" vs "root service" — specify (UI copy depends: "Traces involving service X"). (f) `status=error` means "any span in trace has status error" — confirm to match `error_span_count > 0`. (g) `ok_or_unset` label will read "No errors".

**R-14 · Read-only capability.** UI must hide/disable settings editing in `public-demo`; discovering via a 403 is poor UX. Add `Settings.read_only: boolean` (or `capabilities.can_update_settings`). Also `Settings` needs `next_retention_run` (nullable) if the confirm dialog should state when deletion happens.

**R-15 · Pattern mismatch.** `Nanos` is `^[0-9]{1,19}$` in the YAML but ADR-0004 says `{1,20}`; uint64 ns needs up to 20 digits (19 digits cover until year 2286, but be consistent). Also `SignedNanos` allows `-?[0-9]{1,19}`. Also `DependencyEdge.evidence.basis` enum is `client_server_parent_child|other_parent_child` but the description says "client_server" — fix the text.

### Decisions / nice-to-have
**R-7 (N) · Retention impact estimate.** Lowering retention is destructive. Optional `PATCH /v1/settings?dry_run=true` returning `{estimated_traces_deleted, estimated_spans_deleted}` would let the confirm dialog state impact. If not provided, the dialog states irreversibility without a number (acceptable V1).

**R-8 (S) · 404 vs empty window for services.** `getService` 404 means "unknown service" but a known service with no spans in *this* window should return 200 with zero stats, or 404 with `code: not_found` and `detail` distinguishing it. UI copy differs ("widen the window" vs "no such service"). Please specify. Same for `getTrace`: 404 may mean "not arrived yet" or "retained away"; if retention-deleted state is knowable return a distinct `code` (`trace_expired`), else UI copy stays generic.

**R-9 (D) · Trace list ordering.** Server order is fixed; no `sort` param. UI will label column sort as "within loaded rows". If product wants "slowest first", that needs a new keyset; **not requested for V1** (note as limitation shown in UI).

**R-10 (D) · Cursor semantics for URLs.** `cursor` is bound to filters; UI keeps cursor out of the shareable URL by default (cursor expires with data changes; deep links should land on the first page). Please confirm cursors are stable/stateless (base64url of keys, no server session) and state a cursor lifetime (none = good).

**R-16 (D) · Public-demo time window.** Demo data is synthetic and static; "last 1 h" will be empty unless timestamps are rebased on a schedule. Opus owns the demo deployment: either (a) a replay job re-stamps spans near "now" periodically (UI works unchanged), or (b) demo exposes a fixed historical window (UI needs `Overview.freshness.last_span_received_at` to set a default range, and a banner "Synthetic data from <date>"). UI can support (b) with no API change but (a) is a better first-run experience. **Decision needed from Opus/owner before M5.**

**R-17 (D) · Public-demo route surface.** Which `/v1` endpoints exist in `public-demo` (page matrix assumes all reads except settings PATCH; ingestion status/settings GET may expose operational counters — probably should be 404/403 there). Confirm; `/demo` UI will only call `getOverview, listTraces, getTrace, listServices, getService, getServerLatency, getDependencies`.

**R-19 (N) · Numeric precision.** `request_count` etc. are `integer` (JSON number, safe to 2^53) — fine. Percentile/duration Nanos strings: UI uses BigInt for timestamps; durations ≤ 7 d (6e14 ns) fit in `Number` safely but the helper will use BigInt consistently. `error_fraction` is a JSON number; UI displays with explicit precision rule (≥ 0.1% shown as 0.1 %, below as "<0.1 %"; never round a nonzero value to 0).

**R-20 (N) · `AnyValue` rendering.** Fine as designed. Request: state a max nested depth and max string size so the inspector can bound rendering; confirm `truncated` on `Attribute` applies to the value only. `bytes` shown as length + base64 on demand.

## 3. Things the contract does well (keep)
Explicit `parent_present` and `quality` flags; `Percentiles` nulls with floors; `Population` on every aggregate; `duration.basis`; nullable `root`; edges with evidence and sample trace IDs; cursor bound to filters; no-store everywhere; Problem codes enumerated; `window_too_large`; signed durations for clock skew; stable ordering. These map 1:1 to the "truthful UI" states.

## 4. Impact on freeze
| ID | Level | Needed for freeze? | Frontend impact if not done |
| --- | --- | --- | --- |
| R-3 | B | **Yes** | `/app/analytics` distribution panel cannot exist (phantom UI forbidden) → route fails §8.2 gate |
| R-4 | B (a) / S (b) | Yes for (a) | J-02 path relies on UI-guessed thresholds |
| R-1 | S | Yes (params/endpoint reserved) | M4 5k-span risk; heavy BFF memory |
| R-5, R-6, R-11, R-12, R-13, R-14, R-15 | S | Strongly recommended | Workarounds listed above; some states less truthful |
| R-8 | S | Recommended | Ambiguous 404 copy |
| R-7, R-9, R-10, R-16, R-17, R-18, R-19, R-20 | D/N | Decisions logged | See notes |

**Reviewer verdict:** `CHANGES REQUESTED` — freeze blocked on R-3 and R-4(a); all else non-blocking. Re-review after Opus updates `api/openapi.yaml` (I will diff the schemas listed above and re-run the page-matrix binding check). Nothing in this review was verified by executing code: **NOT TESTED**.
