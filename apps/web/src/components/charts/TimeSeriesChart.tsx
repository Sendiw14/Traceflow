"use client";

import { useId, useState } from "react";
import { type ChartPoint, linearScale, niceTicks, segments } from "@/lib/chart";
import { formatCount } from "@/lib/format";
import { formatDuration } from "@/lib/time/nanos";

export interface ChartSeries { id: string; label: string; color: string; dash?: string; points: ChartPoint[] }
export type Unit = "duration" | "percent" | "rate" | "count";

function fmt(unit: Unit, v: number | null): string {
  if (v === null) return "no data";
  switch (unit) {
    case "duration": return formatDuration(BigInt(Math.round(v)));
    case "percent": return `${(v * 100).toFixed(v >= 0.1 ? 1 : 2)} %`;
    case "rate": return `${v.toFixed(v >= 10 ? 1 : 2)} /s`;
    default: return formatCount(Math.round(v));
  }
}
const clock = (ms: number) => new Date(ms).toISOString().slice(11, 16);
const W = 640, H = 220, L = 64, R = 12, T = 12, B = 28;

export function TimeSeriesChart({ name, title, caption, series, unit, bucketSeconds }: {
  name: string; title: string; caption: string; series: ChartSeries[]; unit: Unit; bucketSeconds: number;
}) {
  const uid = useId();
  const [table, setTable] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState<number | null>(null);
  const visible = series.filter((s) => !hidden.has(s.id));
  const base = series[0]?.points ?? [];
  const n = base.length;
  const times = base.map((p) => p.t);
  const t0 = times[0] ?? 0, t1 = (times[n - 1] ?? 0) + bucketSeconds * 1000;
  const vals = visible.flatMap((s) => s.points.map((p) => p.v).filter((v): v is number => v !== null));
  const max = Math.max(0, ...vals);
  const ticks = niceTicks(max);
  const x = linearScale(t0, t1, L, W - R);
  const y = linearScale(0, ticks[ticks.length - 1] ?? 1, H - B, T);
  const last = base[n - 1];
  const hasData = vals.length > 0;

  const onKey = (e: React.KeyboardEvent) => {
    if (!n) return;
    const cur = idx ?? -1;
    const next = e.key === "ArrowRight" ? Math.min(n - 1, cur + 1) : e.key === "ArrowLeft" ? Math.max(0, cur < 0 ? 0 : cur - 1) : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setIdx(next);
  };
  const readout = idx === null ? "Use left and right arrow keys to read each bucket." :
    `${clock(times[idx]!)} UTC${base[idx]?.partial ? " (still filling)" : ""}: ` +
    visible.map((s) => `${s.label} ${fmt(unit, s.points[idx]?.v ?? null)}`).join(" · ");

  return (
    <figure className="m-0" data-testid={`chart.${name}`}>
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-ink-3">{caption}</span>
      </figcaption>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        {series.map((s) => (
          <button key={s.id} type="button" className="btn" aria-pressed={!hidden.has(s.id)}
            onClick={() => setHidden((h) => { const c = new Set(h); if (c.has(s.id)) c.delete(s.id); else c.add(s.id); return c; })}>
            <svg width="22" height="8" aria-hidden="true" className="mr-1 inline"><line x1="0" y1="4" x2="22" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} /></svg>
            {s.label}
          </button>
        ))}
        <button type="button" className="btn ml-auto" aria-pressed={table} onClick={() => setTable((t) => !t)} data-testid={`chart.${name}.toggle`}>
          View as table
        </button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto" tabIndex={0} role="region" aria-label={`${title} values`}>
          <table className="data" data-testid={`chart.${name}.table`}>
            <caption className="sr-only">{title}</caption>
            <thead><tr><th scope="col">Bucket start (UTC)</th>{visible.map((s) => <th key={s.id} scope="col" className="num">{s.label}</th>)}</tr></thead>
            <tbody>
              {base.map((p, i) => (
                <tr key={p.t}>
                  <th scope="row" className="font-normal">{clock(p.t)}{p.partial ? " (still filling)" : ""}</th>
                  {visible.map((s) => <td key={s.id} className="num">{fmt(unit, s.points[i]?.v ?? null)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !hasData ? (
        <p className="rounded-md bg-sunken p-4 text-sm text-ink-2" data-state="empty-window">No data points in this window for the selected series.</p>
      ) : (
        <div role="group" tabIndex={0} aria-label={`${title}. Chart; use arrow keys to step through buckets.`} aria-describedby={`${uid}-readout`} onKeyDown={onKey}
          className="rounded-md" data-testid={`chart.${name}.plot`}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden="true">
            <defs>
              <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--tf-control-border)" strokeWidth="2" />
              </pattern>
            </defs>
            {ticks.map((tv) => (
              <g key={tv}>
                <line x1={L} x2={W - R} y1={y(tv)} y2={y(tv)} stroke="var(--tf-grid)" />
                <text x={L - 6} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="var(--tf-ink-3)">{fmt(unit, tv)}</text>
              </g>
            ))}
            {[0, 1 / 3, 2 / 3, 1].map((f) => {
              const tt = t0 + f * (t1 - t0);
              return <text key={f} x={x(tt)} y={H - 8} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} fontSize="11" fill="var(--tf-ink-3)">{clock(tt)}</text>;
            })}
            {last?.partial && (
              <rect data-testid={`chart.${name}.partial`} x={x(last.t)} y={T} width={Math.max(2, x(last.t + bucketSeconds * 1000) - x(last.t))} height={H - B - T} fill={`url(#${uid}-hatch)`} opacity="0.5" />
            )}
            {visible.map((s) => (
              <g key={s.id} stroke={s.color} fill="none" strokeWidth="2" strokeDasharray={s.dash}>
                {segments(s.points).map((seg) =>
                  seg.length === 1
                    ? <circle key={seg[0]!.t} cx={x(seg[0]!.t)} cy={y(seg[0]!.v!)} r="3" fill={s.color} stroke="none" />
                    : <polyline key={seg[0]!.t} points={seg.map((p) => `${x(p.t)},${y(p.v!)}`).join(" ")} />)}
              </g>
            ))}
            {idx !== null && times[idx] !== undefined && (
              <line x1={x(times[idx]!)} x2={x(times[idx]!)} y1={T} y2={H - B} stroke="var(--tf-ink)" strokeWidth="1" strokeDasharray="2 2" />
            )}
          </svg>
        </div>
      )}
      <p id={`${uid}-readout`} aria-live="polite" className="mt-2 min-h-5 text-sm text-ink-2" data-testid={`chart.${name}.readout`}>{table ? "" : readout}</p>
    </figure>
  );
}
