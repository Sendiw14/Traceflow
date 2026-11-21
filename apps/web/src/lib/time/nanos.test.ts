import { describe, expect, it } from "vitest";
import { formatDuration, formatTimestampUTC, parseNanos } from "./nanos";

describe("nanos", () => {
  it("keeps full precision above 2^53", () => {
    expect(parseNanos("1763800000123456789")).toBe(1763800000123456789n);
    expect(BigInt(Number("1763800000123456789"))).not.toBe(1763800000123456789n); // why BigInt is required
  });
  it("rejects malformed values", () => {
    for (const bad of ["", "-1", "1.5", "1e9", "12345678901234567890", "abc"]) expect(() => parseNanos(bad)).toThrow(RangeError);
    expect(parseNanos("-5", { signed: true })).toBe(-5n);
  });
  it("formats timestamps in UTC with ms precision, truncating sub-ms", () => {
    expect(formatTimestampUTC("1763800000123456789")).toBe("2025-11-22 08:26:40.123 UTC");
    expect(formatTimestampUTC("999999")).toBe("1970-01-01 00:00:00.000 UTC");
  });
  it("formats durations with unit and truncation", () => {
    expect(formatDuration("0")).toBe("0 ns");
    expect(formatDuration("412000")).toBe("412 µs");
    expect(formatDuration("18499999")).toBe("18.4 ms");
    expect(formatDuration("2319999999")).toBe("2.31 s");
    expect(formatDuration("-1500000")).toBe("−1.50 ms");
  });
});
