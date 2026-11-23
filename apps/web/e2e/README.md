# End-to-end tests (real stack)

These tests drive the built app against a **real trace-api + PostgreSQL with live demo traces**. No fixtures stand in for ingestion.

1. Start the stack (repo root): `make env && make up` (Compose runs the demo services; the `traffic` service keeps traces flowing). Any other reachable trace-api with data works too.
2. Export what the web service itself uses (the BFF reads these on the server; the browser never sees them):
   `TRACE_API_URL=<trace-api query URL>` and `TRACEFLOW_SERVICE_TOKEN=<token from .env>`.
3. `pnpm test:e2e` builds the standalone server and starts it on `127.0.0.1:3100`. To test an already-running web instead: `E2E_BASE_URL=http://127.0.0.1:3000 pnpm test:e2e`.

Specs: `smoke` (no-store headers, nav, 404), `journeys` (BFF isolation, J-02, J-03 keyboard-only, J-04, filters/paging, missing-parent, analytics compare), `a11y` (axe WCAG 2.2 A/AA on every route and trace views), `mobile` (375 px reflow).
The harness reads trace-api from Node only to discover real fixtures (for example a trace with an error span); a missing fixture fails with instructions rather than skipping silently, except the missing-parent case which skips with a NOT TESTED reason.
