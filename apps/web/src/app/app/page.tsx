import Link from "next/link";
import { Freshness } from "@/components/Freshness";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { RangeBar, SamplingCaveat, ServiceScope } from "@/components/Scope";
import { ServicesTable } from "@/components/ServicesTable";
import { TraceTable } from "@/components/TraceTable";
import { EmptyState, Kpi, Notice, PageHeader, Panel, ProblemState } from "@/components/ui";
import { formatClock, formatCount, formatDateTime, formatFraction, formatPercentile, insufficientReason } from "@/lib/format";
import { first, qs, type SearchParams } from "@/lib/query/params";
import { errorPoints, latencyPoints, throughputPoints } from "@/lib/series";
import { getIngestionStatus, getOverview, getServerLatency, listServices, type Schemas } from "@/lib/server/data";
import { resolveWindow, type Window } from "@/lib/time/window";

export const metadata = { title: "Overview" };

export default async function AppOverview({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const w = resolveWindow(first(sp.range));
  const service = first(sp.service) || undefined;
  const [ov, series, ing, svcs] = await Promise.all([
    getOverview(w.from, w.to, service),
    getServerLatency({ from: w.from, to: w.to, bucketSeconds: w.bucketSeconds, service }),
    getIngestionStatus(w.from, w.to),
    listServices(w.from, w.to),
  ]);
  const rangeQuery = qs({ range: w.range === "1h" ? undefined : w.range });
  const params = { service };

  return (
    <div data-testid="overview">
      <PageHeader title="Overview" testId="overview.header">
        <RangeBar base="/app" range={w.range} params={params} />
      </PageHeader>
      {w.notice && <Notice>{w.notice}</Notice>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ServiceScope action="/app" range={w.range} service={service} services={svcs.ok ? svcs.data.services.map((s) => s.service_name) : service ? [service] : []} />
        {ov.ok && <Freshness updated={formatClock(ov.data.freshness.generated_at)} lastSpan={ov.data.freshness.last_span_received_at ? formatClock(ov.data.freshness.last_span_received_at) : null} />}
      </div>

      {!ov.ok ? <ProblemState problem={ov.error} resetHref="/app" /> : (
        <OverviewBody ov={ov.data} service={service} neverIngested={ing.ok && ing.data.first_span_received_at === null} w={w} />
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {series.ok ? (
          <>
            <Panel title="Latency (SERVER spans)" id="lat" className="lg:col-span-2" testId="overview.latency-chart">
              <TimeSeriesChart name="latency" title="Latency percentiles" unit="duration" bucketSeconds={w.bucketSeconds}
                caption={`${w.bucketSeconds} s buckets · n=${formatCount(series.data.overall.population.sample_count)}`}
                series={[
                  { id: "p50", label: "p50", color: "var(--tf-signal)", points: latencyPoints(series.data.points, "p50") },
                  { id: "p95", label: "p95", color: "var(--tf-violet)", dash: "6 3", points: latencyPoints(series.data.points, "p95") },
                  { id: "p99", label: "p99", color: "var(--tf-ink-2)", dash: "2 3", points: latencyPoints(series.data.points, "p99") },
                ]} />
              <p className="mt-2 text-xs text-ink-3">{series.data.overall.population.note} Percentiles appear only when a bucket has enough samples (p95 ≥ 20, p99 ≥ 100).</p>
            </Panel>
            <Panel title="Error rate" id="err" testId="overview.error-chart">
              <TimeSeriesChart name="errors" title="Error rate (error SERVER spans / SERVER spans)" unit="percent" bucketSeconds={w.bucketSeconds} caption={`${w.bucketSeconds} s buckets`}
                series={[{ id: "err", label: "Error rate", color: "var(--tf-error)", points: errorPoints(series.data.points) }]} />
            </Panel>
            <Panel title="Throughput" id="thr" testId="overview.throughput-chart">
              <TimeSeriesChart name="throughput" title="Requests per second (SERVER spans)" unit="rate" bucketSeconds={w.bucketSeconds} caption={`${w.bucketSeconds} s buckets`}
                series={[{ id: "thr", label: "Requests/s", color: "var(--tf-signal-strong)", points: throughputPoints(series.data.points, w.bucketSeconds) }]} />
            </Panel>
          </>
        ) : (
          <div className="lg:col-span-2"><ProblemState problem={series.error} compact /></div>
        )}
      </div>

      <div className="mt-6 grid gap-4">
        {ov.ok && (
          <>
            <Panel title="Top services" id="top" testId="overview.top-services">
              {ov.data.top_services.length === 0 ? <p className="text-sm text-ink-2">No services with spans in this window.</p> :
                <ServicesTable services={ov.data.top_services} caption="Services ranked by SERVER request count" rangeQuery={rangeQuery} testId="overview.top-services.table" />}
            </Panel>
            <Panel title="Recent traces" id="recent" testId="overview.recent-traces">
              {ov.data.recent_traces.length === 0 ? <p className="text-sm text-ink-2">No traces started in this window.</p> :
                <TraceTable initial={ov.data.recent_traces} caption="Most recent traces" rangeQuery={rangeQuery} />}
              <p className="mt-3"><Link href={`/app/traces${qs({ range: w.range === "1h" ? undefined : w.range, service })}`}>Open the full trace list</Link></p>
            </Panel>
          </>
        )}
      </div>

      <Panel title="Ingestion health" id="health" className="mt-6" testId="overview.health">
        {!ing.ok ? <ProblemState problem={ing.error} compact /> : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-5">
            {([["Accepted", ing.data.spans_accepted], ["Duplicate", ing.data.spans_duplicate], ["Rejected", ing.data.spans_rejected], ["Conflicts", ing.data.spans_conflict], ["Received", ing.data.spans_received]] as const).map(([k, v]) => (
              <div key={k}><dt className="text-ink-3">{k}</dt><dd className="m-0 tabular-nums">{formatCount(v)}</dd></div>
            ))}
          </dl>
        )}
        {ing.ok && (
          <p className="mt-2 text-sm text-ink-3">
            {ing.data.last_request_at ? `Last ingest request ${formatDateTime(ing.data.last_request_at)}.` : "No ingest request has been received."}{" "}
            Counts are for the selected window. <Link href="/app/onboarding">Connection help</Link>
          </p>
        )}
      </Panel>
      <SamplingCaveat />
    </div>
  );
}

function OverviewBody({ ov, service, neverIngested, w }: { ov: Schemas["Overview"]; service?: string; neverIngested: boolean; w: Window }) {
  const t = ov.totals;
  const n = t.population.sample_count;
  if (neverIngested) {
    return (
      <EmptyState state="empty-nodata" title="No data yet">
        TRACEFLOW has not received any spans. <Link href="/app/onboarding">Connect an OpenTelemetry Collector</Link>.
      </EmptyState>
    );
  }
  if (n === 0 && ov.trace_count === 0) {
    return (
      <EmptyState state="empty-window" title="No spans in this window">
        {service ? `No spans from ${service} between the selected times. ` : ""}Last span received{" "}
        {ov.freshness.last_span_received_at ? `${formatDateTime(ov.freshness.last_span_received_at)}` : "never"}. Try a longer range.
        {w.range !== "7d" && <> <Link href={`/app${qs({ range: "7d", service })}`}>Show last 7 d</Link></>}
      </EmptyState>
    );
  }
  const ex = t.exemplars;
  const link = (tr: string | null, sp: string | null) => (tr ? `/app/traces/${tr}${qs({ span: sp ?? undefined })}` : undefined);
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
