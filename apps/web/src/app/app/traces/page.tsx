import Link from "next/link";
import { Freshness } from "@/components/Freshness";
import { RangeBar, SamplingCaveat } from "@/components/Scope";
import { TraceTable } from "@/components/TraceTable";
import { EmptyState, Notice, PageHeader, Panel, ProblemState } from "@/components/ui";
import { formatClock, formatCount, formatDateTime } from "@/lib/format";
import { first, parseMinDuration, parseTraceFilters, qs, type SearchParams } from "@/lib/query/params";
import { getIngestionStatus, listServices, listTraces } from "@/lib/server/data";

export const metadata = { title: "Traces" };

export default async function TracesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const f = parseTraceFilters(sp);
  const { window: w } = f;
  const rangeParam = w.range === "1h" ? undefined : w.range;
  const active = { service: f.service, status: f.status === "any" ? undefined : f.status, min_duration: f.minDuration };
  const min = f.minDuration ? parseMinDuration(f.minDuration) : undefined;
  // Hidden test/ops knob: ?limit=1..200 (API maximum); default 50. Used to measure dense lists (docs/testing/ui-acceptance.md).
  const rawLimit = Number(first(sp.limit));
  const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 200 ? rawLimit : 50;

  const [list, svcs, ing] = await Promise.all([
    listTraces({ from: w.from, to: w.to, service: f.service, status: f.status, minDurationNano: min, limit }),
    listServices(w.from, w.to),
    getIngestionStatus(w.from, w.to),
  ]);
  const serviceNames = svcs.ok ? svcs.data.services.map((s) => s.service_name) : f.service ? [f.service] : [];
  const options = f.service && !serviceNames.includes(f.service) ? [f.service, ...serviceNames] : serviceNames;
  const chips: { label: string; remove: string }[] = [];
  if (f.service) chips.push({ label: `service=${f.service}`, remove: qs({ range: rangeParam, status: active.status, min_duration: f.minDuration }) });
  if (active.status) chips.push({ label: `status=${active.status}`, remove: qs({ range: rangeParam, service: f.service, min_duration: f.minDuration }) });
  if (f.minDuration) chips.push({ label: `min duration=${f.minDuration}`, remove: qs({ range: rangeParam, service: f.service, status: active.status }) });
  const clear = `/app/traces${qs({ range: rangeParam })}`;
  const hasFilters = chips.length > 0;

  return (
    <div data-testid="traces">
      <PageHeader title="Traces" testId="traces.header">
        <RangeBar base="/app/traces" range={w.range} params={active} />
      </PageHeader>
      {f.notices.map((n) => <Notice key={n}>{n}</Notice>)}

      <form action="/app/traces" method="get" className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-paper p-3" data-testid="traces.filters" aria-label="Trace filters" role="search">
        {w.range !== "1h" && <input type="hidden" name="range" value={w.range} />}
        <div className="flex flex-col gap-1">
          <label htmlFor="f-service" className="text-sm text-ink-3">Service (any span)</label>
          <select id="f-service" name="service" defaultValue={f.service ?? ""} className="field" data-testid="traces.filters.service">
            <option value="">All services</option>
            {options.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-status" className="text-sm text-ink-3">Status</label>
          <select id="f-status" name="status" defaultValue={f.status} className="field" data-testid="traces.filters.status">
            <option value="any">Any</option>
            <option value="error">Has error spans</option>
            <option value="ok_or_unset">No error spans</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-min" className="text-sm text-ink-3">Min duration (e.g. 250ms, 2s)</label>
          <input id="f-min" name="min_duration" defaultValue={f.minDuration ?? ""} className="field w-40" inputMode="text" pattern="[0-9]{1,9}(us|ms|s)" title="Number and unit: us, ms or s" data-testid="traces.filters.min-duration" />
        </div>
        <button type="submit" className="btn btn-primary" data-testid="traces.filters.apply">Apply filters</button>
        {hasFilters && <Link href={clear} className="btn" data-testid="traces.filters.clear">Clear filters</Link>}
      </form>

      {hasFilters && (
        <ul className="mb-3 flex list-none flex-wrap gap-2 p-0" aria-label="Active filters" data-testid="traces.filters.chips">
          {chips.map((c) => (
            <li key={c.label}>
              <Link href={`/app/traces${c.remove}`} className="btn" aria-label={`Remove filter ${c.label}`}>{c.label} <span aria-hidden="true">✕</span></Link>
            </li>
          ))}
        </ul>
      )}

      {!list.ok ? <ProblemState problem={list.error} resetHref={clear} /> : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-3" data-testid="traces.result-meta">
              {formatCount(list.data.items.length)}{list.data.next_cursor ? "+" : ""} traces · newest first · {formatDateTime(w.from).slice(11, 16)}–{formatDateTime(w.to).slice(11, 16)} UTC
              {f.service ? " · traces involving this service (any span)" : ""}
            </p>
            <Freshness updated={formatClock(list.data.freshness.generated_at)} lastSpan={list.data.freshness.last_span_received_at ? formatClock(list.data.freshness.last_span_received_at) : null} polling={false} />
          </div>
          {list.data.items.length === 0 ? (
            ing.ok && ing.data.first_span_received_at === null ? (
              <EmptyState state="empty-nodata" title="No data yet">TRACEFLOW has not received any spans. <Link href="/app/onboarding">Connect an OpenTelemetry Collector</Link>.</EmptyState>
            ) : hasFilters ? (
              <EmptyState state="empty-nomatch" title="No traces match these filters">
                {chips.map((c) => c.label).join(", ")}. <Link href={clear}>Clear filters</Link>
              </EmptyState>
            ) : (
              <EmptyState state="empty-window" title="No traces in this window">
                Last span received {list.data.freshness.last_span_received_at ? formatDateTime(list.data.freshness.last_span_received_at) : "never"}. Try a longer range.
              </EmptyState>
            )
          ) : (
            <Panel testId="traces.list-panel">
              <TraceTable
                initial={list.data.items}
                nextCursor={list.data.next_cursor}
                caption={`Traces, ${w.range === "1h" ? "last 1h" : `last ${w.range}`}`}
                rangeQuery={qs({ range: rangeParam })}
                query={{ from: w.from.toString(), to: w.to.toString(), service: f.service, status: f.status, minDuration: f.minDuration }}
              />
            </Panel>
          )}
        </>
      )}
      <SamplingCaveat />
    </div>
  );
}
