import { defineConfig } from "@playwright/test";

// Journeys run against the REAL stack: trace-api + Postgres with live demo traces (compose + `traffic`, or any
// trace-api reachable via TRACE_API_URL / TRACEFLOW_SERVICE_TOKEN). Set E2E_BASE_URL to test an already-running web.
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: { baseURL },
  webServer: external
    ? undefined
    : {
        command: "sh e2e/serve.sh",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
