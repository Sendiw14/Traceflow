"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchSpan } from "@/app/app/traces/[traceId]/actions";
import { CopyButton } from "@/components/CopyButton";
import { Badge } from "@/components/ui";
import { scalarText, type AnyValue } from "@/lib/any-value";
import { formatCount } from "@/lib/format";
import type { Schemas } from "@/lib/server/data";
import { formatDuration, formatTimestampUTC } from "@/lib/time/nanos";

type Span = Schemas["Span"];
type Attr = Schemas["Attribute"];

function Value({ v }: { v: AnyValue }) {
  const t = scalarText(v);
  if (t !== null) return <span className="break-words font-mono text-[13px]">{t}</span>;
  if (v.type === "array") return <ol className="m-0 list-decimal pl-5">{v.value.map((x, i) => <li key={i}><Value v={x} /></li>)}</ol>;
  if (v.type === "kvlist") return <Attrs list={v.value} />;
  return null;
}

function Attrs({ list }: { list: Attr[] }) {
  if (list.length === 0) return <p className="m-0 text-sm text-ink-3">None.</p>;
  return (
    <dl className="m-0 grid grid-cols-[minmax(80px,40%)_1fr] gap-x-3 gap-y-1 text-sm">
      {list.map((a) => (
        <div key={a.key} className="contents">
          <dt className="break-words text-ink-3">{a.key}</dt>
          <dd className="m-0 min-w-0"><Value v={a.value} />{a.truncated && <span className="ml-2 text-xs text-[var(--tf-warning-text)]">⚠ value truncated</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

type Loaded = { spanId: string; result: { ok: true; detail: Schemas["SpanDetail"] } | { ok: false; message: string } };

export function SpanInspector({ traceId, selected, liteSpan, fullSpan, resources, scopes, onClose }: {
  traceId: string; selected: string | null; liteSpan: Span | null; fullSpan: Span | null;
  resources: Schemas["Resource"][]; scopes: Schemas["InstrumentationScope"][]; onClose: () => void;
}) {
  const needsFetch = selected !== null && fullSpan === null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!needsFetch || !selected) return;
    let live = true;
    fetchSpan(traceId, selected).then((result) => { if (live) setLoaded({ spanId: selected, result }); });
    return () => { live = false; };
  }, [needsFetch, selected, traceId, retry]);

  if (!selected || !liteSpan) {
    return (
      <aside aria-label="Span inspector" className="rounded-lg border border-line bg-paper p-4" data-testid="trace.inspector">
        <p className="text-sm text-ink-3" role="status">Select a span to inspect it (Enter on a focused row).</p>
      </aside>
    );
  }

  const settled = loaded?.spanId === selected ? loaded.result : null;
  const loading = needsFetch && !settled;
  const detail = settled?.ok ? settled.detail : null;
  const span: Span = fullSpan ?? detail?.span ?? liteSpan;
  const resource = detail?.resource ?? resources[span.resource_ref];
  const scope = detail?.scope ?? scopes[span.scope_ref];
  const heading = `${span.name}`;
  const full = fullSpan !== null || detail !== null;

  return (
    <aside aria-labelledby="inspector-h" className="rounded-lg border border-line bg-paper p-4" data-testid="trace.inspector" aria-busy={loading}>
      <div className="flex items-start justify-between gap-2">
        <h2 id="inspector-h" className="break-words text-base font-semibold" data-testid="trace.inspector.title">{heading}</h2>
        <button type="button" className="btn px-2 py-0.5 text-xs" onClick={onClose} data-testid="trace.inspector.close">Close</button>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={span.status.code === "error" ? "error" : span.status.code === "ok" ? "ok" : "neutral"}>status: {span.status.code}</Badge>
        <span className="text-ink-3">kind: {span.kind}</span>
        <span className="text-ink-3">service: {span.service_name}</span>
      </p>
      {span.status.message && <p className="mt-1 break-words text-sm" data-testid="trace.inspector.status-message">Status message: {span.status.message}</p>}
      {span.quality.negative_duration && <p role="status" className="mt-2 text-sm text-[var(--tf-warning-text)]">⚠ Negative duration: clock skew between emitter and recorder.</p>}
      {span.quality.truncated && <p role="status" className="mt-2 text-sm text-[var(--tf-warning-text)]">⚠ Some values were truncated at ingestion.</p>}

      <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-3">Span ID</dt><dd className="m-0 break-all"><span className="mono">{span.span_id}</span> <CopyButton value={span.span_id} label="span ID" testId="trace.inspector.copy-span" /></dd>
        <dt className="text-ink-3">Parent</dt><dd className="m-0 break-all">{span.parent_span_id === null ? "none (root)" : <><span className="mono">{span.parent_span_id}</span>{!span.parent_present && " — parent span not received"}</>}</dd>
        <dt className="text-ink-3">Start</dt><dd className="m-0">{formatTimestampUTC(span.start_unix_nano)}</dd>
        <dt className="text-ink-3">End</dt><dd className="m-0">{formatTimestampUTC(span.end_unix_nano)}</dd>
        <dt className="text-ink-3">Duration</dt><dd className="m-0">{formatDuration(span.duration_nano)}{span.quality.zero_duration ? " (zero duration)" : ""}</dd>
        <dt className="text-ink-3">Scope</dt><dd className="m-0">{scope ? `${scope.name}${scope.version ? ` ${scope.version}` : ""}` : "—"}</dd>
        {span.trace_state && <><dt className="text-ink-3">Trace state</dt><dd className="m-0 break-all mono">{span.trace_state}</dd></>}
      </dl>

      {loading && <p role="status" className="mt-3 text-sm text-ink-3" data-state="loading">Loading span details… ({formatCount(span.attribute_count)} attributes, {formatCount(span.event_count)} events, {formatCount(span.link_count)} links)</p>}
      {settled && !settled.ok && (
        <div role="alert" className="mt-3 rounded-md border border-error bg-[var(--tf-error-tint)] p-3 text-sm" data-state="error">
          <p className="m-0 text-error">✕ Could not load span details: {settled.message}</p>
          <button type="button" className="btn mt-2" onClick={() => { setLoaded(null); setRetry((n) => n + 1); }}>Retry</button>
        </div>
      )}
      {full && (
        <>
          <Section title={`Resource attributes (${resource?.attributes.length ?? 0})`}>{resource ? <Attrs list={resource.attributes} /> : <p className="m-0 text-sm text-ink-3">Unavailable.</p>}</Section>
          <Section title={`Attributes (${span.attributes?.length ?? span.attribute_count})`} open><Attrs list={span.attributes ?? []} /></Section>
          <Section title={`Events (${span.events?.length ?? span.event_count})`} open={(span.events?.length ?? 0) > 0}>
            {(span.events ?? []).length === 0 ? <p className="m-0 text-sm text-ink-3">None.</p> : (
              <ul className="m-0 list-none space-y-3 p-0">
                {span.events!.map((e, i) => (
                  <li key={i} className="text-sm"><p className="m-0 font-medium">{e.name} <span className="font-normal text-ink-3">at {formatTimestampUTC(e.time_unix_nano)}</span></p><Attrs list={e.attributes} />{e.dropped_attributes_count ? <p className="m-0 text-xs text-ink-3">{e.dropped_attributes_count} attributes dropped</p> : null}</li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={`Links (${span.links?.length ?? span.link_count})`}>
            {(span.links ?? []).length === 0 ? <p className="m-0 text-sm text-ink-3">None.</p> : (
              <ul className="m-0 list-none space-y-2 p-0 text-sm">
                {span.links!.map((l, i) => (
                  <li key={i}><Link href={`/app/traces/${l.trace_id}?span=${l.span_id}`} className="mono">{l.trace_id.slice(0, 8)}…/{l.span_id.slice(0, 8)}</Link> <span className="text-ink-3">(may not be retained)</span></li>
                ))}
              </ul>
            )}
          </Section>
          {span.dropped && (span.dropped.attributes || span.dropped.events || span.dropped.links) ? (
            <p className="mt-2 text-xs text-ink-3">Dropped by the SDK: {span.dropped.attributes ?? 0} attributes, {span.dropped.events ?? 0} events, {span.dropped.links ?? 0} links.</p>
          ) : null}
        </>
      )}
    </aside>
  );
}

function Section({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="mt-3 border-t border-line pt-2" open={open}>
      <summary className="cursor-pointer text-sm font-semibold">{title}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
