import Link from "next/link";
import { CodeBlock } from "@/components/site/CodeBlock";
import { Hero } from "@/components/site/Hero";
import { Journey } from "@/components/site/Journey";
import { MapFigure, MiniWaterfall } from "@/components/site/MiniWaterfall";
import { GITHUB } from "@/components/site/SiteChrome";
import { DEMO_TRACES } from "@/content/demo-traces";
import { allows, currentProfile } from "@/lib/profile";

export const metadata = { title: "TRACEFLOW — every request has a story" };

const FEATURES = [
  ["Trace waterfall, tree and table", "Follow one request across services. Select a span to see its attributes, events, links, status and timing. Everything is reachable from the keyboard."],
  ["Honest about gaps", "A span whose parent never arrived is labelled “parent span not received”. Estimated durations, clock skew and truncated traces are flagged, not hidden."],
  ["Services and latency", "Per-service request counts, error rates and p50/p95/p99 from observed SERVER spans, shown with how many samples back each number."],
  ["Dependency map", "Edges come only from spans where one service is the direct parent of another. A table lists every edge with the traces that prove it."],
  ["Ingestion visibility", "See whether spans are arriving, how many were rejected and why, before you wonder why a trace is missing."],
  ["Self-hostable", "PostgreSQL, one Go service, one Next.js app and an OpenTelemetry Collector, started with Docker Compose."],
] as const;

const FAQ = [
  ["Is TRACEFLOW production-ready?", "No. V1 is in development. The ingest path, query API and local web app work; operator sign-in and hosted deployments are not built yet."],
  ["What do I need to run it?", "Docker with Compose, make and openssl. The getting-started guide has the exact commands."],
  ["What telemetry does it accept?", "OpenTelemetry traces over OTLP/HTTP as binary Protobuf. JSON OTLP, metrics and logs are not supported."],
  ["Does it sample, estimate or guess?", "No. It shows the spans it received. If your SDK samples, dropped spans are not reconstructed, and every aggregate says which spans it covers."],
  ["Is the demo real data?", "No. It is synthetic traffic from three small demo services (gateway, orders, inventory). It is read-only and contains nothing private."],
  ["Can I put it on the internet?", "Not today. There is no sign-in yet, and remote ingestion is off by default. Run it on a machine you control."],
  ["What licence is it under?", "Apache-2.0."],
] as const;

export default function Home() {
  const demo = allows(currentProfile(), "demo");
  return (
    <div data-testid="home">
      <Hero demo={demo} />

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="problem-h">
        <h2 id="problem-h" className="font-serif text-3xl tracking-tight">When one request touches five services, logs stop being enough</h2>
        <div className="mt-4 grid gap-6 text-ink-2 md:grid-cols-2">
          <p className="m-0">The cause of a slow checkout or a 502 is often a few hops away from the service that returned it: in a call you did not know was slow, or in a span that never arrived.</p>
          <p className="m-0">TRACEFLOW stores the spans your services emit and lays them out as a waterfall, a service list and a dependency map, so you can follow the evidence instead of guessing.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="journey-h" data-testid="home.journey-section">
        <h2 id="journey-h" className="font-serif text-3xl tracking-tight">A request, five ways</h2>
        <p className="mt-2 max-w-2xl text-ink-2">The demo system sends five deterministic kinds of request. These are the real shapes of those traces, captured from a local run.</p>
        <div className="mt-6"><Journey demo={demo} /></div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="features-h" data-testid="home.features">
        <h2 id="features-h" className="font-serif text-3xl tracking-tight">What you get today</h2>
        <ul className="m-0 mt-6 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, d]) => (
            <li key={t} className="rounded-lg border border-line bg-paper p-4"><h3 className="m-0 text-base font-semibold">{t}</h3><p className="mt-2 text-sm text-ink-2">{d}</p></li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="walk-h" data-testid="home.walkthrough">
        <h2 id="walk-h" className="font-serif text-3xl tracking-tight">Waterfall and map</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-paper p-4"><h3 className="m-0 mb-3 text-base font-semibold">Trace waterfall</h3><MiniWaterfall spans={DEMO_TRACES.parallel} label="Parallel scenario" /></div>
          <div className="rounded-lg border border-line bg-paper p-4"><h3 className="m-0 mb-3 text-base font-semibold">Service map</h3><MapFigure /></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="arch-h" data-testid="home.architecture">
        <h2 id="arch-h" className="font-serif text-3xl tracking-tight">How it fits together</h2>
        <ol className="mt-4 max-w-3xl pl-5 text-ink-2">
          <li>Your services export spans over OTLP/HTTP to an OpenTelemetry Collector, which removes common secret-bearing attributes.</li>
          <li>The Collector forwards to the TRACEFLOW receiver (Go), which validates and stores spans in PostgreSQL. Duplicates are absorbed; conflicting replays are kept apart.</li>
          <li>A query API serves traces, services and dependencies to the web app, which is the only thing your browser talks to.</li>
        </ol>
        <p className="mt-3"><Link href="/docs/architecture">Read the architecture notes</Link></p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="start-h" data-testid="home.getting-started">
        <h2 id="start-h" className="font-serif text-3xl tracking-tight">Run it locally</h2>
        <div className="max-w-2xl"><CodeBlock label="From a clone of the repository" code={"make env\nmake up"} copyId="home.start.copy" />
          <p className="text-ink-2">Then open <code className="mono">http://127.0.0.1:3000/app</code>. <Link href="/docs/getting-started">Getting started</Link> covers prerequisites, sample traces and troubleshooting.</p></div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="oss-h" data-testid="home.oss">
        <h2 id="oss-h" className="font-serif text-3xl tracking-tight">Open source</h2>
        <p className="mt-3 max-w-2xl text-ink-2">TRACEFLOW is released under the Apache-2.0 licence. You can read the code, run it on your own machine and fork it. Design decisions are written down as architecture decision records in the repository, next to the code they explain.</p>
        <p className="mt-3"><a href={GITHUB}>Source on GitHub</a></p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="faq-h" data-testid="home.faq">
        <h2 id="faq-h" className="font-serif text-3xl tracking-tight">Questions</h2>
        <div className="mt-4 max-w-3xl divide-y divide-line rounded-lg border border-line bg-paper">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group p-4" data-testid="home.faq.item">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="mb-0 mt-2 text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="cta-h" data-testid="home.final-cta">
        <div className="rounded-lg border border-line bg-signal-tint p-8">
          <h2 id="cta-h" className="m-0 font-serif text-3xl tracking-tight">See a trace for yourself</h2>
          <p className="mt-2 max-w-xl text-ink-2">{demo ? "The demo is synthetic and read-only. Or clone the repository and run it locally." : "Clone the repository and run it locally."}</p>
          <p className="mt-5 flex flex-wrap gap-3">
            {demo && <Link href="/demo" className="btn btn-primary no-underline">Explore live demo</Link>}
            <Link href="/docs/getting-started" className="btn no-underline">Getting started</Link>
            <a href={GITHUB} className="btn no-underline">View GitHub</a>
          </p>
        </div>
      </section>
    </div>
  );
}
