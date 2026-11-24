import Link from "next/link";
import { Callout, DocArticle, H2 } from "@/components/site/Doc";
import { CodeBlock } from "@/components/site/CodeBlock";

export const metadata = { title: "Architecture" };

const TOC = [{ id: "shape", title: "Shape" }, { id: "flow", title: "Data flow" }, { id: "boundaries", title: "Trust boundaries" }, { id: "storage", title: "Storage and replays" }, { id: "queries", title: "What the numbers mean" }, { id: "retention", title: "Retention" }, { id: "sampling", title: "Sampling" }, { id: "profiles", title: "Deployment profiles" }];

const FLOW = `demo services / your apps
        │  OTLP/HTTP protobuf (private network)
        ▼
OpenTelemetry Collector  (receiver → redaction → exporter with bounded queue)
        │  OTLP/HTTP protobuf, gzip
        ▼
trace-api (Go)   ingest :4318 (private)    query :8080 (private)
        │                                      ▲
        ▼                                      │ REST, bearer service token
PostgreSQL 18                              web (Next.js: site, docs, app, BFF)
                                               ▲
                                               │ HTTP
                                            browser`;

export default function Architecture() {
  return (
    <DocArticle path="/docs/architecture" title="Architecture" lead="One Go service, one PostgreSQL database and one Next.js app. This page follows the repository's architecture notes and ADRs." toc={TOC}>
      <H2 id="shape">Shape</H2>
      <p>TRACEFLOW is a modular monolith (ADR-0001): one Go binary, <code>trace-api</code>, with two listeners (OTLP ingest and the query API), PostgreSQL as the only datastore, and a Next.js application that serves the public site, the docs, the dashboard and the backend-for-frontend (BFF). The browser only ever talks to Next.js.</p>
      <H2 id="flow">Data flow</H2>
      <CodeBlock label="Data flow" lang="text" code={FLOW} copyId="docs.arch.copy-flow" />
      <ul>
        <li>The query API is described by <code>api/openapi.yaml</code> (version 1.0.0). The web app is generated against it.</li>
        <li>The web app reads <code>TRACE_API_URL</code> and the service token from its server environment. Neither reaches the browser.</li>
        <li>Dashboard responses carry <code>Cache-Control: private, no-store</code>.</li>
      </ul>
      <H2 id="boundaries">Trust boundaries</H2>
      <div className="table-wrap"><table>
        <caption className="sr-only">Trust boundaries</caption>
        <thead><tr><th scope="col">Boundary</th><th scope="col">What crosses it</th><th scope="col">Control</th></tr></thead>
        <tbody>
          <tr><th scope="row">Browser → web</th><td>Page requests</td><td>Route gating by deployment profile, enforced on the server; in <code>operator-prod</code> a signed-in, allow-listed operator is required for <code>/app</code></td></tr>
          <tr><th scope="row">Web → trace-api query</th><td>Service-token requests</td><td>Private Docker network and a 256-bit bearer token</td></tr>
          <tr><th scope="row">SDK → Collector → trace-api ingest</th><td>Untrusted OTLP payloads</td><td>Size limits, validation, redaction, internal-only network</td></tr>
          <tr><th scope="row">trace-api → PostgreSQL</th><td>SQL</td><td>Parameterised queries; database on its own internal network</td></tr>
        </tbody>
      </table></div>
      <p>Details and the full threat list are in <Link href="/docs/security">Security</Link>.</p>
      <H2 id="storage">Storage and replays</H2>
      <p>Spans are unique by trace ID and span ID. Each stored span keeps a content hash. If the same span arrives again with the same content it is counted as a duplicate and acknowledged; if it arrives with different content, the first write wins and the new payload is recorded as a conflict and reported as rejected (ADR-0002). Trace summaries are recomputed from stored spans inside the ingest transaction, so late and out-of-order spans update them. Writers to the same trace are serialised.</p>
      <H2 id="queries">What the numbers mean</H2>
      <ul>
        <li><strong>Latency, error rate and throughput</strong> are computed from observed SERVER spans only, by the span start time in the window.</li>
        <li><strong>Percentiles</strong> use the nearest-rank method. A percentile is shown only with enough samples: p50 needs 1, p95 needs 20, p99 needs 100. Below that the app shows “—” and says how many samples it has, never 0.</li>
        <li><strong>Spans with negative duration</strong> (clock skew) are excluded from percentiles and the time axis, and flagged.</li>
        <li><strong>Dependency edges</strong> exist only where a stored span in service A is the direct parent of a span in service B. Co-occurrence and naming never create an edge, and a missing edge is not proof of no dependency.</li>
        <li><strong>A span whose parent was not received</strong> is labelled “parent span not received”. TRACEFLOW does not guess a parent.</li>
      </ul>
      <H2 id="retention">Retention</H2>
      <p>Data older than the retention period is deleted by an hourly job. The default is 7 days in <code>local-dev</code> and can be set from 1 to 90 days on the Settings page. There are no backups in <code>local-dev</code>.</p>
      <H2 id="sampling">Sampling</H2>
      <p>TRACEFLOW does not sample and does not reconstruct what upstream sampling dropped. Every aggregate is labelled with the population it covers.</p>
      <H2 id="profiles">Deployment profiles</H2>
      <p>The same images run under three profiles, selected by <code>TRACEFLOW_PROFILE</code>:</p>
      <div className="table-wrap"><table>
        <caption className="sr-only">Deployment profiles</caption>
        <thead><tr><th scope="col">Profile</th><th scope="col">Purpose</th><th scope="col">Routes served by the web app</th><th scope="col">State</th></tr></thead>
        <tbody>
          <tr><th scope="row"><code>local-dev</code></th><td>Your machine</td><td>Everything: site, docs, <code>/app</code>, <code>/demo</code></td><td>Built</td></tr>
          <tr><th scope="row"><code>operator-prod</code></th><td>A private single-operator deployment</td><td>Site, docs, <code>/login</code>, <code>/app</code> (after sign-in); <code>/demo</code> is 404</td><td>Gating and sign-in built (real GitHub untested); deployment not built</td></tr>
          <tr><th scope="row"><code>public-demo</code></th><td>A separate read-only synthetic demo</td><td>Site, docs, <code>/demo</code>; <code>/app</code> is 404</td><td>Route gating built; deployment not built</td></tr>
        </tbody>
      </table></div>
      <Callout title="A missing or unknown profile serves neither">If <code>TRACEFLOW_PROFILE</code> is missing or not one of the three values, both <code>/app</code> and <code>/demo</code> return 404.</Callout>
    </DocArticle>
  );
}
