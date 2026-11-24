import Link from "next/link";
import { EmptyState, Kpi } from "@/components/ui";
import { formatCount, formatDateTime, formatFraction, formatPercentile, insufficientReason } from "@/lib/format";
import { qs } from "@/lib/query/params";
import type { Schemas } from "@/lib/server/data";
import type { Window } from "@/lib/time/window";

export function OverviewBody({ ov, service, neverIngested, w, base, onboardingHref }: { ov: Schemas["Overview"]; service?: string; neverIngested: boolean; w: Window; base: string; onboardingHref: string | null }) {
  const t = ov.totals;
  const n = t.population.sample_count;
  if (neverIngested) {
    return (
      <EmptyState state="empty-nodata" title="No data yet">
        TRACEFLOW has not received any spans. {onboardingHref ? <Link href={onboardingHref}>Connect an OpenTelemetry Collector</Link> : null}.
      </EmptyState>
    );
  }
  if (n === 0 && ov.trace_count === 0) {
    return (
      <EmptyState state="empty-window" title="No spans in this window">
        {service ? `No spans from ${service} between the selected times. ` : ""}Last span received{" "}
        {ov.freshness.last_span_received_at ? `${formatDateTime(ov.freshness.last_span_received_at)}` : "never"}. Try a longer range.
        {w.range !== "7d" && <> <Link href={`${base}${qs({ range: "7d", service })}`}>Show last 7 d</Link></>}
      </EmptyState>
    );
  }
  const ex = t.exemplars;
  const link = (tr: string | null, sp: string | null) => (tr ? `${base}/traces/${tr}${qs({ span: sp ?? undefined })}` : undefined);
  const pct = (key: "p50" | "p95" | "p99") => {
    const v = t.latency[key];
    return v === null ? { value: "—", note: insufficientReason(key, n) } : { value: formatPercentile(v), note: undefined };
  };
  return (
    <div data-testid="overview.kpis">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi testId="overview.kpi.requests" label="Requests" value={formatCount(t.request_count)} note="SERVER spans" />
        <Kpi testId="overview.kpi.error-rate" label="Error rate" value={formatFraction(t.error_fraction)} note={`${formatCount(t.error_count)} errors`} href={link(ex.latest_error_trace_id, ex.latest_error_span_id)} />
        <Kpi testId="overview.kpi.p50" label="p50" {...pct("p50")} />
        <Kpi testId="overview.kpi.p95" label="p95" {...pct("p95")} href={link(ex.slowest_trace_id, ex.slowest_span_id)} />
        <Kpi testId="overview.kpi.p99" label="p99" {...pct("p99")} />
        <Kpi testId="overview.kpi.traces" label="Traces" value={formatCount(ov.trace_count)} note="started in window" />
      </div>
      <p className="mt-2 text-xs text-ink-3" data-testid="overview.population">{t.population.note} n={formatCount(n)}.{ex.slowest_trace_id ? " “View example” under p95 opens the slowest request (server span)." : ""}</p>
    </div>
  );
}
