import Link from "next/link";
import { CodeBlock } from "@/components/site/CodeBlock";
import { Callout, DocArticle, H2 } from "@/components/site/Doc";
import { GITHUB } from "@/components/site/SiteChrome";

export const metadata = { title: "Getting started" };

const TOC = [{ id: "prereq", title: "Prerequisites" }, { id: "install", title: "Install and start" }, { id: "traces", title: "Generate sample traces" }, { id: "find", title: "Find a trace" }, { id: "stop", title: "Stop" }, { id: "trouble", title: "Troubleshooting" }];

export default function GettingStarted() {
  return (
    <DocArticle path="/docs/getting-started" title="Getting started" lead="Run the whole local stack with Docker Compose and look at your first trace." toc={TOC}>
      <H2 id="prereq">Prerequisites</H2>
      <ul>
        <li>Docker with the Compose plugin (<code>docker compose</code>).</li>
        <li><code>make</code> and <code>openssl</code>: <code>make env</code> uses <code>openssl rand</code> to create the service token.</li>
        <li>Git, to clone <a href={GITHUB}>the repository</a>.</li>
      </ul>
      <H2 id="install">Install and start</H2>
      <CodeBlock label="Clone and configure" code={`git clone ${GITHUB}.git\ncd Traceflow\nmake env`} copyId="docs.gs.copy-env" />
      <p><code>make env</code> writes <code>.env</code> from <code>.env.example</code> with a fresh random service token and prints <code>wrote .env</code>. It never overwrites an existing <code>.env</code>. The values in the template are local-only placeholders; <code>.env</code> is not committed.</p>
      <CodeBlock label="Build and start" code="make up" copyId="docs.gs.copy-up" />
      <p><code>make up</code> runs <code>docker compose up -d --build --wait</code>: PostgreSQL, trace-api, the web app, an OpenTelemetry Collector and three demo services (gateway, orders, inventory). The web app is published on <code>127.0.0.1:3000</code> only; every other service is on internal Docker networks.</p>
      <p>Open <code>http://127.0.0.1:3000/app</code>. A <code>traffic</code> service in the Compose file runs the demo scenarios every 15 seconds, so traces start appearing shortly after the stack is healthy.</p>
      <H2 id="traces">Generate sample traces</H2>
      <p>To trigger each scenario once and see the trace IDs:</p>
      <CodeBlock label="Run the scenarios once" code="docker compose run --rm load" copyId="docs.gs.copy-load" />
      <p>It prints one line per scenario: the scenario name, the trace ID and the HTTP status the gateway returned. The five deterministic scenarios are <code>normal</code>, <code>slow</code>, <code>error</code>, <code>parallel</code> and <code>missing-parent</code>.</p>
      <CodeBlock label="Example output" lang="text" code={"normal 3947027aba1f55ab5ad505888372f803 200\nslow b7e2c7575030cd5f02333777ad2a8396 200\nerror b4577ee4debd8278e057e22a49d7fac4 502\nparallel d0fdcab758b258d629152a5a41ba453f 200\nmissing-parent 1b499b149efe5828578270ad9adb7439 200"} copyId="docs.gs.copy-output" />
      <p>The trace IDs differ on every run. The <code>error</code> scenario returns 502 on purpose.</p>
      <H2 id="find">Find a trace</H2>
      <ol>
        <li>Open <code>/app/traces</code> and pick the newest trace, or paste an ID into <code>/app/traces/&lt;trace ID&gt;</code>.</li>
        <li>For the <code>error</code> scenario, filter by status “Has error spans”, open the trace and use <em>Next error span</em> to jump to the failing span.</li>
        <li>For <code>missing-parent</code>, the trace page shows a span under “Parent span not received”. TRACEFLOW does not invent a parent for it.</li>
        <li>Open <code>/app/map</code> to see the gateway → orders → inventory dependency edges derived from the spans.</li>
      </ol>
      <p>Before you have any data, <code>/app/onboarding</code> shows whether TRACEFLOW has received spans yet.</p>
      <H2 id="stop">Stop</H2>
      <CodeBlock label="Stop the stack" code="make down" copyId="docs.gs.copy-down" />
      <p><code>make ps</code> lists the services and <code>make logs</code> prints recent logs. Stopping keeps the PostgreSQL data in the <code>pgdata</code> Docker volume.</p>
      <H2 id="trouble">Troubleshooting</H2>
      <ul>
        <li><strong>Compose says a variable is not set</strong> (for example “set in .env” or “run make env”): run <code>make env</code> first.</li>
        <li><strong><code>/app</code> returns 404:</strong> the app routes are only served when <code>TRACEFLOW_PROFILE</code> is <code>local-dev</code> or <code>operator-prod</code>. The template sets <code>local-dev</code>.</li>
        <li><strong>The page says TRACEFLOW cannot reach its API:</strong> check <code>make ps</code> and <code>make logs</code>. The web service waits for trace-api to be healthy, and trace-api waits for PostgreSQL.</li>
        <li><strong>Port 3000 is in use:</strong> Compose cannot bind <code>127.0.0.1:3000</code>. Free the port and run <code>make up</code> again.</li>
        <li><strong>No traces yet:</strong> wait for the <code>traffic</code> service, or run <code>docker compose run --rm load</code>, then refresh. <Link href="/docs/instrumentation">Instrumentation</Link> explains how spans reach TRACEFLOW.</li>
      </ul>
      <Callout title="Local only">The local profile has no sign-in. It is meant for your own machine. See <Link href="/docs/security">Security</Link> and <Link href="/docs/deployment">Deployment</Link>.</Callout>
    </DocArticle>
  );
}
