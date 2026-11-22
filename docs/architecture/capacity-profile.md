# Capacity Profile (formulas + planning assumptions; first measurement recorded)

**Status:** PROVISIONAL. Every number marked *assumed* must be replaced by measurement at M3/M4 (`docs/testing/benchmark-results.md`). Owner decision U-02: demo + personal projects, < 50 spans/s sustained, 7-day retention.

## Formulas

```
daily_spans        = sustained_spans_per_s × 86,400
retained_spans     = daily_spans × retention_days
row_bytes          = measured avg on-disk bytes/span (heap + TOAST)        [M3 measure]
index_amp          = (total relation size incl. indexes) / heap size         [M3 measure]
db_bytes           = retained_spans × row_bytes × index_amp × (1 + bloat_reserve)
disk_required      = db_bytes + WAL_reserve + backup_local_copy + free_space_reserve
```

`free_space_reserve` = max(20% of volume, 10 GiB). `bloat_reserve` = 0.3 until vacuum behaviour measured.

## Planning scenarios

| Scenario | spans/s | Retention | Retained spans | Assumed bytes/span × amp | DB size (assumed) |
| --- | --- | --- | --- | --- | --- |
| A. local-dev demo | 5 | 7 d | 3.0 M | 1.5 KiB × 1.6 × 1.3 | ~9.0 GiB |
| B. operator-prod (U-02) | 50 | 7 d | 30.2 M | 1.5 KiB × 1.6 × 1.3 | ~90 GiB |
| C. peak test (burst only) | 500 for 10 min | — | 0.3 M | — | ~1 GiB |
| D. spec warning case | 500 sustained | 7 d | 302.4 M | — | ~900 GiB — **out of scope for single server** |
| E. public-demo | synthetic seed | 1 d | ≤ 0.5 M | — | < 2 GiB |

*Assumed* 1.5 KiB/span is a placeholder for spans with ~15 attributes; real value depends on instrumentation.

**First measurement (M4-PERF-01, `docs/testing/benchmark-results.md`):** synthetic spans with 2 attributes cost ≈ 374 B heap and ≈ 573 B/span including indexes (index amplification ≈ 1.53). At that size scenario B (30.2 M spans) would be ≈ 16 GiB, ≈ 21 GiB with the 30 % bloat reserve; the 1.5 KiB × 1.6 planning value remains the sizing basis until spans from real instrumentation are measured.

Implications:
- Scenario B needs ~130 GiB volume (90 GiB DB + WAL + 20% free) after reserves on the operator host. If the chosen host is smaller, reduce retention or ADR for partitioning/compression.
- Local machine has 90 GiB free (R-12): local benchmarks must cap datasets (250k-span perf fixture ≈ <1 GiB is fine).

## Throughput assumptions to validate
- Ingest: target ≥ 500 spans/s burst on 4 vCPU/8 GB with batches of ~512 spans; one tx per request.
- Query: spec §16.2 targets at 250k spans / 25k traces.

## Saturation signals and throttling
| Signal | Threshold (initial) | Action |
| --- | --- | --- |
| Ingest semaphore full | all slots busy | 429 + `Retry-After` |
| DB pool wait > 2 s / commit timeout | — | 503 + `Retry-After` |
| Disk free < 15% | `/readyz` warning metric | UI banner; operator alert in logs |
| Disk free < 8% | — | ingest returns 503; retention runs immediately |
| Collector queue > 80% capacity | Collector metric | surfaced on `/app/settings` (M6) |

## Scale-out triggers (each needs ADR)
Sustained > 200 spans/s measured; DB > 70% of volume at configured retention; trace list p95 > 500 ms at target dataset after index tuning.

## RPO / RTO (planning, not SLA)
RPO ≤ 24 h, RTO ≤ 4 h for `operator-prod`, pending measured backup/restore drill (AC-REL-01).
