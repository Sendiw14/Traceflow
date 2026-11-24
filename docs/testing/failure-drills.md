# Failure Drills (M6, 2026-11-25)

**Environment:** local-dev stack on the developer host (host-built binaries via a local-only Compose override; Collector 0.165.0, PostgreSQL 18.7). Synthetic `traffic` (5 scenarios every 15 s) ran throughout. Method: record every trace the gateway reported during [start, end+60 s recovery], then check each trace ID exists in `trace_summaries`; read Collector self-metrics (`otelcol_exporter_*`) before/after. Script kept outside the repo (scratchpad); results below are the actual output.

| Drill | Outage | Traces produced | Missing after recovery | Collector sent Δ | Send failed Δ | Enqueue failed (queue full) Δ | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PostgreSQL stopped | 31 s | 30 | **0** | 192 | 0 | 0 | PASS |
| trace-api stopped | 31 s | 30 | **0** | 224 | 0 | 0 | PASS |
| Collector restarted | restart | 20 | **0** | counter reset | 0 | 0 | PASS |
| Restore into clean server | — | 24,121 spans | 0 (counts match) | — | — | — | PASS (see backup-restore.md) |

How it behaves: during a PostgreSQL or trace-api outage the receiver answers 503 + `Retry-After` (or the connection fails); the Collector keeps spans in its bounded queue (capacity 50,000) and retries (`retry_on_failure`, max 300 s), so nothing was lost within 31 s. During a Collector restart the demo SDKs' batch exporters retried.

Findings fixed during the drills:
1. Collector self-metrics were bound to localhost inside the container (unreadable) → `service.telemetry.metrics.readers` on `0.0.0.0:8888`, internal `ingest` network only.
2. Restore failed on GRANTs to roles absent on a fresh cluster → restores use `--no-privileges`; `migrate` recreates roles.

Not covered: outages longer than the Collector retry window (300 s) or larger than queue capacity (data loss expected and counted as `send_failed`/`enqueue_failed`); disk-full; persistent Collector queue (not configured — queue is in memory, lost on Collector crash); production-size restore time; encrypted backup round trip.
