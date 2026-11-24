import Link from "next/link";
import { EdgeTable } from "@/components/EdgeTable";
import { Freshness } from "@/components/Freshness";
import { LatencyPanels } from "@/components/overview/LatencyPanels";
import { OverviewBody } from "@/components/overview/OverviewBody";
import { RangeBar, SamplingCaveat } from "@/components/Scope";
import { ServicesTable } from "@/components/ServicesTable";
import { TraceTable } from "@/components/TraceTable";
import { EmptyState, Kpi, Notice, PageHeader, Panel, ProblemState } from "@/components/ui";
import { formatClock, formatCount, formatDateTime, formatFraction, formatPercentile, insufficientReason, shortId } from "@/lib/format";
import { parseMinDuration, parseTraceFilters, qs, type SearchParams } from "@/lib/query/params";
import { getOverview, getService, getServerLatency, listServices, listTraces } from "@/lib/server/data";

export const metadata = { title: "Live demo" };

// Calls only endpoints the public-demo profile exposes: overview, server-latency, services, service, traces.
export default async function DemoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const f = parseTraceFilters(sp);
  const w = f.window;
  const rangeParam = w.range === "1h" ? undefined : w.range;
  const rangeQuery = qs({ range: rangeParam });
  const service = f.service;
  const min = f.minDuration ? parseMinDuration(f.minDuration) : undefined;

  const [ov, series, svcs, traces, svc] = await Promise.all([
    getOverview(w.from, w.to, service),
    getServerLatency({ from: w.from, to: w.to, bucketSeconds: w.bucketSeconds, service }),
    listServices(w.from, w.to),
    listTraces({ from: w.from, to: w.to, service, status: f.status, minDurationNano: min, limit: 25 }),
    service ? getService(service, w.from, w.to) : Promise.resolve(null),
  ]);
  const names = svcs.ok ? svcs.data.services.map((s) => s.service_name) : service ? [service] : [];
  const keep = { service, status: f.status === "any" ? undefined : f.status, min_duration: f.minDuration };
  const clear = `/demo${rangeQuery}`;

  return (
    <div data-testid="demo">
      <PageHeader title="Live demo" testId="demo.header"><RangeBar base="/demo" range={w.range} params={keep} /></PageHeader>
      <p className="mb-4 max-w-3xl text-ink-2">A gateway → orders → inventory system generates deterministic synthetic traffic (normal, slow, error, parallel and missing-parent requests). Everything here is read-only and fabricated; nothing is real customer data.</p>
      {f.notices.map((n) => <Notice key={n}>{n}</Notice>)}

      <form action="/demo" method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-paper p-3" aria-label="Demo filters" role="search" data-testid="demo.filters">
        {w.range !== "1h" && <input type="hidden" name="range" value={w.range} />}
        <div className="flex flex-col gap-1"><label htmlFor="d-service" className="text-sm text-ink-3">Service</label>
          <select id="d-service" name="service" defaultValue={service ?? ""} className="field"><option value="">All services</option>{(service && !names.includes(service) ? [service, ...names] : names).map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div className="flex flex-col gap-1"><label htmlFor="d-status" className="text-sm text-ink-3">Trace status</label>
          <select id="d-status" name="status" defaultValue={f.status} className="field"><option value="any">Any</option><option value="error">Has error spans</option><option value="ok_or_unset">No error spans</option></select></div>
        <div className="flex flex-col gap-1"><label htmlFor="d-min" className="text-sm text-ink-3">Min duration (e.g. 500ms)</label>
          <input id="d-min" name="min_duration" defaultValue={f.minDuration ?? ""} className="field w-36" pattern="[0-9]{1,9}(us|ms|s)" title="Number and unit: us, ms or s" /></div>
        <button type="submit" className="btn btn-primary">Apply</button>
        {(service || f.status !== "any" || f.minDuration) && <Link href={clear} className="btn" data-testid="demo.filters.clear">Clear filters</Link>}
      </form>

      <section id="overview" aria-labelledby="overview-h" className="scroll-mt-4" data-testid="demo.overview">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="overview-h" className="text-xl font-semibold">Overview</h2>
          {ov.ok && <Freshness updated={formatClock(ov.data.freshness.generated_at)} lastSpan={ov.data.freshness.last_span_received_at ? formatClock(ov.data.freshness.last_span_received_at) : null} />}
        </div>
        {!ov.ok ? <ProblemState problem={ov.error} resetHref={clear} /> : <OverviewBody ov={ov.data} service={service} neverIngested={false} w={w} base="/demo" onboardingHref={null} />}
        <div className="mt-6 grid gap-4 lg:grid-cols-2"><LatencyPanels series={series} w={w} /></div>
      </section>

      <section id="services" aria-labelledby="services-h" className="mt-10 scroll-mt-4" data-testid="demo.services">
        <h2 id="services-h" className="mb-3 text-xl font-semibold">Services</h2>
        {!svcs.ok ? <ProblemState problem={svcs.error} resetHref={clear} compact /> : svcs.data.services.length === 0 ? (
          <EmptyState state="empty-window" title="No services in this window">Last span received {svcs.data.freshness.last_span_received_at ? formatDateTime(svcs.data.freshness.last_span_received_at) : "never"}. Try a longer range.</EmptyState>
        ) : (
          <Panel><ServicesTable services={svcs.data.services} caption="Services in the demo (select a service to investigate it)" rangeQuery={rangeQuery} serviceBase="/demo" serviceMode="query" testId="demo.services.table" /></Panel>
        )}
      </section>

      {service && (
        <section id="service" aria-labelledby="service-h" className="mt-10 scroll-mt-4" data-testid="demo.service">
          <h2 id="service-h" className="mb-3 text-xl font-semibold">Investigating {service}</h2>
          {!svc || !svc.ok ? (
            svc && svc.error.code === "not_found" ? <EmptyState state="empty-nodata" title="No such service">“{service}” has never been observed in the demo data.</EmptyState> : svc ? <ProblemState problem={svc.error} resetHref={clear} compact /> : null
          ) : (
            <div className="grid gap-4">
              {!svc.data.service.observed_in_window && <Notice kind="warn">No spans from this service in this window.</Notice>}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Kpi testId="demo.service.requests" label="Requests" value={formatCount(svc.data.service.server.request_count)} note="SERVER spans" />
                <Kpi testId="demo.service.error-rate" label="Error rate" value={formatFraction(svc.data.service.server.error_fraction)} note={`${formatCount(svc.data.service.server.error_count)} errors`} />
                {(["p50", "p95", "p99"] as const).map((k) => (
                  <Kpi key={k} testId={`demo.service.${k}`} label={k} value={formatPercentile(svc.data.service.server.latency[k])} note={svc.data.service.server.latency[k] === null ? insufficientReason(k, svc.data.service.server.population.sample_count) : undefined} />
                ))}
              </div>
              <Panel title="Operations" id="demo-ops">
                {svc.data.operations.length === 0 ? <p className="text-sm text-ink-2">No SERVER operations in this window.</p> : (
                  <div className="overflow-x-auto"><table className="data stack" data-testid="demo.operations">
                    <caption>Operations (SERVER spans)</caption>
                    <thead><tr><th scope="col">Operation</th><th scope="col" className="num">Requests</th><th scope="col" className="num">Error rate</th><th scope="col" className="num">p95</th><th scope="col">Evidence</th></tr></thead>
                    <tbody>{svc.data.operations.map((o) => (
                      <tr key={o.name}>
                        <td data-label="Operation">{o.name}</td><td data-label="Requests" className="num">{formatCount(o.server.request_count)}</td>
                        <td data-label="Error rate" className="num">{formatFraction(o.server.error_fraction)}</td><td data-label="p95" className="num">{formatPercentile(o.server.latency.p95)}</td>
                        <td data-label="Evidence"><span className="flex flex-wrap gap-2">
                          {o.server.exemplars.slowest_trace_id && <Link href={`/demo/traces/${o.server.exemplars.slowest_trace_id}${qs({ span: o.server.exemplars.slowest_span_id ?? undefined })}`}>slowest request</Link>}
                          {o.server.exemplars.latest_error_trace_id && <Link href={`/demo/traces/${o.server.exemplars.latest_error_trace_id}${qs({ span: o.server.exemplars.latest_error_span_id ?? undefined })}`}>latest error</Link>}
                          {o.sample_error_trace_ids.slice(0, 2).map((t) => <Link key={t} href={`/demo/traces/${t}`} className="mono" aria-label={`Error trace ${shortId(t)}`}>{shortId(t)}</Link>)}
                        </span></td>
                      </tr>))}</tbody>
                  </table></div>
                )}
              </Panel>
              {(svc.data.downstream.length > 0 || svc.data.upstream.length > 0) && (
                <Panel title="Observed calls" id="demo-edges">
                  <EdgeTable edges={[...svc.data.upstream, ...svc.data.downstream]} caption={`Calls into and out of ${service} (observed parent→child spans)`} traceBase="/demo/traces" testId="demo.edges" />
                </Panel>
              )}
            </div>
          )}
        </section>
      )}

      <section id="traces" aria-labelledby="traces-h" className="mt-10 scroll-mt-4" data-testid="demo.traces">
        <h2 id="traces-h" className="mb-3 text-xl font-semibold">Traces</h2>
        {!traces.ok ? <ProblemState problem={traces.error} resetHref={clear} compact /> : traces.data.items.length === 0 ? (
          (service || f.status !== "any" || f.minDuration)
            ? <EmptyState state="empty-nomatch" title="No traces match these filters"><Link href={clear}>Clear filters</Link></EmptyState>
            : <EmptyState state="empty-window" title="No traces in this window">Last span received {traces.data.freshness.last_span_received_at ? formatDateTime(traces.data.freshness.last_span_received_at) : "never"}. Try a longer range.</EmptyState>
        ) : (
          <Panel>
            <p className="mb-2 text-sm text-ink-3" data-testid="demo.traces.meta">{formatCount(traces.data.items.length)}{traces.data.next_cursor ? "+" : ""} traces · newest first{service ? " · traces involving this service (any span)" : ""}</p>
            <TraceTable initial={traces.data.items} nextCursor={traces.data.next_cursor} caption="Demo traces" rangeQuery="" traceBase="/demo/traces"
              query={{ from: w.from.toString(), to: w.to.toString(), service, status: f.status, minDuration: f.minDuration }} />
          </Panel>
        )}
      </section>
      <SamplingCaveat />
    </div>
  );
}
