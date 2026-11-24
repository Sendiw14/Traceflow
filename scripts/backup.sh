#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Encrypted logical backup of both TRACEFLOW databases (trace data + auth sessions).
# pg_dump (custom format) streams through `age` to a public key: the decryption key never
# lives on the server. Copy the output off-server (docs/runbooks/backup-restore.md).
#
#   AGE_RECIPIENT=age1... scripts/backup.sh            # uses compose.production.yaml + .env.production
#   BACKUP_DIR=/srv/backups COMPOSE_FILE=... ENV_FILE=... scripts/backup.sh
# shellcheck disable=SC2016  # single-quoted scripts expand inside the postgres container
set -euo pipefail

: "${AGE_RECIPIENT:?set AGE_RECIPIENT to the age public key (age1...)}"
command -v age >/dev/null || { echo "age is required on the host (https://github.com/FiloSottile/age)" >&2; exit 1; }
BACKUP_DIR=${BACKUP_DIR:-./backups}
COMPOSE_FILE=${COMPOSE_FILE:-compose.production.yaml}
ENV_FILE=${ENV_FILE:-.env.production}
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

dc() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }
trace_db=$(dc exec -T postgres sh -c 'printf %s "$POSTGRES_DB"')
ts=$(date -u +%Y%m%dT%H%M%SZ)

for db in "$trace_db" traceflow_auth; do
  out="$BACKUP_DIR/traceflow-$db-$ts.dump.age"
  # Write to a temporary name and rename only after pg_dump and age both succeed (pipefail).
  dc exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$1" --format=custom --compress=6' _ "$db" \
    | age -r "$AGE_RECIPIENT" > "$out.partial"
  test -s "$out.partial"
  mv "$out.partial" "$out"
  echo "wrote $out ($(wc -c < "$out") bytes)"
done
