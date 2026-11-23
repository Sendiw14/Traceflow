import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { SamplingCaveat } from "@/components/Scope";
import { Freshness } from "@/components/Freshness";
import { TraceView } from "@/components/trace/TraceView";
import { traceDuration } from "@/components/traceDuration";
import { Badge, Notice, PageHeader, ProblemState } from "@/components/ui";
import { formatClock, formatCount, formatDateTime } from "@/lib/format";
import { first, isSpanId, isTraceId, type SearchParams } from "@/lib/query/params";
import { getTrace } from "@/lib/server/data";
import { formatTimestampUTC } from "@/lib/time/nanos";

/** Above this many spans the full payload is skipped and the inspector loads spans on demand (initial guess; large-trace perf NOT TESTED). */
const LITE_THRESHOLD = 1000;

export async function generateMetadata({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = await params;
  return { title: `Trace ${traceId.slice(0, 8)}` };
}

export default async function TracePage({ params, searchParams }: { params: Promise<{ traceId: string }>; searchParams: Promise<SearchParams> }) {
  const { traceId } = await params;
  if (!isTraceId(traceId)) notFound(); // invalid ID format: no API call
  const sp = await searchParams;
  const spanParam = first(sp.span);
  const initialSpan = spanParam && isSpanId(spanParam) ? spanParam : null;

  let r = await getTrace(traceId, "lite");
  if (r.ok && r.data.spans.length <= LITE_THRESHOLD) {
    const full = await getTrace(traceId, "full");
    if (full.ok) r = full;
  }

  if (!r.ok) {
    return (
      <div data-testid="trace">
        <PageHeader title={`Trace ${traceId.slice(0, 8)}…`} />
        {r.error.code === "not_found" ? (
          <div role="status" className="rounded-md border border-dashed border-control bg-paper p-6" data-state="empty-nodata" data-testid="trace.not-found">
            <p className="font-medium">Trace not found.</p>
            <p className="mt-1 text-sm text-ink-2">It may not have arrived yet, may be outside retention, or the ID is wrong.</p>
            <p className="mt-3 flex gap-3"><Link href="/app/traces" className="btn">Back to traces</Link></p>
          </div>
        ) : <ProblemState problem={r.error} />}
      </div>
    );
  }

  const t = r.data;
  const sum = t.summary;
  const endNs = t.spans.length ? t.spans.reduce((m, s) => (BigInt(s.end_unix_nano) > m ? BigInt(s.end_unix_nano) : m), 0n) : null;
  const generated = BigInt(t.freshness.generated_at);
  const recent = sum.completeness.last_received_at !== undefined && generated - BigInt(sum.completeness.last_received_at) < 60_000_000_000n;
  const c = sum.completeness;

  return (
    <div data-testid="trace">
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-ink-3">
        <Link href="/app/traces">Traces</Link> <span aria-hidden="true">/</span> <span aria-current="page" className="mono">{traceId.slice(0, 8)}</span>
      </nav>
      <PageHeader title={sum.root ? `${sum.root.service_name}: ${sum.root.name}` : "Trace (root not received)"} testId="trace.header">
        <Freshness updated={formatClock(t.freshness.generated_at)} lastSpan={t.freshness.last_span_received_at ? formatClock(t.freshness.last_span_received_at) : null} polling={false} />
      </PageHeader>

      <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-line bg-paper p-4 text-sm md:grid-cols-4" data-testid="trace.summary">
        <div className="col-span-2"><dt className="text-ink-3">Trace ID</dt><dd className="m-0 break-all"><span className="mono" data-testid="trace.id">{traceId}</span> <CopyButton value={traceId} label="trace ID" testId="trace.copy-id" /></dd></div>
        <div><dt className="text-ink-3">Start</dt><dd className="m-0">{formatTimestampUTC(sum.start_unix_nano)}</dd></div>
        <div><dt className="text-ink-3">End</dt><dd className="m-0">{endNs !== null ? formatTimestampUTC(endNs) : "—"}</dd></div>
        <div><dt className="text-ink-3">Duration ({sum.duration.basis === "root_span" ? "root span" : "estimate"})</dt><dd className="m-0" data-testid="trace.duration">{traceDuration(sum)}</dd></div>
        <div><dt className="text-ink-3">Status</dt><dd className="m-0">{sum.error_span_count > 0 ? <Badge tone="error">Error · {sum.error_span_count} span{sum.error_span_count === 1 ? "" : "s"}</Badge> : <Badge tone="ok">OK</Badge>}</dd></div>
        <div><dt className="text-ink-3">Spans</dt><dd className="m-0">{formatCount(sum.span_count)}</dd></div>
        <div><dt className="text-ink-3">Services</dt><dd className="m-0">{sum.service_names.join(", ")}{sum.service_count > sum.service_names.length ? ` +${sum.service_count - sum.service_names.length}` : ""}</dd></div>
      </dl>

      <div data-testid="trace.notices" className="mb-3">
        {t.truncation && <Notice kind="warn" testId="trace.notice.truncated">Showing {formatCount(t.truncation.spans_returned)} of {formatCount(t.truncation.spans_total)} spans (response cap). This trace is partial.</Notice>}
        {c.orphan_count > 0 && <Notice kind="warn" testId="trace.notice.missing-parent">{c.orphan_count} span{c.orphan_count === 1 ? "" : "s"} reference a parent span that was not received. They are grouped under “Parent span not received”; no parent is inferred.</Notice>}
        {c.root_count > 1 && <Notice kind="warn" testId="trace.notice.multi-root">This trace has {c.root_count} root spans.</Notice>}
        {c.root_count === 0 && c.orphan_count === 0 && <Notice kind="warn">No root span was received for this trace.</Notice>}
        {c.has_clock_skew && <Notice kind="warn" testId="trace.notice.clock-skew">Clock skew detected: some spans have negative durations and are excluded from the time axis.</Notice>}
        {sum.duration.basis === "observed_range_estimate" && <Notice testId="trace.notice.estimate">Duration is an estimate from the observed span range (≈).</Notice>}
        {recent && <Notice testId="trace.notice.late">Spans were received in the last minute; this trace may still change. It refreshes automatically while this tab is visible.</Notice>}
        <p className="my-2 text-xs text-ink-3">Observed spans; sampling not reconstructed. Last span received for this trace: {c.last_received_at ? formatDateTime(c.last_received_at) : "unknown"}.</p>
      </div>

      <TraceView key={traceId} traceId={traceId} spans={t.spans} resources={t.resources} scopes={t.scopes} detail={t.detail} initialSpan={initialSpan}
        generatedAt={t.freshness.generated_at} lastReceivedAt={c.last_received_at ?? null} />
      <SamplingCaveat />
    </div>
  );
}
