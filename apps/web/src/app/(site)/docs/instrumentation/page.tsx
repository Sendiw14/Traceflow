import Link from "next/link";
import { CodeBlock } from "@/components/site/CodeBlock";
import { Callout, DocArticle, H2 } from "@/components/site/Doc";
import { COLLECTOR_YAML } from "@/content/collector-config";

export const metadata = { title: "Instrumentation" };

const TOC = [{ id: "accepts", title: "What TRACEFLOW accepts" }, { id: "path", title: "The path a span takes" }, { id: "sdk", title: "SDK example (the demo)" }, { id: "collector", title: "Collector configuration" }, { id: "expect", title: "What you should see" }, { id: "caveats", title: "Delivery and sampling caveats" }];

const SDK = `exp, err := otlptracehttp.New(ctx,
    otlptracehttp.WithEndpointURL(env("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://collector:4318/v1/traces")))
res, err := sdkresource.New(ctx, sdkresource.WithAttributes(
    semconv.ServiceName(service),
    attribute.String("deployment.environment.name", "demo")))
tp := sdktrace.NewTracerProvider(
    sdktrace.WithResource(res),
    sdktrace.WithSpanProcessor(sdktrace.NewBatchSpanProcessor(exp, sdktrace.WithBatchTimeout(500*time.Millisecond))))
otel.SetTracerProvider(tp)
otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
    propagation.TraceContext{}, propagation.Baggage{}))`;

export default function Instrumentation() {
  return (
    <DocArticle path="/docs/instrumentation" title="Instrumentation" lead="How spans reach TRACEFLOW, shown with the three demo services that ship in the repository." toc={TOC}>
      <H2 id="accepts">What TRACEFLOW accepts</H2>
      <ul>
        <li>OTLP over HTTP, <strong>binary Protobuf traces only</strong>: <code>POST /v1/traces</code> with <code>Content-Type: application/x-protobuf</code>. JSON OTLP is not supported and is answered with 415.</li>
        <li><code>Content-Encoding</code> may be <code>gzip</code> or absent. Other encodings get 415.</li>
        <li>Limits: 4 MiB compressed and 16 MiB decompressed per request (413 above that), 10,000 spans per request and 50,000 spans per trace.</li>
        <li>A 200 response is sent only after the data is committed to PostgreSQL. A storage outage returns 503 with <code>Retry-After</code>; overload returns 429.</li>
        <li>A span without <code>service.name</code> in its resource is stored under the service name <code>unknown_service</code>.</li>
        <li>Resending the same span is harmless: identical replays are counted as duplicates. A different payload under an existing trace and span ID is rejected as a conflict and the first write is kept.</li>
      </ul>
      <H2 id="path">The path a span takes</H2>
      <ol>
        <li>Your application&apos;s OpenTelemetry SDK exports spans over OTLP/HTTP to an OpenTelemetry Collector.</li>
        <li>The Collector removes common secret-bearing attributes, batches and forwards to the trace-api ingest listener on port 4318, gzip-compressed.</li>
        <li>trace-api validates, normalises and stores the spans in one database transaction per request.</li>
      </ol>
      <Callout title="Ingest is not published to the host">In <code>compose.yaml</code> neither the Collector nor trace-api ingest publishes a port to your machine. The demo services reach the Collector over the internal <code>ingest</code> Docker network. This is deliberate: remote ingestion is off by default (see <Link href="/docs/security">Security</Link>).</Callout>
      <H2 id="sdk">SDK example (the demo)</H2>
      <p>The demo services in <code>examples/demo-system</code> are Go programs using the OpenTelemetry Go SDK. This is the tracing setup from <code>setupTracing</code>, simplified (error handling and the test-only span filter are left out):</p>
      <CodeBlock label="OpenTelemetry Go SDK setup" lang="go" code={SDK} copyId="docs.instr.copy-sdk" />
      <p>The exporter endpoint comes from the standard <code>OTEL_EXPORTER_OTLP_TRACES_ENDPOINT</code> variable and defaults to <code>http://collector:4318/v1/traces</code>. W3C trace context propagation links the gateway, orders and inventory spans into one trace. Each service handler starts a SERVER span, and its outgoing HTTP calls are CLIENT spans.</p>
      <H2 id="collector">Collector configuration</H2>
      <p>This is <code>infra/otel/collector.yaml</code> from the repository, used by the Compose stack with the pinned <code>otel/opentelemetry-collector-contrib</code> 0.165.0 image. The exporter is named <code>otlp_http</code> in this release, sends binary Protobuf (<code>encoding: proto</code>) with gzip, and keeps a bounded in-memory queue.</p>
      <CodeBlock label="infra/otel/collector.yaml" lang="yaml" code={COLLECTOR_YAML} copyId="docs.instr.copy-collector" />
      <H2 id="expect">What you should see</H2>
      <p>Running <code>docker compose run --rm load</code> sends one request per scenario through the gateway. In the <code>normal</code> scenario the trace has six spans across three services:</p>
      <CodeBlock label="Span tree of a normal trace" lang="text" code={"gateway    GET /checkout   (SERVER)\ngateway      GET           (CLIENT)\norders         GET /orders (SERVER)\norders           GET       (CLIENT)\ninventory          GET /stock    (SERVER)\ninventory            SELECT stock (CLIENT)"} copyId="docs.instr.copy-tree" />
      <p>Open it from <code>/app/traces</code>. The <code>parallel</code> scenario adds a second inventory call in parallel, <code>slow</code> makes the whole chain take about 0.8 s, <code>error</code> marks the chain as failed, and <code>missing-parent</code> drops one span before export so the trace is incomplete.</p>
      <H2 id="caveats">Delivery and sampling caveats</H2>
      <ul>
        <li>The Collector acknowledges the SDK when data enters its queue, <strong>before</strong> TRACEFLOW commits it. If the Collector crashes or its queue overflows, queued spans can be lost. Between the Collector and the database delivery is at-least-once, with duplicates absorbed. TRACEFLOW does not claim exactly-once or zero-loss delivery.</li>
        <li>TRACEFLOW shows the spans it received. If your SDK or Collector samples, dropped spans are not reconstructed, and aggregates describe observed SERVER spans only.</li>
        <li>Spans can arrive late or out of order. A trace page can gain spans after you open it; it says when it was last updated.</li>
      </ul>
    </DocArticle>
  );
}
