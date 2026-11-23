import { describe, expect, it } from "vitest";
import { isSpanId, isTraceId, parseMinDuration, parseTraceFilters, qs } from "./params";

describe("parseMinDuration", () => {
  it("converts units to ns", () => {
    expect(parseMinDuration("250ms")).toBe(250_000_000n);
    expect(parseMinDuration("2s")).toBe(2_000_000_000n);
    expect(parseMinDuration("500us")).toBe(500_000n);
  });
  it("rejects garbage", () => {
    for (const v of ["", "ms", "1.5s", "-1s", "10m", "1e3ms", undefined]) expect(parseMinDuration(v)).toBeUndefined();
  });
});

describe("parseTraceFilters", () => {
  it("defaults", () => {
    const f = parseTraceFilters({}, 1_763_800_000_000);
    expect(f.status).toBe("any");
    expect(f.service).toBeUndefined();
    expect(f.notices).toEqual([]);
  });
  it("reports invalid values and uses defaults", () => {
    const f = parseTraceFilters({ status: "bogus", range: "9y", min_duration: "x" });
    expect(f.status).toBe("any");
    expect(f.minDuration).toBeUndefined();
    expect(f.notices).toHaveLength(3);
  });
  it("keeps valid values", () => {
    const f = parseTraceFilters({ status: "error", service: "orders", min_duration: "1s", range: "6h" });
    expect(f).toMatchObject({ status: "error", service: "orders", minDuration: "1s" });
    expect(f.window.range).toBe("6h");
  });
});

describe("qs / ids", () => {
  it("drops empty values and encodes", () => {
    expect(qs({ a: "x y", b: undefined, c: "" })).toBe("?a=x+y");
    expect(qs({})).toBe("");
  });
  it("validates trace and span ids", () => {
    expect(isTraceId("a".repeat(32))).toBe(true);
    expect(isTraceId("A".repeat(32))).toBe(false);
    expect(isSpanId("0123456789abcdef")).toBe(true);
    expect(isSpanId("xyz")).toBe(false);
  });
});
