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
