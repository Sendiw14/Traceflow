import Link from "next/link";
import { Freshness } from "@/components/Freshness";
import { Histogram } from "@/components/charts/Histogram";
import { TimeSeriesChart, type ChartSeries } from "@/components/charts/TimeSeriesChart";
import { RangeBar, SamplingCaveat } from "@/components/Scope";
import { EmptyState, Notice, PageHeader, Panel, ProblemState } from "@/components/ui";
import { formatClock, formatCount, formatDateTime, formatFraction, formatPercentile, insufficientReason, shortId } from "@/lib/format";
import { first, qs, type SearchParams } from "@/lib/query/params";
import { errorPoints, latencyPoints, shiftPoints } from "@/lib/series";
import { getIngestionStatus, getLatencyDistribution, getService, getServerLatency, listServices } from "@/lib/server/data";
import { BUCKETS, chooseBucket, previousWindow, resolveWindow } from "@/lib/time/window";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const w = resolveWindow(first(sp.range));
  const service = first(sp.service) || undefined;
  const operation = service ? first(sp.operation) || undefined : undefined;
  const bucket = chooseBucket(w, first(sp.bucket));
  const compare = first(sp.compare) === "1";
  const prev = previousWindow(w);
  const base = { service, operation };

  const [series, prevSeries, dist, svcs, svc, ing] = await Promise.all([
    getServerLatency({ from: w.from, to: w.to, bucketSeconds: bucket, ...base }),
    compare ? getServerLatency({ from: prev.from, to: prev.to, bucketSeconds: bucket, ...base }) : Promise.resolve(null),
    getLatencyDistribution({ from: w.from, to: w.to, ...base }),
    listServices(w.from, w.to),
    service ? getService(service, w.from, w.to) : Promise.resolve(null),
    getIngestionStatus(w.from, w.to),
  ]);
  const names = svcs.ok ? svcs.data.services.map((s) => s.service_name) : service ? [service] : [];
  const options = service && !names.includes(service) ? [service, ...names] : names;
  const ops = svc && svc.ok ? svc.data.operations.map((o) => o.name) : operation ? [operation] : [];
  const rangeParam = w.range === "1h" ? undefined : w.range;
  const reset = `/app/analytics${qs({ range: rangeParam })}`;

  const lines: ChartSeries[] = [];
  if (series.ok) {
    lines.push({ id: "p50", label: "p50", color: "var(--tf-signal)", points: latencyPoints(series.data.points, "p50") });
    lines.push({ id: "p95", label: "p95", color: "var(--tf-violet)", dash: "6 3", points: latencyPoints(series.data.points, "p95") });
    lines.push({ id: "p99", label: "p99", color: "var(--tf-ink-2)", dash: "2 3", points: latencyPoints(series.data.points, "p99") });
    if (prevSeries && prevSeries.ok) {
      const shift = Number((w.to - w.from) / 1_000_000n);
      lines.push({ id: "p50-prev", label: "p50 (previous period)", color: "var(--tf-control-border)", points: shiftPoints(latencyPoints(prevSeries.data.points, "p50"), shift) });
      lines.push({ id: "p95-prev", label: "p95 (previous period)", color: "var(--tf-warning-fill)", dash: "6 3", points: shiftPoints(latencyPoints(prevSeries.data.points, "p95"), shift) });
    }
  }
  const n = series.ok ? series.data.overall.population.sample_count : 0;
  const scopeLabel = `${service ?? "all services"}${operation ? ` · ${operation}` : ""}`;

  return (
    <div data-testid="analytics">
      <PageHeader title="Analytics"><RangeBar base="/app/analytics" range={w.range} params={{ service, operation, bucket: first(sp.bucket), compare: compare ? "1" : undefined }} /></PageHeader>
      {w.notice && <Notice>{w.notice}</Notice>}
      <form action="/app/analytics" method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-paper p-3" data-testid="analytics.scope" aria-label="Analytics scope">
        {w.range !== "1h" && <input type="hidden" name="range" value={w.range} />}
        <div className="flex flex-col gap-1"><label htmlFor="a-service" className="text-sm text-ink-3">Service</label>
          <select id="a-service" name="service" defaultValue={service ?? ""} className="field"><option value="">All services</option>{options.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div className="flex flex-col gap-1"><label htmlFor="a-op" className="text-sm text-ink-3">Operation</label>
          <select id="a-op" name="operation" defaultValue={operation ?? ""} className="field" disabled={!service}><option value="">All operations</option>{ops.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
        <div className="flex flex-col gap-1"><label htmlFor="a-bucket" className="text-sm text-ink-3">Bucket</label>
          <select id="a-bucket" name="bucket" defaultValue={String(bucket)} className="field">{BUCKETS.map((b) => <option key={b} value={b}>{b >= 3600 ? `${b / 3600} h` : `${b / 60} min`}</option>)}</select></div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="compare" value="1" defaultChecked={compare} data-testid="analytics.compare" /> Compare with previous period</label>
        <button type="submit" className="btn btn-primary">Apply</button>
        {(service || compare || first(sp.bucket)) && <Link href={reset} className="btn">Reset</Link>}
      </form>
      {service && svc && !svc.ok && svc.error.code === "not_found" && <Notice kind="warn">Service “{service}” has never been observed in retained data.</Notice>}

      {!series.ok ? <ProblemState problem={series.error} resetHref={reset} /> : (
        <>
          <div className="mb-3 flex justify-end">
            <Freshness updated={formatClock(series.data.freshness.generated_at)} lastSpan={series.data.freshness.last_span_received_at ? formatClock(series.data.freshness.last_span_received_at) : null} polling={false} />
          </div>
          {n === 0 ? (
            ing.ok && ing.data.first_span_received_at === null ? (
              <EmptyState state="empty-nodata" title="No data yet">TRACEFLOW has not received any spans. <Link href="/app/onboarding">Connect an OpenTelemetry Collector</Link>.</EmptyState>
            ) : (
              <EmptyState state="empty-window" title="No SERVER spans in this window">
                {scopeLabel}. Last span received {series.data.freshness.last_span_received_at ? formatDateTime(series.data.freshness.last_span_received_at) : "never"}. Try a longer range.
              </EmptyState>
            )
          ) : (
            <div className="grid gap-4">
              <Panel title="Latency over time" id="al" testId="analytics.series">
                <TimeSeriesChart name="analytics-latency" title={`Latency percentiles — ${scopeLabel}`} unit="duration" bucketSeconds={bucket}
                  caption={`SERVER spans · ${bucket >= 3600 ? `${bucket / 3600} h` : `${bucket / 60} min`} buckets · n=${formatCount(n)}`} series={lines} />
                {prevSeries && !prevSeries.ok && <Notice kind="warn">Previous-period data failed to load: {prevSeries.error.title}.</Notice>}
                <p className="mt-2 text-xs text-ink-3">{series.data.overall.population.note} Gaps mean no samples or too few for that percentile; nothing is interpolated.</p>
              </Panel>
              <Panel title="Error rate over time" id="ae">
                <TimeSeriesChart name="analytics-errors" title={`Error rate — ${scopeLabel}`} unit="percent" bucketSeconds={bucket} caption="error SERVER spans / SERVER spans"
                  series={[{ id: "err", label: "Error rate", color: "var(--tf-error)", points: errorPoints(series.data.points) }]} />
              </Panel>
              <Panel title="Percentile summary" id="ps" testId="analytics.percentiles">
                <table className="data" data-testid="analytics.percentiles.table">
                  <caption className="sr-only">Percentiles over the whole window</caption>
                  <thead><tr><th scope="col">Percentile</th><th scope="col" className="num">Value</th><th scope="col">Note</th></tr></thead>
                  <tbody>{(["p50", "p95", "p99"] as const).map((k) => (
                    <tr key={k}><th scope="row" className="font-normal">{k}</th><td className="num">{formatPercentile(series.data.overall.latency[k])}</td><td>{series.data.overall.latency[k] === null ? insufficientReason(k, n) : "nearest-rank"}</td></tr>
                  ))}</tbody>
                </table>
              </Panel>
              <Panel title="Latency distribution" id="dist" testId="analytics.distribution">
                {dist.ok ? (
                  <>
                    <Histogram title={`Latency distribution — ${scopeLabel}`} caption={`n=${formatCount(dist.data.population.sample_count)}`} bins={dist.data.buckets.map((b) => ({ lower: b.lower_nano, upper: b.upper_nano, count: b.count }))} />
                    <p className="mt-2 text-xs text-ink-3">{dist.data.population.note}{dist.data.excluded_negative_duration > 0 ? ` ${formatCount(dist.data.excluded_negative_duration)} spans with negative duration (clock skew) are excluded from the buckets.` : ""}</p>
                  </>
                ) : <ProblemState problem={dist.error} compact />}
              </Panel>
              <Panel title="Error breakdown" id="eb" testId="analytics.errors">
                {svc && svc.ok ? (
                  <ErrorTable caption={`Errors by operation in ${service}`} first="Operation" rows={svc.data.operations.map((o) => ({ key: o.name, label: o.name, errors: o.server.error_count, fraction: o.server.error_fraction, requests: o.server.request_count, traces: o.sample_error_trace_ids }))} />
                ) : svcs.ok ? (
                  <ErrorTable caption="Errors by service" first="Service" rows={svcs.data.services.map((s) => ({ key: s.service_name, label: s.service_name, href: `/app/services/${encodeURIComponent(s.service_name)}`, errors: s.server.error_count, fraction: s.server.error_fraction, requests: s.server.request_count, traces: s.sample_error_trace_ids }))} />
                ) : <ProblemState problem={svcs.error} compact />}
              </Panel>
              <Panel title="Sample counts" id="sc" testId="analytics.sample-counts">
                <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-4">
                  <div><dt className="text-ink-3">SERVER spans (n)</dt><dd className="m-0 tabular-nums">{formatCount(n)}</dd></div>
                  <div><dt className="text-ink-3">Errors</dt><dd className="m-0 tabular-nums">{formatCount(series.data.overall.error_count)}</dd></div>
                  <div><dt className="text-ink-3">Status unset</dt><dd className="m-0 tabular-nums">{formatCount(series.data.overall.unset_status_count ?? 0)}</dd></div>
                  <div><dt className="text-ink-3">Excluded (clock skew)</dt><dd className="m-0 tabular-nums">{dist.ok ? formatCount(dist.data.excluded_negative_duration) : "—"}</dd></div>
                </dl>
              </Panel>
            </div>
          )}
        </>
      )}
      <p className="mt-6 text-xs text-ink-3" data-testid="analytics.source">Source: observed SERVER spans · sampled data is not reconstructed.</p>
      <SamplingCaveat />
    </div>
  );
}

function ErrorTable({ caption, first, rows }: { caption: string; first: string; rows: { key: string; label: string; href?: string; errors: number; fraction: number | null; requests: number; traces: string[] }[] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-2">No rows.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="data stack" data-testid="analytics.errors.table">
        <caption>{caption}</caption>
        <thead><tr><th scope="col">{first}</th><th scope="col" className="num">Errors</th><th scope="col" className="num">Error rate</th><th scope="col" className="num">Requests</th><th scope="col">Recent error traces</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.key}>
            <td data-label={first}>{r.href ? <Link href={r.href}>{r.label}</Link> : r.label}</td>
            <td data-label="Errors" className="num">{formatCount(r.errors)}</td>
            <td data-label="Error rate" className="num">{formatFraction(r.fraction)}</td>
            <td data-label="Requests" className="num">{formatCount(r.requests)}</td>
            <td data-label="Recent error traces">{r.traces.length === 0 ? "—" : <span className="flex flex-wrap gap-2">{r.traces.map((t) => <Link key={t} href={`/app/traces/${t}`} className="mono" aria-label={`Error trace ${t}`}>{shortId(t)}</Link>)}</span>}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
