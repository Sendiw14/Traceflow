import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLLECTOR_YAML } from "./collector-config";

describe("docs Collector config", () => {
  it("is identical to infra/otel/collector.yaml", () => {
    const repo = readFileSync(new URL("../../../../infra/otel/collector.yaml", import.meta.url), "utf8");
    expect(COLLECTOR_YAML).toBe(repo);
  });
});
