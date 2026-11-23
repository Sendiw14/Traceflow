import { Freshness } from "@/components/Freshness";
import { RangeBar, SamplingCaveat } from "@/components/Scope";
import { ServicesTable } from "@/components/ServicesTable";
import { EmptyState, Notice, PageHeader, Panel, ProblemState } from "@/components/ui";
import { formatClock, formatDateTime } from "@/lib/format";
import { first, qs, type SearchParams } from "@/lib/query/params";
import { getIngestionStatus, listServices } from "@/lib/server/data";
import { resolveWindow } from "@/lib/time/window";
import Link from "next/link";

export const metadata = { title: "Services" };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const w = resolveWindow(first(sp.range));
  const rangeQuery = qs({ range: w.range === "1h" ? undefined : w.range });
  const [r, ing] = await Promise.all([listServices(w.from, w.to), getIngestionStatus(w.from, w.to)]);
  return (
    <div data-testid="services">
      <PageHeader title="Services"><RangeBar base="/app/services" range={w.range} /></PageHeader>
      {w.notice && <Notice>{w.notice}</Notice>}
      {!r.ok ? <ProblemState problem={r.error} resetHref="/app/services" /> : (
        <>
          <div className="mb-3 flex justify-end">
            <Freshness updated={formatClock(r.data.freshness.generated_at)} lastSpan={r.data.freshness.last_span_received_at ? formatClock(r.data.freshness.last_span_received_at) : null} polling={false} />
          </div>
          {r.data.services.length === 0 ? (
            ing.ok && ing.data.first_span_received_at === null ? (
              <EmptyState state="empty-nodata" title="No data yet">TRACEFLOW has not received any spans. <Link href="/app/onboarding">Connect an OpenTelemetry Collector</Link>.</EmptyState>
            ) : (
              <EmptyState state="empty-window" title="No services observed in this window">
                Last span received {r.data.freshness.last_span_received_at ? formatDateTime(r.data.freshness.last_span_received_at) : "never"}. Try a longer range.
              </EmptyState>
            )
          ) : (
            <Panel testId="services.panel">
              <ServicesTable services={r.data.services} caption={`Services with spans in the last ${w.range}`} searchable rangeQuery={rangeQuery} />
              <p className="mt-3 text-xs text-ink-3" data-testid="services.population-note">{r.data.services.find((s) => s.server.population.sample_count > 0)?.server.population.note ?? "Statistics use SERVER spans only."} Percentiles show “n&lt;N” when a service has too few samples (p50 ≥ 1, p95 ≥ 20, p99 ≥ 100).</p>
            </Panel>
          )}
        </>
      )}
      <SamplingCaveat />
    </div>
  );
}
