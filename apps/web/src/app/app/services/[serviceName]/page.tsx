import Link from "next/link";
import { EdgeTable } from "@/components/EdgeTable";
import { Freshness } from "@/components/Freshness";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { RangeBar, SamplingCaveat } from "@/components/Scope";
import { TraceTable } from "@/components/TraceTable";
import { Kpi, Notice, PageHeader, Panel, ProblemState } from "@/components/ui";
import { formatClock, formatCount, formatDateTime, formatFraction, formatPercentile, insufficientReason, shortId } from "@/lib/format";
import { decodeParam, first, qs, type SearchParams } from "@/lib/query/params";
import { errorPoints, latencyPoints } from "@/lib/series";
import { getService, getServerLatency, type Schemas } from "@/lib/server/data";
import { resolveWindow } from "@/lib/time/window";

export async function generateMetadata({ params }: { params: Promise<{ serviceName: string }> }) {
  return { title: decodeParam((await params).serviceName) };
}

function Exemplars({ ex, errors }: { ex: Schemas["ServerStats"]["exemplars"]; errors: string[] }) {
  const items: React.ReactNode[] = [];
  if (ex.slowest_trace_id) items.push(<Link key="s" href={`/app/traces/${ex.slowest_trace_id}${qs({ span: ex.slowest_span_id ?? undefined })}`}>slowest request</Link>);
  if (ex.latest_error_trace_id) items.push(<Link key="e" href={`/app/traces/${ex.latest_error_trace_id}${qs({ span: ex.latest_error_span_id ?? undefined })}`}>latest error</Link>);
  for (const t of errors.slice(0, 3)) items.push(<Link key={t} href={`/app/traces/${t}`} className="mono" aria-label={`Error trace ${t}`}>{shortId(t)}</Link>);
  return items.length === 0 ? <>—</> : <span className="flex flex-wrap gap-2">{items}</span>;
}

export default async function ServicePage({ params, searchParams }: { params: Promise<{ serviceName: string }>; searchParams: Promise<SearchParams> }) {
  const name = decodeParam((await params).serviceName);
  const sp = await searchParams;
  const w = resolveWindow(first(sp.range));
  const operation = first(sp.operation) || undefined;
  const rq = qs({ range: w.range === "1h" ? undefined : w.range });

  const [r, series, opSeries] = await Promise.all([
    getService(name, w.from, w.to),
    getServerLatency({ from: w.from, to: w.to, bucketSeconds: w.bucketSeconds, service: name }),
    operation ? getServerLatency({ from: w.from, to: w.to, bucketSeconds: w.bucketSeconds, service: name, operation }) : Promise.resolve(null),
  ]);

  if (!r.ok) {
    return (
      <div data-testid="service">
        <PageHeader title={name} />
        {r.error.code === "not_found" ? (
          <div role="status" className="rounded-md border border-dashed border-control bg-paper p-6" data-state="empty-nodata" data-testid="service.not-found">
            <p className="font-medium">No such service.</p>
            <p className="mt-1 text-sm text-ink-2">“{name}” has never been observed in retained data.</p>
            <p className="mt-3"><Link href="/app/services" className="btn">Back to services</Link></p>
          </div>
        ) : <ProblemState problem={r.error} resetHref={`/app/services${rq}`} />}
      </div>
    );
  }

  const d = r.data;
  const s = d.service;
  const n = s.server.population.sample_count;
  const pct = (k: "p50" | "p95" | "p99") => (s.server.latency[k] === null ? { value: "—", note: insufficientReason(k, n) } : { value: formatPercentile(s.server.latency[k]), note: undefined });
  return (
    <div data-testid="service">
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-ink-3"><Link href="/app/services">Services</Link> <span aria-hidden="true">/</span> <span aria-current="page">{name}</span></nav>
      <PageHeader title={name} testId="service.identity"><RangeBar base={`/app/services/${encodeURIComponent(name)}`} range={w.range} /></PageHeader>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-ink-3">Last observed {formatDateTime(s.last_observed_unix_nano)}</p>
        <Freshness updated={formatClock(d.freshness.generated_at)} lastSpan={d.freshness.last_span_received_at ? formatClock(d.freshness.last_span_received_at) : null} polling={false} />
      </div>
      {w.notice && <Notice>{w.notice}</Notice>}

      {!s.observed_in_window ? (
        <Notice kind="warn" testId="service.idle">No spans from this service in this window. {w.range !== "7d" && <Link href={`/app/services/${encodeURIComponent(name)}?range=7d`}>Show last 7 d</Link>}</Notice>
      ) : n === 0 ? (
        <Notice testId="service.no-server">This service has spans but no SERVER spans in this window, so request statistics are unavailable.</Notice>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-testid="service.summary">
          <Kpi testId="service.kpi.requests" label="Requests" value={formatCount(s.server.request_count)} note="SERVER spans" />
          <Kpi testId="service.kpi.error-rate" label="Error rate" value={formatFraction(s.server.error_fraction)} note={`${formatCount(s.server.error_count)} errors`} />
          <Kpi testId="service.kpi.p50" label="p50" {...pct("p50")} />
          <Kpi testId="service.kpi.p95" label="p95" {...pct("p95")} />
          <Kpi testId="service.kpi.p99" label="p99" {...pct("p99")} />
        </div>
      )}
      {n > 0 && <p className="mt-2 text-xs text-ink-3">{s.server.population.note} n={formatCount(n)}.</p>}

      <div className="mt-6 grid gap-4">
        {series.ok ? (
          <Panel title="Latency and errors" id="svc-lat" testId="service.latency-chart">
            <TimeSeriesChart name="svc-latency" title={`Latency percentiles — ${name}`} unit="duration" bucketSeconds={w.bucketSeconds} caption={`${w.bucketSeconds} s buckets · n=${formatCount(series.data.overall.population.sample_count)}`}
              series={[
                { id: "p50", label: "p50", color: "var(--tf-signal)", points: latencyPoints(series.data.points, "p50") },
                { id: "p95", label: "p95", color: "var(--tf-violet)", dash: "6 3", points: latencyPoints(series.data.points, "p95") },
                { id: "p99", label: "p99", color: "var(--tf-ink-2)", dash: "2 3", points: latencyPoints(series.data.points, "p99") },
              ]} />
            <div className="mt-4">
              <TimeSeriesChart name="svc-errors" title={`Error rate — ${name}`} unit="percent" bucketSeconds={w.bucketSeconds} caption={`${w.bucketSeconds} s buckets`}
                series={[{ id: "err", label: "Error rate", color: "var(--tf-error)", points: errorPoints(series.data.points) }]} />
            </div>
          </Panel>
        ) : <ProblemState problem={series.error} compact />}

        <Panel title="Operations" id="ops" testId="service.operations">
          {d.operations.length === 0 ? <p className="text-sm text-ink-2">No SERVER operations in this window.</p> : (
            <div className="overflow-x-auto">
              <table className="data stack" data-testid="service.operations.table">
                <caption>Operations (SERVER spans) · slowest request means the slowest server span</caption>
                <thead><tr><th scope="col">Operation</th><th scope="col" className="num">Requests</th><th scope="col" className="num">Error rate</th><th scope="col" className="num">p50</th><th scope="col" className="num">p95</th><th scope="col" className="num">p99</th><th scope="col" className="num">Samples</th><th scope="col">Evidence</th></tr></thead>
                <tbody>
                  {d.operations.map((o) => (
                    <tr key={o.name} data-testid="service.operations.row">
                      <td data-label="Operation"><Link href={`/app/services/${encodeURIComponent(name)}${qs({ range: w.range === "1h" ? undefined : w.range, operation: o.name })}#op-chart`} aria-label={`Show latency for ${o.name}`}>{o.name}</Link></td>
                      <td data-label="Requests" className="num">{formatCount(o.server.request_count)}</td>
                      <td data-label="Error rate" className="num">{formatFraction(o.server.error_fraction)}</td>
                      {(["p50", "p95", "p99"] as const).map((k) => <td key={k} data-label={k} className="num" title={o.server.latency[k] === null ? insufficientReason(k, o.server.population.sample_count) : undefined}>{formatPercentile(o.server.latency[k])}</td>)}
                      <td data-label="Samples" className="num">{formatCount(o.server.population.sample_count)}</td>
                      <td data-label="Evidence"><Exemplars ex={o.server.exemplars} errors={o.sample_error_trace_ids} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {operation && (
            <div id="op-chart" className="mt-4" data-testid="service.operation-chart">
              {opSeries && opSeries.ok ? (
                <TimeSeriesChart name="op-latency" title={`Latency — ${operation}`} unit="duration" bucketSeconds={w.bucketSeconds} caption={`n=${formatCount(opSeries.data.overall.population.sample_count)}`}
                  series={[
                    { id: "p50", label: "p50", color: "var(--tf-signal)", points: latencyPoints(opSeries.data.points, "p50") },
                    { id: "p95", label: "p95", color: "var(--tf-violet)", dash: "6 3", points: latencyPoints(opSeries.data.points, "p95") },
                  ]} />
              ) : opSeries ? <ProblemState problem={opSeries.error} compact /> : null}
              <p className="mt-2"><Link href={`/app/services/${encodeURIComponent(name)}${rq}`}>Hide operation chart</Link></p>
            </div>
          )}
        </Panel>

        <Panel title="Downstream (calls from this service)" id="down" testId="service.downstream">
          {d.downstream.length === 0 ? <p className="text-sm text-ink-2">No cross-service parent→child spans observed from this service in this window. This does not prove it makes no calls.</p> :
            <EdgeTable edges={d.downstream} caption="Downstream dependencies (observed parent→child spans)" testId="service.edges.downstream" />}
        </Panel>
        <Panel title="Upstream (calls into this service)" id="up" testId="service.upstream">
          {d.upstream.length === 0 ? <p className="text-sm text-ink-2">No cross-service parent→child spans observed into this service in this window.</p> :
            <EdgeTable edges={d.upstream} caption="Upstream callers (observed parent→child spans)" testId="service.edges.upstream" />}
        </Panel>

        <Panel title="Recent traces" id="svc-traces" testId="service.traces">
          {d.recent_traces.length === 0 ? <p className="text-sm text-ink-2">No traces for this service in this window.</p> :
            <TraceTable initial={d.recent_traces} caption={`Recent traces involving ${name}`} rangeQuery={rq} />}
          <p className="mt-3"><Link href={`/app/traces${qs({ service: name, range: w.range === "1h" ? undefined : w.range })}`}>Open filtered trace list</Link></p>
        </Panel>
      </div>
      <SamplingCaveat />
    </div>
  );
}
