#!/bin/sh
# Builds once and serves the standalone app under several profiles (gating tests need all of them):
#   3100 local-dev (default for specs) · 3101 public-demo · 3102 operator-prod (fake valid auth env) · 3103 profile unset
#   3104 profile "bogus" · 3105 operator-prod without auth env (misconfigured)
set -e
pnpm build
cp -R .next/static .next/standalone/apps/web/.next/static
[ -d public ] && cp -R public .next/standalone/apps/web/public
trap 'kill 0' EXIT TERM INT
start() { HOSTNAME=127.0.0.1 PORT="$1" node .next/standalone/apps/web/server.js & }
TRACEFLOW_PROFILE=public-demo start 3101
# operator-prod with VALID but fake auth env: unreachable auth DB, fake GitHub app, so no real sign-in can succeed.
TRACEFLOW_PUBLIC_URL=https://traceflow.invalid TRACEFLOW_AUTH_SECRET=e2e-fake-auth-secret-0123456789abcdef TRACEFLOW_AUTH_DATABASE_URL=postgres://nobody:nothing@127.0.0.1:1/auth \
  GITHUB_CLIENT_ID=fake-client-id GITHUB_CLIENT_SECRET=fake-client-secret TRACEFLOW_OPERATOR_GITHUB_IDS=12345 TRACEFLOW_PROFILE=operator-prod start 3102
# operator-prod with NO auth env: misconfigured, must fail closed.
( unset TRACEFLOW_PUBLIC_URL TRACEFLOW_AUTH_SECRET TRACEFLOW_AUTH_DATABASE_URL GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET TRACEFLOW_OPERATOR_GITHUB_IDS; TRACEFLOW_PROFILE=operator-prod start 3105 )
env -u TRACEFLOW_PROFILE sh -c 'HOSTNAME=127.0.0.1 PORT=3103 node .next/standalone/apps/web/server.js' &
TRACEFLOW_PROFILE=bogus start 3104
TRACEFLOW_PROFILE=local-dev HOSTNAME=127.0.0.1 PORT=3100 node .next/standalone/apps/web/server.js
