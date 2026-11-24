#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Runs the README quickstart verbatim: every ```bash block between the quickstart markers.
# CI uses this instead of its own setup commands, so the README cannot drift from reality.
set -euo pipefail
cmds=$(awk '
  /<!-- quickstart:start/ {in_qs=1; next}
  /<!-- quickstart:end/   {in_qs=0}
  in_qs && /^```bash$/ {in_code=1; next}
  in_qs && /^```$/     {in_code=0; next}
  in_qs && in_code     {print}
' README.md)
[ -n "$cmds" ] || { echo "no quickstart commands found in README.md" >&2; exit 1; }
printf '%s\n' "--- README quickstart commands ---" "$cmds" "---"
bash -euo pipefail -c "$cmds"
