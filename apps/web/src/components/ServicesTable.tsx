"use client";

import Link from "next/link";
import { useState } from "react";
import { formatClock, formatCount, formatFraction, formatPercentile } from "@/lib/format";
import { parseNanos } from "@/lib/time/nanos";
import type { Schemas } from "@/lib/server/data";
import { Column, SortableTable } from "./SortableTable";

type S = Schemas["ServiceSummary"];
const pv = (s: string | null) => (s === null ? -1n : parseNanos(s));

export function ServicesTable({ services, caption, searchable, rangeQuery, testId = "services.table", serviceBase = "/app/services", serviceMode = "path" }: {
  serviceBase?: string; serviceMode?: "path" | "query"; services: S[]; caption: string; searchable?: boolean; rangeQuery: string; testId?: string;
}) {
  const [q, setQ] = useState("");
  const rows = q ? services.filter((s) => s.service_name.toLowerCase().includes(q.toLowerCase())) : services;
  const cols: Column<S>[] = [
    { id: "name", header: "Service", sort: (s) => s.service_name,
      cell: (s) => (
        <>
          <Link href={serviceMode === "path" ? `${serviceBase}/${encodeURIComponent(s.service_name)}${rangeQuery}` : `${serviceBase}?${rangeQuery ? `${rangeQuery.slice(1)}&` : ""}service=${encodeURIComponent(s.service_name)}#service`}>{s.service_name}</Link>
          {!s.observed_in_window && <span className="ml-2 text-xs text-ink-3">idle in window</span>}
        </>
      ) },
    { id: "req", header: "Requests", align: "num", sort: (s) => s.server.request_count,
      cell: (s) => (s.server.population.sample_count === 0 ? <span className="text-ink-3">no server spans</span> : formatCount(s.server.request_count)) },
    { id: "err", header: "Error rate", align: "num", sort: (s) => s.server.error_fraction ?? -1,
      cell: (s) => (s.server.population.sample_count === 0 ? "—" : `${formatFraction(s.server.error_fraction)} (${formatCount(s.server.error_count)})`) },
    { id: "p50", header: "p50", align: "num", sort: (s) => pv(s.server.latency.p50), cell: (s) => pctCell(s, "p50") },
    { id: "p95", header: "p95", align: "num", sort: (s) => pv(s.server.latency.p95), cell: (s) => pctCell(s, "p95") },
    { id: "p99", header: "p99", align: "num", sort: (s) => pv(s.server.latency.p99), cell: (s) => pctCell(s, "p99") },
    { id: "n", header: "Samples", align: "num", sort: (s) => s.server.population.sample_count, cell: (s) => formatCount(s.server.population.sample_count) },
    { id: "last", header: "Last observed", sort: (s) => parseNanos(s.last_observed_unix_nano), cell: (s) => `${formatClock(s.last_observed_unix_nano)} UTC` },
  ];
  return (
    <div>
      {searchable && (
        <div className="mb-3">
          <label className="mr-2 text-sm" htmlFor="svc-search">Filter services</label>
          <input id="svc-search" type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} data-testid="services.search" />
        </div>
      )}
      {rows.length === 0 ? (
        <p role="status" className="rounded-md border border-dashed border-control p-6 text-center" data-state="empty-nomatch" data-testid="state.empty-nomatch">
          No services match “{q}”. <button type="button" className="btn ml-2" onClick={() => setQ("")}>Clear filter</button>
        </p>
      ) : (
        <SortableTable caption={caption} columns={cols} rows={rows} rowKey={(s) => s.service_name} testId={testId} rowTestId={`${testId}.row`} initial={{ id: "req", dir: "desc" }} />
      )}
    </div>
  );
}

function pctCell(s: S, key: "p50" | "p95" | "p99") {
  const v = s.server.latency[key];
  if (s.server.population.sample_count === 0) return "—";
  if (v === null) return <span title={`insufficient samples (n=${s.server.population.sample_count})`}>n&lt;{key === "p50" ? 1 : key === "p95" ? 20 : 100}</span>;
  return formatPercentile(v);
}
