#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Restore one encrypted TRACEFLOW backup into a database of a running stack.
# Intended for a CLEAN target (fresh volume): it refuses to overwrite a database that
# already contains spans unless FORCE=1. Run the `migrate` job afterwards to (re)create
# runtime roles and grants. Procedure and drill record: docs/runbooks/backup-restore.md.
#
#   AGE_IDENTITY=~/keys/traceflow.age scripts/restore.sh backups/traceflow-traceflow-<ts>.dump.age traceflow
# shellcheck disable=SC2016  # single-quoted scripts expand inside the postgres container
set -euo pipefail

backup=${1:?usage: restore.sh <file.dump.age> <database>}
db=${2:?usage: restore.sh <file.dump.age> <database>}
[[ "$db" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || { echo "invalid database name: $db" >&2; exit 1; }  # also keeps it safe inside SQL below
: "${AGE_IDENTITY:?set AGE_IDENTITY to the age private key file}"
command -v age >/dev/null || { echo "age is required on the host" >&2; exit 1; }
COMPOSE_FILE=${COMPOSE_FILE:-compose.production.yaml}
ENV_FILE=${ENV_FILE:-.env.production}
dc() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

exists=$(dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '"'"'$1'"'"'"' _ "$db" | tr -d '[:space:]' || true)
if [ "$exists" = "1" ] && [ "${FORCE:-0}" != "1" ]; then
  has=$(dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$1" -Atc "SELECT to_regclass('"'"'public.spans'"'"') IS NOT NULL AND EXISTS (SELECT 1 FROM spans)"' _ "$db" | tr -d '[:space:]' || true)
  if [ "$has" = "t" ]; then
    echo "refusing: database $db already contains spans (set FORCE=1 to restore over it)" >&2
    exit 1
  fi
fi
[ "$exists" = "1" ] || dc exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" "$1"' _ "$db"

start=$(date +%s)
age -d -i "$AGE_IDENTITY" "$backup" \
  | dc exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --no-privileges --exit-on-error' _ "$db"
echo "restored $backup into $db in $(( $(date +%s) - start ))s; now run: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE run --rm migrate"
