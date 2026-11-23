// Adapters: API latency series → chart series (pure, tested).
import type { ChartPoint } from "@/lib/chart";
import type { Schemas } from "@/lib/server/data";

const toMs = (ns: string) => Number(BigInt(ns) / 1_000_000n);

export function latencyPoints(points: Schemas["LatencyPoint"][], key: "p50" | "p95" | "p99"): ChartPoint[] {
  return points.map((p) => ({ t: toMs(p.bucket_start_unix_nano), partial: p.partial, v: p.stats?.latency[key] == null ? null : Number(p.stats.latency[key]) }));
}
export function errorPoints(points: Schemas["LatencyPoint"][]): ChartPoint[] {
  return points.map((p) => ({ t: toMs(p.bucket_start_unix_nano), partial: p.partial, v: p.stats?.error_fraction ?? null }));
}
export function throughputPoints(points: Schemas["LatencyPoint"][], bucketSeconds: number): ChartPoint[] {
  return points.map((p) => ({ t: toMs(p.bucket_start_unix_nano), partial: p.partial, v: p.stats ? p.stats.request_count / bucketSeconds : null }));
}
