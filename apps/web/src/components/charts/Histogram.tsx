"use client";

import { useId, useState } from "react";
import { formatCount } from "@/lib/format";
import { formatDuration } from "@/lib/time/nanos";

export interface Bin { lower: string; upper: string | null; count: number }

const label = (b: Bin) => (b.upper === null ? `≥ ${formatDuration(b.lower)}` : `${formatDuration(b.lower)} – ${formatDuration(b.upper)}`);

export function Histogram({ bins, title, caption }: { bins: Bin[]; title: string; caption: string }) {
  const uid = useId();
  const [table, setTable] = useState(false);
  const [idx, setIdx] = useState<number | null>(null);
  const max = Math.max(1, ...bins.map((b) => b.count));
  const W = 640, H = 180, L = 8, B = 20, bw = (W - L * 2) / Math.max(1, bins.length);
  const onKey = (e: React.KeyboardEvent) => {
    const cur = idx ?? -1;
    const next = e.key === "ArrowRight" ? Math.min(bins.length - 1, cur + 1) : e.key === "ArrowLeft" ? Math.max(0, cur < 0 ? 0 : cur - 1) : e.key === "Home" ? 0 : e.key === "End" ? bins.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setIdx(next);
  };
  return (
    <figure className="m-0" data-testid="chart.histogram">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><span className="font-medium">{title}</span><span className="text-xs text-ink-3">{caption}</span></figcaption>
      <p className="mb-2"><button type="button" className="btn" aria-pressed={table} onClick={() => setTable((t) => !t)} data-testid="chart.histogram.toggle">View as table</button></p>
      {table ? (
        <div className="max-h-72 overflow-auto" tabIndex={0} role="region" aria-label={`${title} values`}>
          <table className="data" data-testid="chart.histogram.table"><caption className="sr-only">{title}</caption>
            <thead><tr><th scope="col">Duration range</th><th scope="col" className="num">Count</th></tr></thead>
            <tbody>{bins.map((b) => <tr key={b.lower}><th scope="row" className="font-normal">{label(b)}</th><td className="num">{formatCount(b.count)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div role="group" tabIndex={0} aria-label={`${title}. Histogram; use arrow keys to step through duration ranges.`} aria-describedby={`${uid}-r`} onKeyDown={onKey} data-testid="chart.histogram.plot">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden="true">
            {bins.map((b, i) => {
              const bh = (b.count / max) * (H - B - 8);
              return <rect key={b.lower} x={L + i * bw + 1} y={H - B - bh} width={Math.max(1, bw - 2)} height={bh} fill={idx === i ? "var(--tf-signal-strong)" : "var(--tf-signal)"} />;
            })}
            <line x1={L} x2={W - L} y1={H - B} y2={H - B} stroke="var(--tf-control-border)" />
            <text x={L} y={H - 5} fontSize="11" fill="var(--tf-ink-3)">{formatDuration(bins[0]?.lower ?? "0")}</text>
            <text x={W - L} y={H - 5} fontSize="11" textAnchor="end" fill="var(--tf-ink-3)">{bins.length ? `≥ ${formatDuration(bins[bins.length - 1]!.lower)}` : ""}</text>
          </svg>
        </div>
      )}
      <p id={`${uid}-r`} aria-live="polite" className="mt-2 min-h-5 text-sm text-ink-2" data-testid="chart.histogram.readout">
        {table ? "" : idx === null ? "Use left and right arrow keys to read each range." : `${label(bins[idx]!)}: ${formatCount(bins[idx]!.count)} requests`}
      </p>
    </figure>
  );
}
