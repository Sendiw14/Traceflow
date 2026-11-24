#!/bin/sh
# Lab Lighthouse runs against a running web server (default http://127.0.0.1:3100). Output: one JSON summary line per run.
# Usage: CHROME_PATH=<chrome binary> sh scripts/lighthouse.sh   (writes raw reports to $OUT, default /tmp/lh)
BASE=${BASE:-http://127.0.0.1:3100}; OUT=${OUT:-/tmp/lh}; mkdir -p "$OUT"
for preset in mobile desktop; do
  for path in / /docs /docs/getting-started /demo; do
    name=$(echo "$preset$path" | tr '/' '_')
    if [ "$preset" = desktop ]; then PRESET="--preset=desktop"; else PRESET=""; fi
    pnpm dlx lighthouse@12.8.2 "$BASE$path" $PRESET --only-categories=performance --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="$OUT/$name.json" --quiet >/dev/null 2>&1
    node -e '
      const r=require(process.argv[1]); const a=r.audits;
      console.log(JSON.stringify({preset:process.argv[2],path:process.argv[3],score:Math.round(r.categories.performance.score*100),lcp_ms:Math.round(a["largest-contentful-paint"].numericValue),cls:+a["cumulative-layout-shift"].numericValue.toFixed(3),tbt_ms:Math.round(a["total-blocking-time"].numericValue),fcp_ms:Math.round(a["first-contentful-paint"].numericValue),si_ms:Math.round(a["speed-index"].numericValue),ua:r.environment.networkUserAgent.slice(0,90),throttling:r.configSettings.throttlingMethod,lh:r.lighthouseVersion,formFactor:r.configSettings.formFactor}))' "$OUT/$name.json" "$preset" "$path"
  done
done
