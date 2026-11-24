import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// public-demo does not serve ingestion status or settings (api-contract R-17), so demo code must never call them.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : [p]; });
}
const root = new URL("../../", import.meta.url).pathname;
const demoFiles = [
  ...files(join(root, "app/demo")).filter((f) => !f.endsWith(".test.ts")),
  join(root, "components/trace/TraceDetail.tsx"),
  join(root, "components/overview/OverviewBody.tsx"),
  join(root, "components/overview/LatencyPanels.tsx"),
];
const FORBIDDEN = ["getIngestionStatus", "getSettings", "updateSettings", "updateRetention", "/app/settings", "/app/onboarding", "/login"];

describe("demo isolation", () => {
  for (const f of demoFiles) {
    it(`${f.slice(root.length)} references no ingestion/settings/admin/login`, () => {
      const src = readFileSync(f, "utf8");
      for (const word of FORBIDDEN) expect(src, word).not.toContain(word);
    });
  }
});
