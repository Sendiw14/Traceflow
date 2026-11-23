// Pure chart helpers (testable): scales, gap-aware path segments, nice ticks.
export interface ChartPoint { t: number; v: number | null; partial?: boolean }

/** Split into runs of consecutive non-null points; null buckets are gaps (no interpolation). */
export function segments(points: ChartPoint[]): ChartPoint[][] {
  const out: ChartPoint[][] = [];
  let cur: ChartPoint[] = [];
  for (const p of points) {
    if (p.v === null || p.partial) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out;
}

export function linearScale(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0 || 1;
  return (x: number) => r0 + ((x - d0) / span) * (r1 - r0);
}

/** 1-2-5 tick values from 0 to ≥ max, about `count` ticks. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) {
    ticks.push(Number(v.toPrecision(12)));
    if (v >= max) break;
  }
  return ticks;
}
