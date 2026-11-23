import { describe, expect, it } from "vitest";
import { DASH, formatClock, formatCount, formatFraction, formatPercentile, insufficientReason } from "./format";

describe("format", () => {
  it("null fraction/percentile is a dash, never zero", () => {
    expect(formatFraction(null)).toBe(DASH);
    expect(formatPercentile(null)).toBe(DASH);
  });
  it("formats fractions", () => {
    expect(formatFraction(0)).toBe("0 %");
    expect(formatFraction(0.024)).toBe("2.40 %");
    expect(formatFraction(0.5)).toBe("50.0 %");
  });
  it("formats percentiles and counts", () => {
    expect(formatPercentile("18400000")).toBe("18.4 ms");
    expect(formatCount(1234567)).toBe("1,234,567");
  });
  it("explains insufficient samples", () => {
    expect(insufficientReason("p95", 12)).toBe("p95 needs 20 samples; this window has 12");
  });
  it("formats UTC clock", () => {
    expect(formatClock("1763800000123456789")).toBe("08:26:40");
  });
});
