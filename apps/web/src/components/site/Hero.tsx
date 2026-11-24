"use client";

import Link from "next/link";
import { useState } from "react";
import { DEMO_TRACES } from "@/content/demo-traces";
import { GITHUB } from "./SiteChrome";
import { MiniWaterfall } from "./MiniWaterfall";

/** Hero. "Skip animation" is the first focusable control in the hero; the line-draw runs once (≈0.8 s) and never loops. */
export function Hero({ demo }: { demo: boolean }) {
  const [skipped, setSkipped] = useState(false);
  return (
    <section className="mx-auto max-w-6xl px-4 pb-12 pt-6 lg:pt-10" aria-labelledby="hero-h" data-testid="home.hero">
      <p className="m-0 flex justify-end">
        <button type="button" className="btn text-xs" onClick={() => setSkipped(true)} disabled={skipped} data-testid="home.hero.skip">
          {skipped ? "Animation skipped" : "Skip animation"}
        </button>
      </p>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <p className="m-0 text-sm font-medium uppercase tracking-widest text-signal-strong">Distributed tracing, self-hosted</p>
          <h1 id="hero-h" className="mt-3 font-serif text-5xl leading-[1.05] tracking-tight md:text-6xl">Every request has a story. See the whole picture.</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-2">TRACEFLOW is an open-source tool for following one request across your services and finding where latency and errors start. V1 is in development.</p>
          <p className="mt-8 flex flex-wrap gap-3">
            {demo ? <Link href="/demo" className="btn btn-primary no-underline" data-testid="home.cta-demo">Explore live demo</Link> : <Link href="/docs" className="btn btn-primary no-underline" data-testid="home.cta-docs">Read the docs</Link>}
            <a href={GITHUB} className="btn no-underline" data-testid="home.cta-github">View GitHub</a>
          </p>
        </div>
        <div data-testid="home.hero.line" data-static={skipped ? "true" : "false"} className={skipped ? "hero-skipped" : ""}>
          <div className="rounded-lg border border-line bg-paper p-4">
            <MiniWaterfall spans={DEMO_TRACES.normal} label="One request across three services" animate />
          </div>
        </div>
      </div>
    </section>
  );
}
