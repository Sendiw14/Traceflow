# Privacy & Data Lifecycle (M1 draft)

**Status:** DRAFT. No compliance certification (GDPR, SOC 2, HIPAA, …) is claimed. Owner decision U-02: no third-party personal data in V1 operator data.

## Collection
Only OTLP trace data that producers send. TRACEFLOW does not collect request bodies; demo services must not record bodies.

## Redaction before persistence (two layers)
1. **Collector** `attributes`/`redaction` processor (exact processor chosen at M2 from pinned release): delete keys matching denylist below; hash nothing by default.
2. **Go normalize** denylist (defence in depth), applied to span, event, link and resource attributes:
   - Keys (case-insensitive, substring): `authorization`, `cookie`, `set-cookie`, `password`, `passwd`, `secret`, `token`, `api_key`, `apikey`, `session`, `x-api-key`, `http.request.body`, `http.response.body`, `db.statement` params (keep statement, strip bound values where exposed separately).
   - `http.request.header.*` / `http.response.header.*`: keep only allowlist (`content-type`, `content-length`, `user-agent`, `accept`).
   - Redacted values replaced with `"[REDACTED]"`. Counted in a separate `spans_redacted_attributes_total` metric, not in `dropped_attributes_count`, so drops and redactions stay distinguishable.
3. Policy configurable; defaults safe; changes logged in `settings_audit`.

## Retention and deletion
- Configurable retention (`retention_days`, default 7 local-dev, 1 public-demo).
- Manual purge of a single trace: V2+ (not in V1 UI). Operator can delete via documented SQL runbook.
- Backups (operator-prod) inherit retention up to backup age; backup retention documented in `docs/runbooks/backup-restore.md` (M6).

## Display
Attribute values rendered as text with control characters made visible; no link auto-detection of attribute values.

## Before accepting real third-party data
Legal/jurisdictional review, data-subject request process and DPA considerations — out of V1 scope; required change-control record.
