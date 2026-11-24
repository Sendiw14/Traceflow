# Benchmark Results

## M4-PERF-01 — peak ingest + query load (2026-11-22)

**Tool:** `services/trace-api/tests/perf` (seed 20261122). Run: `bin/perf` with defaults (500 spans/s × 10 min ingest, then 10 VUs × (30 s warmup + 5 min) query).
**Status:** targets met **on this host**; **NOT TESTED on the spec reference host** (4 vCPU / 8 GB Linux). Re-run there before any capacity claim.

### Environment (actual)
| Item | Value |
| --- | --- |
| Host | macOS arm64, 10 CPU, 16 GiB (developer laptop) — **not** the reference Linux host |
| PostgreSQL | `postgres:18.7` in Docker Desktop, container capped `--cpus 4 --memory 8g`, **default config** (shared_buffers 128MB) |
| trace-api | native host binary (commit after `224da1f`, M4 working tree), loopback listeners, default limits |
| Network | loopback; no TLS; no Collector in path (direct OTLP/HTTP) |
| Dataset | generated during the run: 30,000 traces × 10 spans = **300,000 spans**, 3 services, 2 attributes/span, ~5 % error traces |

### Peak ingest (PERF-02): 500 spans/s for 10 min, direct to receiver
| Metric | Result |
| --- | --- |
| Spans sent / accepted / rejected | 300,000 / **300,000** / 0 |
| Failed requests (incl. 429/5xx) | 0 |
| All sent spans accounted for | **true** |
| Achieved rate | 499.97 spans/s (target 500) |
| Request latency (50 spans/request) p50 / p95 / p99 | 36.1 / 44.6 / 94.3 ms |

Collector queue/drop behaviour is **not** part of this test (Collector not in path).

### Query load (PERF-01): 10 VUs, 5 min measured after 30 s warmup, 50/50 mix
| Endpoint | Requests | Errors | p50 | p95 | p99 | Target |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /v1/traces` (random sub-windows, filter mix: none / service / status=error / min_duration, limit 50) | 526,238 | 0 | 1.48 ms | **2.08 ms** | 2.70 ms | p95 < 500 ms ✅ |
| `GET /v1/traces/{id}` (full detail, random known ID) | 525,210 | 0 | 4.02 ms | **5.26 ms** | 6.72 ms | p95 < 1 s ✅ |
| Error rate | | | | **0 %** | | < 1 % ✅ |

### Aggregate endpoints (single-client, best of 5, 30-min window, 120k SERVER spans)
| Endpoint | Latency |
| --- | --- |
| `/v1/overview` | 347 ms |
| `/v1/services` | 184 ms |
| `/v1/services/inventory` | 464 ms |
| `/v1/dependencies` | 488 ms |
| `/v1/analytics/server-latency` (60 s buckets) | 160 ms |
| `/v1/analytics/latency-distribution` | 65 ms |

Not load-tested concurrently. Overview polled every 5 s per tab is acceptable at this size; dependencies (self-join) is the first optimisation candidate if windows grow (7-day window NOT TESTED).

### Storage (measured)
| Metric | Value |
| --- | --- |
| `spans` heap | 107 MB → **≈ 374 B/span** |
| `spans` incl. indexes + TOAST | 164 MB → **≈ 573 B/span**, index amplification ≈ 1.53 |
| Whole database | 184 MB |

These spans carry only 2 short attributes; real instrumentation (≈15 attributes) will be larger. See `docs/architecture/capacity-profile.md`.

### Not covered
Reference Linux host; tuned PostgreSQL; Collector in path; 7-day query windows; >200-row UI rendering; memory/GC profile of trace-api; disk-IO saturation; sustained multi-hour profile.

## M7-PERF-02 — aggregate endpoints under load, 1 h / 24 h / 7 d windows (2026-11-25)

**Tool:** `tests/perf -mix aggregates -spread 168h -rate 2000 -ingest-duration 150s -vus 10 -query-duration 3m -warmup 0s` (every request counted). **Host:** same dev host; PostgreSQL 18.7 capped 4 CPU / 8 GB, `--shm-size 256m`; trace-api as `traceflow_app`.
**Dataset:** 230,450 spans / 23,045 traces spread uniformly over the past 7 days (seeding achieved 1,532 spans/s; 230,450/230,450 accepted, 0 failed requests).

| Endpoint | 1 h p95 | 24 h p95 | 7 d p95 | 7 d p99 | Errors |
| --- | --- | --- | --- | --- | --- |
| `/v1/overview` | 29 ms | 300 ms | **1,756 ms** | 2,895 ms | 0 |
| `/v1/services` | 18 ms | 167 ms | 1,065 ms | 1,489 ms | 0 |
| `/v1/dependencies` | 47 ms | 354 ms | **2,371 ms** | 2,739 ms | 0 |
| `/v1/analytics/server-latency` (3600 s buckets) | 17 ms | 158 ms | 1,046 ms | 1,640 ms | 0 |
| `/v1/analytics/latency-distribution` | 11 ms | 88 ms | 449 ms | 585 ms | 0 |
| **All** (5,397 requests) | | | | | **0** |

**Finding fixed:** the first run (default Docker `/dev/shm` 64 MB) produced 6 × `could not resize shared memory segment … No space left on device` (SQLSTATE 53100) → 503 during warmup, hidden from the measured stats. `compose.yaml` now sets `shm_size: 256m` (production already did); the re-run counted every request and had 0 errors.
**Limitation (no spec target exists for aggregates):** 7-day overview/dependencies are 1.8–2.4 s p95 because they scan all SERVER spans in the window. Acceptable for occasional views; not for 5 s polling of a 7-day window. Candidate ADR: hourly rollup table for service stats and edges. UI should default to short windows and poll long windows slowly.
