"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SortableTable, type Column } from "@/components/SortableTable";
import { Badge } from "@/components/ui";
import { formatCount } from "@/lib/format";
import type { Schemas } from "@/lib/server/data";
import { barGeometry, buildTree, computeAxis, errorSpanIds, flatten, ORPHAN_GROUP, parentIds, type Axis, type Node, type SpanT } from "@/lib/trace-tree";
import { formatDuration } from "@/lib/time/nanos";
import { SpanInspector } from "./SpanInspector";

type View = "waterfall" | "tree" | "table";
const LARGE = 5000;

export function TraceView({ traceId, spans, resources, scopes, detail, initialSpan, generatedAt, lastReceivedAt }: {
  traceId: string; spans: SpanT[]; resources: Schemas["Resource"][]; scopes: Schemas["InstrumentationScope"][];
  detail: "full" | "lite"; initialSpan: string | null; generatedAt: string; lastReceivedAt: string | null;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const roots = useMemo(() => buildTree(spans), [spans]);
  const byId = useMemo(() => new Map(spans.map((s) => [s.span_id, s])), [spans]);
  const large = spans.length > LARGE;

  const [view, setView] = useState<View>(large ? "tree" : "waterfall");
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const base = large ? new Set<string>() : parentIds(roots);
    // Deep link: make the selected span visible.
    let cur = initialSpan ? byId.get(initialSpan) : undefined;
    while (cur?.parent_span_id) { base.add(cur.parent_span_id); cur = byId.get(cur.parent_span_id); }
    if (initialSpan && byId.get(initialSpan) && !byId.get(initialSpan)!.parent_present) base.add(ORPHAN_GROUP);
    return base;
  });
  const [selected, setSelected] = useState<string | null>(initialSpan && byId.has(initialSpan) ? initialSpan : null);
  const [focusId, setFocusId] = useState<string | null>(selected);
  const [frozen, setFrozen] = useState<Axis | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => flatten(roots, expanded), [roots, expanded]);
  const axis = frozen ?? computeAxis(spans);
  const errors = useMemo(() => errorSpanIds(spans), [spans]);
  const tabStop = rows.some((r) => r.node.id === focusId) ? focusId : rows[0]?.node.id ?? null;

  // Late-arrival handling: show how many spans arrived since the previous render of this trace.
  const [prevCount, setPrevCount] = useState(spans.length);
  const [added, setAdded] = useState(0);
  if (prevCount !== spans.length) { setAdded(spans.length - prevCount); setPrevCount(spans.length); }

  const recent = lastReceivedAt !== null && BigInt(generatedAt) - BigInt(lastReceivedAt) < 60_000_000_000n;
  useEffect(() => {
    if (!recent) return;
    const id = setInterval(() => { if (!document.hidden) startRefresh(() => router.refresh()); }, 10_000);
    return () => clearInterval(id);
  }, [recent, router]);

  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)?.focus();
  });

  const select = useCallback((id: string | null) => {
    setSelected(id);
    setFrozen(id === null ? null : (a) => a ?? computeAxis(spans)); // axis never rescales while a span is selected
    const u = new URL(window.location.href);
    if (id && id !== ORPHAN_GROUP) u.searchParams.set("span", id); else u.searchParams.delete("span");
    window.history.replaceState(null, "", u);
  }, [spans]);

  const moveFocus = (id: string | null) => { if (id) { pendingFocus.current = id; setFocusId(id); } };

  const toggle = (id: string, open: boolean) => setExpanded((e) => { const c = new Set(e); if (open) c.add(id); else c.delete(id); return c; });

  const onKey = (e: React.KeyboardEvent, idx: number) => {
    const row = rows[idx]!;
    const id = row.node.id;
    switch (e.key) {
      case "ArrowDown": moveFocus(rows[Math.min(rows.length - 1, idx + 1)]?.node.id ?? null); break;
      case "ArrowUp": moveFocus(rows[Math.max(0, idx - 1)]?.node.id ?? null); break;
      case "Home": moveFocus(rows[0]?.node.id ?? null); break;
      case "End": moveFocus(rows[rows.length - 1]?.node.id ?? null); break;
      case "ArrowRight":
        if (row.hasChildren && !row.expanded) toggle(id, true);
        else if (row.hasChildren) moveFocus(rows[idx + 1]?.node.id ?? null);
        break;
      case "ArrowLeft":
        if (row.hasChildren && row.expanded) toggle(id, false);
        else if (row.parentId) moveFocus(row.parentId);
        break;
      case "Enter": case " ":
        if (row.node.span) select(id); else toggle(id, !row.expanded);
        break;
      case "Escape": if (selected) { const s = selected; select(null); moveFocus(s); } else return; break;
      default: return;
    }
    e.preventDefault();
  };

  const jumpError = () => {
    if (errors.length === 0) return;
    const i = selected ? errors.indexOf(selected) : -1;
    const next = errors[(i + 1) % errors.length]!;
    const open = new Set(expanded);
    let cur = byId.get(next);
    while (cur?.parent_span_id) { open.add(cur.parent_span_id); cur = byId.get(cur.parent_span_id); }
    if (!byId.get(next)!.parent_present) open.add(ORPHAN_GROUP);
    setExpanded(open);
    select(next);
    if (view === "table") return;
    moveFocus(next);
  };

  const selSpan = selected ? byId.get(selected) ?? null : null;
  const fullSpan = detail === "full" ? selSpan : null;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const rangeNs = axis.end - axis.start;

  const tableCols: Column<SpanT>[] = [
    { id: "name", header: "Span", sort: (s) => s.name, cell: (s) => <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left text-signal-strong underline" onClick={() => select(s.span_id)} aria-label={`Inspect span ${s.name}`}>{s.name}</button> },
    { id: "svc", header: "Service", sort: (s) => s.service_name, cell: (s) => s.service_name },
    { id: "kind", header: "Kind", sort: (s) => s.kind, cell: (s) => s.kind },
    { id: "start", header: "Start offset", align: "num", sort: (s) => BigInt(s.start_unix_nano), cell: (s) => formatDuration(BigInt(s.start_unix_nano) - axis.start) },
    { id: "dur", header: "Duration", align: "num", sort: (s) => BigInt(s.duration_nano), cell: (s) => (BigInt(s.duration_nano) < 0n ? <Badge tone="warn">clock skew</Badge> : formatDuration(s.duration_nano)) },
    { id: "status", header: "Status", sort: (s) => s.status.code, cell: (s) => (s.status.code === "error" ? <Badge tone="error">error</Badge> : s.status.code) },
  ];

  return (
    <div data-testid="trace.body">
      {added > 0 && <p role="status" className="mb-2 text-sm text-ink-2" data-testid="trace.updated">Trace updated · +{added} span{added === 1 ? "" : "s"}</p>}
      {detail === "lite" && <p className="mb-2 text-sm text-ink-3" data-testid="trace.lite-note">Large trace ({formatCount(spans.length)} spans): span details load when you select a span.</p>}
      {large && <p role="status" className="mb-2 rounded-md border border-line bg-sunken px-3 py-2 text-sm" data-testid="trace.large">⚠ Large trace ({formatCount(spans.length)} spans). Showing the tree collapsed; expand nodes to explore.</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Trace view" className="flex gap-1">
          {(["waterfall", "tree", "table"] as const).map((v) => (
            <button key={v} type="button" className="btn" aria-pressed={view === v} onClick={() => setView(v)} data-testid={`trace.view.${v}`}>{v[0]!.toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
        <button type="button" className="btn" onClick={jumpError} disabled={errors.length === 0} data-testid="trace.next-error">
          {errors.length === 0 ? "No error spans" : `Next error span (${errors.length})`}
        </button>
        {view !== "table" && (
          <>
            <button type="button" className="btn" onClick={() => setExpanded(parentIds(roots))}>Expand all</button>
            <button type="button" className="btn" onClick={() => setExpanded(new Set())}>Collapse all</button>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 rounded-lg border border-line bg-paper p-2">
          {view === "table" ? (
            <SortableTable caption="Spans" columns={tableCols} rows={spans} rowKey={(s) => s.span_id} testId="trace.table" rowTestId="trace.table.row" />
          ) : (
            <div className="overflow-x-auto">
              <div className={view === "waterfall" ? "min-w-[640px]" : ""}>
                {view === "waterfall" && (
                  <div className="grid grid-cols-[minmax(200px,38%)_1fr_84px] border-b border-line pb-1 text-xs text-ink-3" aria-hidden="true">
                    <span>Span</span>
                    <span className="relative h-4">
                      {ticks.map((t) => (
                        <span key={t} className="absolute top-0 whitespace-nowrap" style={{ left: `${t * 100}%`, transform: t === 1 ? "translateX(-100%)" : t === 0 ? "none" : "translateX(-50%)" }}>
                          {formatDuration((rangeNs * BigInt(Math.round(t * 1000))) / 1000n)}
                        </span>
                      ))}
                    </span>
                    <span className="text-right">Duration</span>
                  </div>
                )}
                <div ref={listRef} role="tree" aria-label={`Spans of trace ${traceId}`} data-testid={view === "waterfall" ? "trace.waterfall" : "trace.tree"}>
                  {rows.map((r, i) => {
                    const n: Node = r.node;
                    const s = n.span;
                    const isSel = selected === n.id;
                    const err = s?.status.code === "error";
                    const geo = s ? barGeometry(s, axis) : null;
                    return (
                      <div key={n.id} role="treeitem" aria-level={r.depth} aria-selected={isSel} aria-expanded={r.hasChildren ? r.expanded : undefined}
                        tabIndex={tabStop === n.id ? 0 : -1} data-id={n.id} data-testid={view === "waterfall" ? "trace.waterfall.row" : "trace.tree.node"} data-error={err ? "true" : undefined}
                        onKeyDown={(e) => onKey(e, i)} onClick={() => { moveFocus(n.id); if (s) select(n.id); else toggle(n.id, !r.expanded); }}
                        className={`grid cursor-pointer items-center rounded-sm py-1 ${view === "waterfall" ? "grid-cols-[minmax(200px,38%)_1fr_84px]" : "grid-cols-[minmax(0,1fr)_auto]"} ${isSel ? "bg-signal-tint outline outline-2 -outline-offset-2 outline-signal-strong" : "hover:bg-canvas"}`}>
                        <span className="flex min-w-0 items-center gap-1 pr-2" style={{ paddingLeft: `${(r.depth - 1) * 16}px` }}>
                          <span aria-hidden="true" className="w-4 shrink-0 text-ink-3">{r.hasChildren ? (r.expanded ? "▾" : "▸") : ""}</span>
                          {err && <><span aria-hidden="true" className="text-error">✕</span><span className="sr-only">error</span></>}
                          <span className="truncate text-sm">{s ? s.name : <em>Parent span not received ({n.children.length})</em>}</span>
                          {s && <span className="shrink-0 text-xs text-ink-3">{s.service_name}</span>}
                        </span>
                        {view === "waterfall" ? (
                          <>
                            <span className="relative h-5 border-l border-grid" aria-hidden="true">
                              {geo && s && (
                                <span className={`absolute top-0.5 h-4 rounded-sm ${geo.skew ? "border border-dashed border-[var(--tf-warning-fill)] bg-[var(--tf-warning-tint)]" : err ? "border-2 border-error bg-error" : "bg-signal"}`}
                                  style={{ left: `${geo.leftPct}%`, width: `max(2px, ${geo.widthPct}%)` }} data-testid="trace.waterfall.bar" />
                              )}
                            </span>
                            <span className="pr-1 text-right text-xs tabular-nums">{s ? (BigInt(s.duration_nano) < 0n ? "clock skew" : formatDuration(s.duration_nano)) : ""}</span>
                          </>
                        ) : (
                          <span className="pr-1 text-xs tabular-nums text-ink-3">{s ? (BigInt(s.duration_nano) < 0n ? "clock skew" : formatDuration(s.duration_nano)) : ""}{s ? ` · ${formatCount(s.event_count)} events` : ""}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        <SpanInspector traceId={traceId} selected={selected} liteSpan={selSpan} fullSpan={fullSpan} resources={resources} scopes={scopes} onClose={() => { const s = selected; select(null); moveFocus(s); }} />
      </div>
    </div>
  );
}
