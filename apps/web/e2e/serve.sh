#!/bin/sh
# Builds once and serves the standalone app under several profiles (gating tests need all of them):
#   3100 local-dev (default for specs) · 3101 public-demo · 3102 operator-prod · 3103 profile unset · 3104 profile "bogus"
set -e
pnpm build
cp -R .next/static .next/standalone/apps/web/.next/static
[ -d public ] && cp -R public .next/standalone/apps/web/public
trap 'kill 0' EXIT TERM INT
start() { HOSTNAME=127.0.0.1 PORT="$1" node .next/standalone/apps/web/server.js & }
TRACEFLOW_PROFILE=public-demo start 3101
TRACEFLOW_PROFILE=operator-prod start 3102
env -u TRACEFLOW_PROFILE sh -c 'HOSTNAME=127.0.0.1 PORT=3103 node .next/standalone/apps/web/server.js' &
TRACEFLOW_PROFILE=bogus start 3104
TRACEFLOW_PROFILE=local-dev HOSTNAME=127.0.0.1 PORT=3100 node .next/standalone/apps/web/server.js
