import Link from "next/link";
import { Freshness } from "@/components/Freshness";
import { RangeBar, SamplingCaveat, ServiceScope } from "@/components/Scope";
import { ServicesTable } from "@/components/ServicesTable";
import { TraceTable } from "@/components/TraceTable";
import { Notice, PageHeader, Panel, ProblemState } from "@/components/ui";
import { LatencyPanels } from "@/components/overview/LatencyPanels";
import { OverviewBody } from "@/components/overview/OverviewBody";
import { formatClock, formatCount, formatDateTime } from "@/lib/format";
import { first, qs, type SearchParams } from "@/lib/query/params";
import { getIngestionStatus, getOverview, getServerLatency, listServices } from "@/lib/server/data";
import { resolveWindow } from "@/lib/time/window";

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
        <OverviewBody ov={ov.data} service={service} neverIngested={ing.ok && ing.data.first_span_received_at === null} w={w} base="/app" onboardingHref="/app/onboarding" />
      )}

      <LatencyPanels series={series} w={w} />

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
