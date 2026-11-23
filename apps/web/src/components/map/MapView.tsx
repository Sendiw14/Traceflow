"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EdgeTable } from "@/components/EdgeTable";
import { edgeEvidenceText, edgeKey, edgesOf } from "@/lib/edges";
import { formatCount, formatFraction, shortId } from "@/lib/format";
import { edgeWidth, layoutGraph, nearest, NODE_H, NODE_W, volumeBucket, type Dir } from "@/lib/graph-layout";
import type { Schemas } from "@/lib/server/data";

type S = Schemas["ServiceSummary"];
type E = Schemas["DependencyEdge"];
const LARGE = 50;
const PAD = 24;

export function MapView({ nodes, edges }: { nodes: S[]; edges: E[] }) {
  const layout = useMemo(() => layoutGraph(nodes.map((n) => n.service_name), edges), [nodes, edges]);
  const byName = useMemo(() => new Map(nodes.map((n) => [n.service_name, n])), [nodes]);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(layout.nodes[0]?.id ?? null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGraph, setShowGraph] = useState(nodes.length <= LARGE);
  const [mobileGraph, setMobileGraph] = useState(false);

  const w = layout.width + PAD * 2, h = layout.height + PAD * 2;
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const zoomBy = (f: number) => setZoom((z) => Math.min(4, Math.max(0.25, +(z * f).toFixed(3))));
  const panBy = (dx: number, dy: number) => setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  const selectNode = (id: string | null) => { setSelNode(id); setSelEdge(null); };
  const selectEdge = (key: string | null) => { setSelEdge(key); setSelNode(null); };

  const onKey = (e: React.KeyboardEvent) => {
    const dirs: Record<string, Dir> = { ArrowRight: "right", ArrowLeft: "left", ArrowUp: "up", ArrowDown: "down" };
    const cur = focus ? layout.byId.get(focus) : undefined;
    if (dirs[e.key] && cur) { const n = nearest(layout.nodes, cur, dirs[e.key]!); if (n) setFocus(n.id); }
    else if (e.key === "Enter" && focus) selectNode(focus);
    else if (e.key === "Escape") { setSelNode(null); setSelEdge(null); }
    else if (e.key === "+" || e.key === "=") zoomBy(1.25);
    else if (e.key === "-") zoomBy(0.8);
    else if (e.key === "0") reset();
    else return;
    e.preventDefault();
  };

  const edge = selEdge ? edges.find((x) => edgeKey(x) === selEdge) ?? null : null;
  const node = selNode ? byName.get(selNode) ?? null : null;
  const hit = node ? edgesOf(node.service_name, edges) : null;
  const idx = (id: string) => `map-node-${layout.nodes.findIndex((n) => n.id === id)}`;

  return (
    <div data-testid="map.body">
      {!showGraph && (
        <p role="status" className="mb-3 rounded-md border border-line bg-sunken px-3 py-2 text-sm" data-testid="map.large">
          {nodes.length} services: showing the table first. <button type="button" className="btn ml-2" onClick={() => setShowGraph(true)}>Show graph anyway</button>
        </p>
      )}
      {showGraph && (
        <>
          <p className="mb-2 md:hidden"><button type="button" className="btn" aria-pressed={mobileGraph} onClick={() => setMobileGraph((v) => !v)}>{mobileGraph ? "Hide graph" : "Show graph"}</button> <span className="text-xs text-ink-3">The table below is the full alternative.</span></p>
          <div className={`${mobileGraph ? "block" : "hidden"} md:block`} data-testid="map.graph-wrap">
            <div className="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="Graph controls">
              <button type="button" className="btn" onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
              <button type="button" className="btn" onClick={() => zoomBy(0.8)} aria-label="Zoom out">−</button>
              <button type="button" className="btn" onClick={reset}>Fit</button>
              <button type="button" className="btn" onClick={() => panBy(-60, 0)} aria-label="Pan left">←</button>
              <button type="button" className="btn" onClick={() => panBy(60, 0)} aria-label="Pan right">→</button>
              <button type="button" className="btn" onClick={() => panBy(0, -60)} aria-label="Pan up">↑</button>
              <button type="button" className="btn" onClick={() => panBy(0, 60)} aria-label="Pan down">↓</button>
              <span className="text-sm text-ink-3">Zoom {Math.round(zoom * 100)} %</span>
            </div>
            <div role="listbox" tabIndex={0} aria-label="Service dependency graph. Arrow keys move between services, Enter selects, Escape clears, plus and minus zoom."
              aria-activedescendant={focus ? idx(focus) : undefined} onKeyDown={onKey}
              className="overflow-hidden rounded-lg border border-line bg-paper" data-testid="map.graph">
              <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" style={{ minHeight: 200, maxHeight: 520 }}>
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--tf-ink-3)" /></marker>
                </defs>
                <g transform={`translate(${PAD + pan.x} ${PAD + pan.y}) scale(${zoom})`}>
                  {edges.map((e) => {
                    const a = layout.byId.get(e.source), b = layout.byId.get(e.target);
                    if (!a || !b) return null;
                    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
                    const dx = Math.max(40, Math.abs(x2 - x1) / 2);
                    const d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
                    const key = edgeKey(e);
                    const on = selEdge === key;
                    const hasErr = (e.evidence.error_pairs ?? 0) > 0;
                    return (
                      <g key={key} data-testid="map.edge" onClick={() => selectEdge(key)} className="cursor-pointer">
                        <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                        <path d={d} fill="none" stroke={on ? "var(--tf-signal-strong)" : hasErr ? "var(--tf-error)" : "var(--tf-ink-3)"} strokeWidth={edgeWidth(e.evidence.trace_count)}
                          strokeDasharray={e.evidence.basis === "other_parent_child" ? "6 4" : undefined} markerEnd="url(#arrow)" />
                        {hasErr && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize="14" fill="var(--tf-error)" aria-hidden="true">✕</text>}
                      </g>
                    );
                  })}
                  {layout.nodes.map((n) => {
                    const s = byName.get(n.id)!;
                    const noServer = s.server.population.sample_count === 0;
                    const bucket = volumeBucket(s.server.request_count);
                    const isSel = selNode === n.id;
                    const err = (s.server.error_fraction ?? 0) > 0;
                    return (
                      <g key={n.id} id={idx(n.id)} role="option" aria-selected={isSel} data-testid="map.node"
                        aria-label={`${n.id}: ${noServer ? "no server spans" : `${formatCount(s.server.request_count)} requests, error rate ${formatFraction(s.server.error_fraction)}`}`}
                        transform={`translate(${n.x} ${n.y})`} onClick={() => { setFocus(n.id); selectNode(n.id); }} className="cursor-pointer">
                        <rect width={NODE_W} height={NODE_H} rx="8" fill={isSel ? "var(--tf-signal-tint)" : "var(--tf-paper)"} stroke={focus === n.id ? "var(--tf-focus)" : "var(--tf-ink-2)"} strokeWidth={focus === n.id ? bucket + 2 : bucket} strokeDasharray={noServer ? "4 3" : undefined} />
                        <text x="12" y="23" fontSize="14" fontWeight="600" fill="var(--tf-ink)">{n.id.length > 18 ? `${n.id.slice(0, 17)}…` : n.id}</text>
                        <text x="12" y="42" fontSize="12" fill="var(--tf-ink-3)">{noServer ? "no server spans" : `${formatCount(s.server.request_count)} req · ${formatFraction(s.server.error_fraction)}`}</text>
                        {err && <text x={NODE_W - 22} y="23" fontSize="14" fill="var(--tf-error)" aria-hidden="true">✕</text>}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
            <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-xs text-ink-3" aria-label="Legend" data-testid="map.legend">
              <li>Service: border thickness = request volume (1 px &lt;10, 2 px &lt;100, 3 px &lt;1000, 4 px ≥1000); dashed border = no server spans; ✕ = has errors</li>
              <li>Edge: arrow = caller → callee; width = trace count (log scale); dashed = no client/server pair; ✕ = error pairs</li>
            </ul>
          </div>
        </>
      )}

      <div className="mt-4 rounded-lg border border-line bg-paper p-4" aria-live="polite" data-testid="map.details">
        <h2 className="mb-2 text-base font-semibold">Details</h2>
        {edge ? (
          <div data-testid="map.details.edge">
            <p className="m-0 font-medium">{edge.source} → {edge.target}</p>
            <p className="mt-1 text-sm text-ink-2">{edgeEvidenceText(edge)}</p>
            <p className="mt-1 text-sm text-ink-3">{formatCount(edge.evidence.trace_count)} traces · {formatCount(edge.evidence.parent_child_pairs)} parent→child pairs · {formatCount(edge.evidence.error_pairs ?? 0)} with errors</p>
            <p className="mt-2 flex flex-wrap gap-2 text-sm">Supporting traces: {edge.evidence.sample_trace_ids.length === 0 ? "none sampled" : edge.evidence.sample_trace_ids.map((t) => <Link key={t} href={`/app/traces/${t}`} className="mono" aria-label={`Supporting trace ${t}`}>{shortId(t)}</Link>)}</p>
          </div>
        ) : node ? (
          <div data-testid="map.details.node">
            <p className="m-0 font-medium"><Link href={`/app/services/${encodeURIComponent(node.service_name)}`}>{node.service_name}</Link></p>
            <p className="mt-1 text-sm text-ink-3">{node.server.population.sample_count === 0 ? "No server spans in this window." : `${formatCount(node.server.request_count)} requests · error rate ${formatFraction(node.server.error_fraction)}`}{!node.observed_in_window ? " · idle in window (shown as a caller)" : ""}</p>
            <p className="mt-1 text-sm text-ink-3">Calls {hit?.downstream.length ?? 0} service(s) · called by {hit?.upstream.length ?? 0} service(s) (observed only).</p>
          </div>
        ) : <p className="m-0 text-sm text-ink-3">Select a service or an edge. Use the edge table below for the full list.</p>}
      </div>

      <div className="mt-4 rounded-lg border border-line bg-paper p-4" data-testid="map.edges-panel">
        <h2 className="mb-2 text-base font-semibold">Edges</h2>
        <EdgeTable edges={edges} caption="Observed cross-service parent→child edges" selected={selEdge} onSelect={selectEdge} filterable />
      </div>
    </div>
  );
}
