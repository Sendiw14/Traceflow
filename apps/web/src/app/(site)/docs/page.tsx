import Link from "next/link";
import { Callout, DocArticle, H2 } from "@/components/site/Doc";
import { CodeBlock } from "@/components/site/CodeBlock";
import { GITHUB } from "@/components/site/SiteChrome";

export const metadata = { title: "Documentation" };

const TOC = [{ id: "what", title: "What TRACEFLOW is" }, { id: "quickstart", title: "Quickstart" }, { id: "status", title: "What exists today" }, { id: "pages", title: "In these docs" }];

export default function DocsHome() {
  return (
    <DocArticle path="/docs" title="Documentation" lead="TRACEFLOW is a self-hostable, open-source tool for inspecting a request's journey across services." toc={TOC}>
      <H2 id="what">What TRACEFLOW is</H2>
      <p>You send OpenTelemetry traces to TRACEFLOW; it stores them in PostgreSQL and shows where latency and errors come from: a trace waterfall, a service list, a dependency map built from observed parent→child spans, and latency analytics. It is licensed under Apache-2.0 and the source is at <a href={GITHUB}>github.com/Sendiw14/Traceflow</a>.</p>
      <H2 id="quickstart">Quickstart</H2>
      <p>With Docker Compose and <code>make</code> installed, from a clone of the repository:</p>
      <CodeBlock label="Start the local stack" code={"make env\nmake up"} copyId="docs.quickstart.copy" />
      <p>Then open <code>http://127.0.0.1:3000/app</code>. The full walkthrough, including generating sample traces, is in <Link href="/docs/getting-started">Getting started</Link>.</p>
      <H2 id="status">What exists today</H2>
      <p>TRACEFLOW V1 is in development. This table is the honest state of the repository.</p>
      <div className="table-wrap"><table>
        <caption className="sr-only">Implementation status</caption>
        <thead><tr><th scope="col">Part</th><th scope="col">State</th></tr></thead>
        <tbody>
          <tr><th scope="row">OTLP/HTTP receiver (binary Protobuf) → PostgreSQL</th><td>Built; runs in the local Compose stack</td></tr>
          <tr><th scope="row">Query API (all operations in <code>api/openapi.yaml</code> 1.0.0)</th><td>Built</td></tr>
          <tr><th scope="row">Web app: overview, traces, trace detail, services, map, analytics, onboarding, settings</th><td>Built for the <code>local-dev</code> profile</td></tr>
          <tr><th scope="row">Synthetic read-only demo routes</th><td>Built; served when the profile allows them</td></tr>
          <tr><th scope="row">Operator sign-in (GitHub OAuth) for <code>operator-prod</code></th><td>Built; tested against a mocked GitHub only, not real GitHub</td></tr>
          <tr><th scope="row">Hosted deployments (<code>operator-prod</code>, <code>public-demo</code>): TLS, production Compose file, backups</th><td>Not built</td></tr>
        </tbody>
      </table></div>
      <Callout kind="warn" title="Not ready for real operator data">The local profile has no sign-in and no hosted deployment exists. Run TRACEFLOW only on a machine you control, bound to loopback as the Compose file does.</Callout>
      <H2 id="pages">In these docs</H2>
      <ul>
        <li><Link href="/docs/getting-started">Getting started</Link>: prerequisites, install, sample traces, troubleshooting.</li>
        <li><Link href="/docs/instrumentation">Instrumentation</Link>: what TRACEFLOW accepts and how the demo services send traces.</li>
        <li><Link href="/docs/architecture">Architecture</Link>: data flow, trust boundaries, retention, sampling.</li>
        <li><Link href="/docs/deployment">Deployment</Link>: the local stack and what is not built yet.</li>
        <li><Link href="/docs/security">Security</Link>: boundaries, defaults and limitations.</li>
      </ul>
    </DocArticle>
  );
}
