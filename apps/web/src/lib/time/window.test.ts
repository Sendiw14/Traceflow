import { describe, expect, it } from "vitest";
import { previousWindow, resolveWindow } from "./window";

describe("resolveWindow", () => {
  const now = 1_763_800_000_000; // ms
  it("defaults to 1h and resolves absolute ns", () => {
    const w = resolveWindow(undefined, now);
    expect(w.range).toBe("1h");
    expect(w.to).toBe(1_763_800_000_000_000_000n);
    expect(w.to - w.from).toBe(3_600_000_000_000n);
    expect(w.bucketSeconds).toBe(60);
    expect(w.notice).toBeUndefined();
  });
  it("falls back with a notice on invalid range", () => {
    const w = resolveWindow("30d", now);
    expect(w.range).toBe("1h");
    expect(w.notice).toMatch(/30d/);
  });
  it("uses the documented bucket sizes", () => {
    expect(resolveWindow("6h", now).bucketSeconds).toBe(300);
    expect(resolveWindow("7d", now).bucketSeconds).toBe(3600);
  });
  it("previous window is adjacent and equally long", () => {
    const w = resolveWindow("15m", now);
    const p = previousWindow(w);
    expect(p.to).toBe(w.from);
    expect(p.to - p.from).toBe(w.to - w.from);
  });
});

import { chooseBucket } from "./window";
describe("chooseBucket", () => {
  const now = 1_763_800_000_000;
  it("uses a valid request, else the window default", () => {
    expect(chooseBucket(resolveWindow("1h", now), "300")).toBe(300);
    expect(chooseBucket(resolveWindow("1h", now), "7")).toBe(60);
    expect(chooseBucket(resolveWindow("1h", now), undefined)).toBe(60);
  });
  it("never exceeds the 2000-point cap", () => {
    expect(chooseBucket(resolveWindow("7d", now), "60")).toBe(3600);
    expect(chooseBucket(resolveWindow("7d", now), "300")).toBe(3600);
    expect(chooseBucket(resolveWindow("7d", now), "900")).toBe(900);
  });
});
