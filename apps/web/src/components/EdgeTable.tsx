"use client";

import Link from "next/link";
import { useState } from "react";
import { edgeEvidenceText, edgeKey } from "@/lib/edges";
import { formatCount, formatDateTime, shortId } from "@/lib/format";
import { parseNanos } from "@/lib/time/nanos";
import type { Schemas } from "@/lib/server/data";
import { Column, SortableTable } from "./SortableTable";
import { Badge } from "./ui";

type E = Schemas["DependencyEdge"];

export function EdgeTable({ edges, caption, selected, onSelect, filterable, testId = "map.edge-table", traceBase = "/app/traces" }: {
  traceBase?: string; edges: E[]; caption: string; selected?: string | null; onSelect?: (key: string) => void; filterable?: boolean; testId?: string;
}) {
  const [q, setQ] = useState("");
  const rows = q ? edges.filter((e) => `${e.source} ${e.target}`.toLowerCase().includes(q.toLowerCase())) : edges;
  const cols: Column<E>[] = [
    { id: "source", header: "Source", sort: (e) => e.source, cell: (e) => (
      onSelect ? <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left text-signal-strong underline" aria-pressed={selected === edgeKey(e)} onClick={() => onSelect(edgeKey(e))} aria-label={`Select edge ${e.source} to ${e.target}`}>{e.source}</button> : e.source) },
    { id: "target", header: "Target", sort: (e) => e.target, cell: (e) => e.target },
    { id: "basis", header: "Basis", sort: (e) => e.evidence.basis, cell: (e) => <span title={edgeEvidenceText(e)}>{e.evidence.basis === "client_server_parent_child" ? "client→server (verified)" : "parent→child (other)"}</span> },
    { id: "traces", header: "Traces", align: "num", sort: (e) => e.evidence.trace_count, cell: (e) => formatCount(e.evidence.trace_count) },
    { id: "pairs", header: "Pairs", align: "num", sort: (e) => e.evidence.parent_child_pairs, cell: (e) => formatCount(e.evidence.parent_child_pairs) },
    { id: "errors", header: "Errors", align: "num", sort: (e) => e.evidence.error_pairs ?? 0, cell: (e) => ((e.evidence.error_pairs ?? 0) > 0 ? <Badge tone="error">{e.evidence.error_pairs}</Badge> : "0") },
    { id: "first", header: "First seen", sort: (e) => parseNanos(e.evidence.first_seen_unix_nano), cell: (e) => formatDateTime(e.evidence.first_seen_unix_nano) },
    { id: "last", header: "Last seen", sort: (e) => parseNanos(e.evidence.last_seen_unix_nano), cell: (e) => formatDateTime(e.evidence.last_seen_unix_nano) },
    { id: "samples", header: "Sample traces", cell: (e) => (
      <span className="flex flex-wrap gap-2">
        {e.evidence.sample_trace_ids.length === 0 ? "—" : e.evidence.sample_trace_ids.map((t) => <Link key={t} href={`${traceBase}/${t}`} className="mono" aria-label={`Sample trace ${shortId(t)}`}>{shortId(t)}</Link>)}
      </span>) },
  ];
  return (
    <div>
      {filterable && (
        <div className="mb-3">
          <label htmlFor={`${testId}-q`} className="mr-2 text-sm">Filter by service</label>
          <input id={`${testId}-q`} type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} data-testid={`${testId}.filter`} />
        </div>
      )}
      {rows.length === 0 ? <p role="status" className="text-sm text-ink-2" data-state="empty-nomatch">No edges match “{q}”.</p> :
        <SortableTable caption={caption} columns={cols} rows={rows} rowKey={edgeKey} testId={testId} rowTestId={`${testId}.row`} initial={{ id: "traces", dir: "desc" }} />}
    </div>
  );
}
