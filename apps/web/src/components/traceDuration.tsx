import { formatDuration, parseNanos } from "@/lib/time/nanos";
import type { Schemas } from "@/lib/server/data";
import { Badge } from "./ui";

/** Shared by server and client components (no "use client"). `≈` marks an observed-range estimate; negative = clock skew. */
export function traceDuration(t: Schemas["TraceSummary"]) {
  const v = parseNanos(t.duration.value_nano, { signed: true });
  if (v < 0n) return <Badge tone="warn">clock skew</Badge>;
  const est = t.duration.basis === "observed_range_estimate";
  return <span title={est ? "Estimate from observed span range (no single root span)" : "Root span duration"}>{est ? "≈ " : ""}{formatDuration(v)}</span>;
}
