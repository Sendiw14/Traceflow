import type { DemoSpan } from "@/content/demo-traces";

const MIN_PCT = 0.8;

function depthOf(spans: DemoSpan[]): Map<string, number> {
  const byId = new Map(spans.map((s) => [s.id, s]));
  const memo = new Map<string, number>();
  const d = (s: DemoSpan): number => {
    if (memo.has(s.id)) return memo.get(s.id)!;
    const p = s.parent && s.parentPresent ? byId.get(s.parent) : undefined;
    const v = p ? d(p) + 1 : 0;
    memo.set(s.id, v);
    return v;
  };
  spans.forEach(d);
  return memo;
}

/** Static waterfall of a captured demo trace. Bars are decorative; the list text carries every fact. */
export function MiniWaterfall({ spans, label, animate = false }: { spans: DemoSpan[]; label: string; animate?: boolean }) {
  const end = Math.max(...spans.map((s) => s.startMs + s.durMs));
  const depth = depthOf(spans);
  return (
    <figure className="m-0" data-testid="home.waterfall">
      <figcaption className="mb-2 text-xs text-ink-3">{label} · synthetic demo trace · total {end.toFixed(1)} ms</figcaption>
      <ol className={`m-0 list-none space-y-1 p-0 ${animate ? "hero-anim" : ""}`}>
        {spans.map((s, i) => {
          const left = (s.startMs / end) * 100;
          const width = Math.max(MIN_PCT, (s.durMs / end) * 100);
          const err = s.status === "error";
          return (
            <li key={s.id} className="grid grid-cols-[minmax(120px,40%)_1fr] items-center gap-2 text-xs sm:text-sm" style={{ ["--i" as string]: i }}>
              <span className="min-w-0 truncate" style={{ paddingLeft: `${(depth.get(s.id) ?? 0) * 12}px` }}>
                {err && <><span aria-hidden="true" className="text-error">✕ </span><span className="sr-only">error: </span></>}
                <span className="text-ink-3">{s.service}</span> {s.name}
                {!s.parentPresent && <span className="ml-1 rounded-sm bg-[var(--tf-warning-tint)] px-1 text-[var(--tf-warning-text)]">parent span not received</span>}
                <span className="sr-only">, {s.durMs.toFixed(1)} ms</span>
              </span>
              <span className="relative h-4 border-l border-grid" aria-hidden="true">
                <span className={`bar absolute top-0.5 h-3 rounded-sm ${err ? "border border-error bg-error" : "bg-signal"}`} style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} />
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/** Static three-service map of the demo's observed edges (gateway → orders → inventory). */
export function MapFigure() {
  const box = (x: number, name: string) => (
    <g key={name} transform={`translate(${x} 20)`}>
      <rect width="120" height="48" rx="8" fill="var(--tf-paper)" stroke="var(--tf-ink-2)" strokeWidth="2" />
      <text x="60" y="29" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--tf-ink)">{name}</text>
    </g>
  );
  return (
    <figure className="m-0" data-testid="home.map">
      <svg viewBox="0 0 440 88" className="block h-auto w-full" role="img" aria-labelledby="map-fig-t map-fig-d">
        <title id="map-fig-t">Service map of the demo system</title>
        <desc id="map-fig-d">gateway calls orders, and orders calls inventory. Edges come from observed parent to child spans.</desc>
        <defs><marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--tf-ink-3)" /></marker></defs>
        {box(10, "gateway")}{box(160, "orders")}{box(310, "inventory")}
        <path d="M130 44H158" stroke="var(--tf-ink-3)" strokeWidth="2.5" markerEnd="url(#map-arrow)" />
        <path d="M280 44H308" stroke="var(--tf-ink-3)" strokeWidth="2.5" markerEnd="url(#map-arrow)" />
      </svg>
      <figcaption className="mt-2 text-xs text-ink-3">Synthetic demo system. An edge exists only where a span in one service is the direct parent of a span in another.</figcaption>
    </figure>
  );
}
