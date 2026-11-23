import Link from "next/link";
import { Freshness } from "@/components/Freshness";
import { MapView } from "@/components/map/MapView";
import { RangeBar, SamplingCaveat } from "@/components/Scope";
import { EmptyState, Notice, PageHeader, ProblemState } from "@/components/ui";
import { formatClock, formatDateTime } from "@/lib/format";
import { first, type SearchParams } from "@/lib/query/params";
import { getDependencies, getIngestionStatus } from "@/lib/server/data";
import { resolveWindow } from "@/lib/time/window";

export const metadata = { title: "Map" };

export default async function MapPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const w = resolveWindow(first(sp.range));
  const [r, ing] = await Promise.all([getDependencies(w.from, w.to), getIngestionStatus(w.from, w.to)]);
  return (
    <div data-testid="map">
      <PageHeader title="Service map"><RangeBar base="/app/map" range={w.range} /></PageHeader>
      {w.notice && <Notice>{w.notice}</Notice>}
      <p className="mb-3 text-sm text-ink-3" data-testid="map.caveat">Edges come only from observed parent→child spans; the absence of an edge is not proof of no dependency.</p>
      {!r.ok ? <ProblemState problem={r.error} resetHref="/app/map" /> : (
        <>
          <div className="mb-3 flex justify-end">
            <Freshness updated={formatClock(r.data.freshness.generated_at)} lastSpan={r.data.freshness.last_span_received_at ? formatClock(r.data.freshness.last_span_received_at) : null} polling={false} />
          </div>
          {r.data.nodes.length === 0 ? (
            ing.ok && ing.data.first_span_received_at === null ? (
              <EmptyState state="empty-nodata" title="No data yet">TRACEFLOW has not received any spans. <Link href="/app/onboarding">Connect an OpenTelemetry Collector</Link>.</EmptyState>
            ) : (
              <EmptyState state="empty-window" title="No services observed in this window">Last span received {r.data.freshness.last_span_received_at ? formatDateTime(r.data.freshness.last_span_received_at) : "never"}. Try a longer range.</EmptyState>
            )
          ) : (
            <>
              {r.data.edges.length === 0 && (
                <EmptyState state="empty-nomatch" title="No cross-service parent→child spans observed in this window">
                  Services seen: {r.data.nodes.map((n) => n.service_name).join(", ")}.
                </EmptyState>
              )}
              <MapView nodes={r.data.nodes} edges={r.data.edges} />
            </>
          )}
        </>
      )}
      <SamplingCaveat />
    </div>
  );
}
