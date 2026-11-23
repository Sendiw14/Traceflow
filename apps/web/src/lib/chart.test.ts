import { describe, expect, it } from "vitest";
import { linearScale, niceTicks, segments } from "./chart";

describe("chart helpers", () => {
  it("splits at null buckets and excludes partial buckets from lines", () => {
    const s = segments([
      { t: 1, v: 1 }, { t: 2, v: 2 }, { t: 3, v: null }, { t: 4, v: 4 }, { t: 5, v: 5, partial: true },
    ]);
    expect(s.map((x) => x.map((p) => p.t))).toEqual([[1, 2], [4]]);
  });
  it("scales linearly", () => {
    const f = linearScale(0, 10, 0, 100);
    expect(f(5)).toBe(50);
  });
  it("produces 1-2-5 ticks covering max", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    const t = niceTicks(87);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]!).toBeGreaterThanOrEqual(87);
    expect(t).toEqual([0, 50, 100]);
  });
});
