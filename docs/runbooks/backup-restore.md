# Runbook — Backup and restore (operator-prod)

**Status:** procedure written M6 (2026-11-25). Restore drill recorded below. Objectives are planning targets, not an SLA: **RPO ≤ 24 h, RTO ≤ 4 h** (capacity-profile.md).

## What is backed up
Both databases on the single PostgreSQL server:
- the trace database (`POSTGRES_DB`): spans, summaries, settings, audit;
- `traceflow_auth`: operator user, GitHub account link, sessions.

Logical dumps (`pg_dump --format=custom`). Roles and grants are **not** in the dump: they are recreated by the `migrate` job from `.env.production`.

## Encryption and key handling
- Backups are encrypted with [`age`](https://github.com/FiloSottile/age) to a **public** key (`AGE_RECIPIENT=age1…`). The server never holds the private key.
- Generate the key pair on an operator workstation: `age-keygen -o traceflow-backup.key` (prints the public key). Store the private key offline (password manager or hardware-backed storage). Losing it makes every backup unreadable.
- `age` must be installed on the server host (backup) and on the machine that restores.

## Daily backup
```bash
AGE_RECIPIENT=age1... BACKUP_DIR=/srv/traceflow-backups scripts/backup.sh
```
- Writes `traceflow-<db>-<UTC timestamp>.dump.age` per database; the name is only final after `pg_dump` and `age` both succeed.
- Schedule daily (cron or a systemd timer) → RPO ≤ 24 h.
- **Copy off-server** after each run (object storage, another host). A backup that only exists on the server does not survive losing the server.
- Prune old copies according to retention; backups contain up to `retention_days` of telemetry plus older data deleted since (privacy.md).

## Restore (clean host or fresh volume)
1. Provision the host; restore `compose.production.yaml`, `infra/`, `.env.production` (from your secret store) and pinned image tags.
2. Start only the database: `docker compose -f compose.production.yaml --env-file .env.production up -d --wait postgres`.
3. Restore both databases (refuses to overwrite a database that already holds spans unless `FORCE=1`):
   ```bash
   AGE_IDENTITY=~/traceflow-backup.key scripts/restore.sh traceflow-traceflow-<ts>.dump.age traceflow
   AGE_IDENTITY=~/traceflow-backup.key scripts/restore.sh traceflow-traceflow_auth-<ts>.dump.age traceflow_auth
   ```
4. Recreate roles and grants: `docker compose ... run --rm migrate` (idempotent). Restores use `--no-privileges`: the dump references cluster roles that do not exist on a fresh server (found by the M6 drill).
5. Start the rest: `docker compose ... up -d --wait`.
6. Verify: `/readyz` 200, span/trace counts match the backup's source (drill record), sign-in works, newest trace timestamp ≈ backup time.

## Drill record
See the M6 restore drill entry in `docs/workflow/integration-log.md` and the table below.

| Date | Source | Data | Dump | Restore | Counts match | Encryption | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-25 | local-dev stack (synthetic) | 24,121 spans, 3,770 traces, 1,255 ingestion records, 8 tables + auth DB; 2.27 MB dumps | < 1 s | 3 s (restore + migrate) | **yes**, all 8 tables; app role reads restored spans | **NOT TESTED** (age not installed on the drill host) | PASS for logical restore; first attempt FAILED (grants to missing roles) → fixed with `--no-privileges` |

RTO evidence is only for this small dataset; production-size restore time must be measured on the operator host before relying on the 4 h target.
