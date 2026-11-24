import Link from "next/link";
import { CodeBlock } from "@/components/site/CodeBlock";
import { Callout, DocArticle, H2 } from "@/components/site/Doc";

export const metadata = { title: "Deployment" };

const TOC = [{ id: "local", title: "Local stack" }, { id: "config", title: "Configuration" }, { id: "lifecycle", title: "Start, stop, update" }, { id: "data", title: "Data" }, { id: "notbuilt", title: "Not built yet" }];

export default function Deployment() {
  return (
    <DocArticle path="/docs/deployment" title="Deployment" lead="Today the supported way to run TRACEFLOW is the local Docker Compose stack." toc={TOC}>
      <H2 id="local">Local stack</H2>
      <p><code>compose.yaml</code> defines these services: <code>postgres</code> (PostgreSQL 18.7), <code>trace-api</code>, <code>web</code>, <code>collector</code> (OpenTelemetry Collector contrib 0.165.0), the demo services <code>gateway</code>, <code>orders</code> and <code>inventory</code>, a <code>traffic</code> generator, and a one-shot <code>load</code> service. Setup steps are in <Link href="/docs/getting-started">Getting started</Link>.</p>
      <ul>
        <li>Only <code>web</code> is published, on <code>127.0.0.1:3000</code>. The networks <code>app</code>, <code>ingest</code>, <code>data</code> and <code>demo</code> are internal.</li>
        <li>PostgreSQL is only on the <code>data</code> network. The web service is never on the <code>data</code> or <code>ingest</code> networks.</li>
        <li>The web, trace-api, Collector and demo containers run with a read-only root filesystem and <code>no-new-privileges</code>.</li>
      </ul>
      <H2 id="config">Configuration</H2>
      <p><code>make env</code> creates <code>.env</code> from <code>.env.example</code>, filling every empty secret with random hex (<code>openssl rand -hex 32</code>). It never overwrites an existing file; move <code>.env</code> aside to regenerate the local secrets. The variables are:</p>
      <div className="table-wrap"><table>
        <caption className="sr-only">Environment variables</caption>
        <thead><tr><th scope="col">Variable</th><th scope="col">Meaning</th></tr></thead>
        <tbody>
          <tr><th scope="row"><code>TRACEFLOW_PROFILE</code></th><td>Deployment profile; <code>local-dev</code> in the template. Required.</td></tr>
          <tr><th scope="row"><code>POSTGRES_USER</code>, <code>POSTGRES_PASSWORD</code>, <code>POSTGRES_DB</code></th><td>PostgreSQL superuser, used only by the one-shot <code>migrate</code> job.</td></tr>
          <tr><th scope="row"><code>TRACEFLOW_APP_DB_PASSWORD</code>, <code>TRACEFLOW_RO_DB_PASSWORD</code>, <code>TRACEFLOW_AUTH_DB_PASSWORD</code></th><td>Passwords for the runtime database roles that <code>migrate</code> creates: <code>traceflow_app</code> (trace-api, no DDL), <code>traceflow_ro</code> (read-only, for the public demo) and <code>traceflow_auth</code> (web sign-in sessions, in a separate database).</td></tr>
          <tr><th scope="row"><code>TRACEFLOW_SERVICE_TOKEN</code></th><td>Shared secret between the web service and trace-api; at least 64 characters.</td></tr>
        </tbody>
      </table></div>
      <p><code>TRACEFLOW_DATABASE_URL</code> is no longer in <code>.env</code>: Compose builds trace-api&apos;s connection string from the <code>traceflow_app</code> password, and the web service never holds trace-database credentials. The web service also receives <code>TRACE_API_URL</code> (<code>http://trace-api:8080</code> in Compose). Never commit <code>.env</code>.</p>
      <p>The <code>operator-prod</code> sign-in reads these additional variables, which are not in the local template: <code>TRACEFLOW_PUBLIC_URL</code> (the https origin), <code>TRACEFLOW_AUTH_SECRET</code> (at least 32 characters), <code>TRACEFLOW_AUTH_DATABASE_URL</code>, <code>GITHUB_CLIENT_ID</code>, <code>GITHUB_CLIENT_SECRET</code> and <code>TRACEFLOW_OPERATOR_GITHUB_IDS</code> (comma-separated numeric GitHub user IDs). With any of them missing or invalid, <code>operator-prod</code> serves no sign-in and <code>/app</code> stays closed. They are listed so you know what the web app expects; they are not a deployment guide.</p>
      <H2 id="lifecycle">Start, stop, update</H2>
      <CodeBlock label="Make targets" code={"make up      # docker compose up -d --build --wait\nmake ps      # service status\nmake logs    # recent logs\nmake down    # stop the stack"} copyId="docs.dep.copy-make" />
      <p>To pick up code changes, run <code>make up</code> again; it rebuilds the images.</p>
      <H2 id="data">Data</H2>
      <p>PostgreSQL data lives in the <code>pgdata</code> Docker volume and survives <code>make down</code>. The local profile has no backups. Retention is described in <Link href="/docs/architecture#retention">Architecture</Link>.</p>
      <H2 id="notbuilt">Not built yet</H2>
      <Callout kind="warn" title="Hosted deployments do not exist yet">
        The <code>operator-prod</code> and <code>public-demo</code> deployments are not built. There is no TLS reverse proxy (Caddy) configuration, no production Compose file, no backup or restore procedure and no update workflow for a hosted server. Sign-in code exists, but it has not been run against real GitHub and nothing here has been deployed. This page therefore gives no instructions for hosted deployments, and you should not improvise one: the local profile has no sign-in yet, so do not try to expose the local profile, which has no sign-in, to a network.
      </Callout>
      <p>The design intent for those profiles is drafted in the repository (<code>docs/architecture/deployment-topology.md</code>) and is not a procedure you can follow today.</p>
    </DocArticle>
  );
}
