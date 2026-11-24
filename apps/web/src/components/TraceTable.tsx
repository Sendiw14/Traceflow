"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { loadMoreTraces, type TraceQuery } from "@/app/app/traces/actions";
import { loginUrl } from "@/lib/login";
import { formatCount, formatDateTime, shortId } from "@/lib/format";
import { parseNanos } from "@/lib/time/nanos";
import type { Schemas } from "@/lib/server/data";
import { Badge } from "./ui";
import { traceDuration } from "./traceDuration";
import { Column, SortableTable } from "./SortableTable";

type T = Schemas["TraceSummary"];

function completeness(t: T) {
  const c = t.completeness;
  const items: string[] = [];
  if (c.orphan_count > 0) items.push(`${c.orphan_count} parent span${c.orphan_count === 1 ? "" : "s"} not received`);
  if (c.root_count > 1) items.push(`${c.root_count} roots`);
  if (c.has_clock_skew) items.push("clock skew");
  return items.length === 0 ? <Badge tone="ok">complete</Badge> : <Badge tone="warn">{items.join(" · ")}</Badge>;
}

export function TraceTable({ initial, nextCursor, query, caption, rangeQuery = "", traceBase = "/app/traces" }: {
  traceBase?: string; initial: T[]; nextCursor?: string | null; query?: TraceQuery; caption: string; rangeQuery?: string;
}) {
  const [rows, setRows] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor ?? null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const focusId = useRef<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // A server re-render (filters, refresh) delivers new `initial` and replaces the appended pages.
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) { setPrev(initial); setRows(initial); setCursor(nextCursor ?? null); setError(null); }
  useEffect(() => {
    if (!focusId.current) return;
    wrap.current?.querySelector<HTMLElement>(`a[data-trace="${focusId.current}"]`)?.focus();
    focusId.current = null;
  }, [rows]);

  const more = () => {
    if (!query || !cursor) return;
    start(async () => {
      const r = await loadMoreTraces(query, cursor);
      if (!r.ok) {
        if (r.unauthorized) { window.location.assign(loginUrl(window.location.pathname, "expired")); return; }
        setError(r.message);
        return;
      }
      setError(null);
      const seen = new Set(rows.map((x) => x.trace_id));
      const fresh = r.items.filter((x) => !seen.has(x.trace_id));
      focusId.current = fresh[0]?.trace_id ?? null;
      setRows([...rows, ...fresh]);
      setCursor(r.next);
      setAnnounce(`${fresh.length} more traces loaded`);
    });
  };

  const cols: Column<T>[] = [
    { id: "start", header: "Start (UTC)", sort: (t) => parseNanos(t.start_unix_nano), cell: (t) => (
      <Link data-trace={t.trace_id} href={`${traceBase}/${t.trace_id}${rangeQuery}`} aria-label={`Trace ${t.trace_id}, started ${formatDateTime(t.start_unix_nano)}`}>{formatDateTime(t.start_unix_nano)}</Link>) },
    { id: "id", header: "Trace ID", cell: (t) => <span className="mono">{shortId(t.trace_id)}</span> },
    { id: "root", header: "Root operation", sort: (t) => t.root?.name ?? "", cell: (t) => t.root
      ? <span>{t.root.service_name} <span className="text-ink-3">·</span> {t.root.name}</span>
      : <Badge tone="warn">root not received</Badge> },
    { id: "svc", header: "Services", sort: (t) => t.service_count, cell: (t) => (
      <span className="flex flex-wrap gap-1">
        {t.service_names.slice(0, 4).map((s) => <span key={s} className="rounded-sm bg-sunken px-1.5 text-xs">{s}</span>)}
        {t.service_count > Math.min(4, t.service_names.length) && <span className="text-xs text-ink-3">+{t.service_count - Math.min(4, t.service_names.length)}</span>}
      </span>) },
    { id: "dur", header: "Duration", align: "num", sort: (t) => parseNanos(t.duration.value_nano, { signed: true }), cell: traceDuration },
    { id: "spans", header: "Spans", align: "num", sort: (t) => t.span_count, cell: (t) => formatCount(t.span_count) },
    { id: "err", header: "Errors", align: "num", sort: (t) => t.error_span_count, cell: (t) => (t.error_span_count > 0 ? <span className="font-medium text-error"><span aria-hidden="true">✕ </span>{t.error_span_count}</span> : "0") },
    { id: "status", header: "Status", sort: (t) => t.error_span_count, cell: (t) => (t.error_span_count > 0 ? <Badge tone="error">Error</Badge> : <Badge tone="ok">OK</Badge>) },
    { id: "complete", header: "Completeness", cell: completeness },
  ];

  return (
    <div ref={wrap}>
      <SortableTable caption={caption} columns={cols} rows={rows} rowKey={(t) => t.trace_id} testId="traces.list" rowTestId="traces.list.row" />
      {query && (
        <div className="mt-4 flex flex-wrap items-center gap-3" data-testid="traces.pager">
          {cursor ? (
            <button type="button" className="btn" onClick={more} disabled={pending} data-testid="traces.pager.more">{pending ? "Loading…" : "Load more"}</button>
          ) : (
            <p className="text-sm text-ink-3" data-testid="traces.pager.end">No more traces in this window.</p>
          )}
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <p role="status" className="sr-only">{announce}</p>
        </div>
      )}
    </div>
  );
}
