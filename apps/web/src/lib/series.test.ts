import { describe, expect, it } from "vitest";
import { errorPoints, latencyPoints, throughputPoints } from "./series";

const pts = [
  { bucket_start_unix_nano: "1763800000000000000", partial: false, stats: { sample_count: 10, request_count: 120, error_count: 3, error_fraction: 0.025, latency: { p50: "1000000", p95: null, p99: null } } },
  { bucket_start_unix_nano: "1763800060000000000", partial: false, stats: null },
  { bucket_start_unix_nano: "1763800120000000000", partial: true, stats: { sample_count: 1, request_count: 6, error_count: 0, error_fraction: 0, latency: { p50: "2000000", p95: null, p99: null } } },
];

describe("series adapters", () => {
  it("maps null stats and null percentiles to gaps", () => {
    const p95 = latencyPoints(pts, "p95");
    expect(p95.map((p) => p.v)).toEqual([null, null, null]);
    expect(latencyPoints(pts, "p50").map((p) => p.v)).toEqual([1_000_000, null, 2_000_000]);
  });
  it("keeps the partial flag and ms timestamps", () => {
    expect(latencyPoints(pts, "p50")[2]).toMatchObject({ partial: true, t: 1_763_800_120_000 });
  });
  it("error fraction is not zero-filled for empty buckets", () => {
    expect(errorPoints(pts).map((p) => p.v)).toEqual([0.025, null, 0]);
  });
  it("throughput is requests per second", () => {
    expect(throughputPoints(pts, 60).map((p) => p.v)).toEqual([2, null, 0.1]);
  });
});
