"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { DEMO_TRACES, SCENARIOS, type Scenario } from "@/content/demo-traces";
import { MiniWaterfall } from "./MiniWaterfall";

const COPY: Record<Scenario, { title: string; text: string }> = {
  normal: { title: "Normal", text: "One request fans out gateway → orders → inventory. Each hop is a CLIENT span in the caller and a SERVER span in the callee, linked by W3C trace context." },
  slow: { title: "Slow", text: "Same path, but the whole chain takes about 0.8 s. Every span on the path is about as long as the deepest one, SELECT stock in inventory, so the waterfall shows where the time sits." },
  error: { title: "Error", text: "The gateway returns 502. The spans from the inventory server span up to the gateway are marked error; the database client span below is not, and TRACEFLOW shows the status exactly as recorded." },
  parallel: { title: "Parallel", text: "Orders calls inventory twice at the same time. The two branches overlap in the waterfall instead of running one after the other." },
  "missing-parent": { title: "Missing parent", text: "One span is dropped before export. The gateway client span points to a parent that never arrived, so TRACEFLOW lists it as “parent span not received” and does not invent a parent." },
};

/** Tabs (arrow keys, Home/End) over the five demo scenarios. Content is static, so there is no autoplay. */
export function Journey({ demo }: { demo: boolean }) {
  const [active, setActive] = useState<Scenario>("normal");
  const uid = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: React.KeyboardEvent) => {
    const i = SCENARIOS.indexOf(active);
    const n = e.key === "ArrowRight" ? (i + 1) % SCENARIOS.length : e.key === "ArrowLeft" ? (i + SCENARIOS.length - 1) % SCENARIOS.length : e.key === "Home" ? 0 : e.key === "End" ? SCENARIOS.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault();
    const next = SCENARIOS[n]!;
    setActive(next);
    refs.current[next]?.focus();
  };
  return (
    <div data-testid="home.journey">
      <div role="tablist" aria-label="Demo request scenarios" className="flex flex-wrap gap-2" onKeyDown={onKey}>
        {SCENARIOS.map((s) => (
          <button key={s} ref={(el) => { refs.current[s] = el; }} role="tab" type="button" id={`${uid}-t-${s}`} aria-controls={`${uid}-p`} aria-selected={active === s} tabIndex={active === s ? 0 : -1}
            onClick={() => setActive(s)} data-testid="home.journey.step"
            className={`rounded-md border px-3 py-1.5 text-sm ${active === s ? "border-signal-strong bg-signal-tint font-semibold text-signal-strong" : "border-control bg-paper text-ink-2"}`}>
            {COPY[s].title}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${uid}-p`} aria-labelledby={`${uid}-t-${active}`} tabIndex={0} className="mt-4 grid gap-6 rounded-lg border border-line bg-paper p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <h3 className="m-0 text-lg font-semibold">{COPY[active].title}</h3>
          <p className="mt-2 text-ink-2">{COPY[active].text}</p>
          {demo && <p className="mt-3"><Link href="/demo">Look for traces like this in the live demo</Link></p>}
        </div>
        <MiniWaterfall spans={DEMO_TRACES[active]} label={COPY[active].title} />
      </div>
    </div>
  );
}
