import Link from "next/link";
import { qs } from "@/lib/query/params";
import { RANGES, type Range } from "@/lib/time/window";

/** Range presets as plain links: URL is state, works without JavaScript. */
export function RangeBar({ base, range, params = {} }: { base: string; range: Range; params?: Record<string, string | undefined> }) {
  return (
    <nav aria-label="Time range" className="flex flex-wrap items-center gap-1" data-testid="time-range">
      <span className="mr-1 text-sm text-ink-3">Last</span>
      {RANGES.map((r) => (
        <Link
          key={r}
          href={`${base}${qs({ ...params, range: r === "1h" ? undefined : r })}`}
          aria-current={r === range ? "true" : undefined}
          className={`rounded-md border px-3 py-1 text-sm no-underline ${r === range ? "border-signal-strong bg-signal-tint font-semibold text-signal-strong" : "border-control bg-paper text-ink-2"}`}
        >
          {r}
        </Link>
      ))}
    </nav>
  );
}

export function SamplingCaveat() {
  return (
    <p className="mt-8 border-t border-line pt-3 text-xs text-ink-3" data-testid="sampling-caveat">
      Observed spans only; sampling is not reconstructed.
    </p>
  );
}

/** Service scope as a plain GET form (native select; works without JavaScript). */
export function ServiceScope({ action, range, service, services, hidden = {} }: {
  action: string; range: Range; service?: string; services: string[]; hidden?: Record<string, string | undefined>;
}) {
  const options = service && !services.includes(service) ? [service, ...services] : services;
  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2" data-testid="service-scope">
      {range !== "1h" && <input type="hidden" name="range" value={range} />}
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label htmlFor="scope-service" className="text-sm text-ink-3">Service</label>
      <select id="scope-service" name="service" defaultValue={service ?? ""} className="field">
        <option value="">All services</option>
        {options.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button type="submit" className="btn">Apply</button>
    </form>
  );
}
