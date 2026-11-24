import Link from "next/link";
import { Callout, DocArticle, H2 } from "@/components/site/Doc";

export const metadata = { title: "Security" };

const TOC = [{ id: "status", title: "Status" }, { id: "boundary", title: "Boundaries" }, { id: "ingest", title: "Ingestion is off by default" }, { id: "auth", title: "Sign-in" }, { id: "data", title: "Data minimisation" }, { id: "web", title: "Web app" }, { id: "limits", title: "Limitations" }, { id: "contact", title: "Reporting a problem" }];

export default function Security() {
  return (
    <DocArticle path="/docs/security" title="Security" lead="What TRACEFLOW protects today, what it does not yet, and the defaults to rely on." toc={TOC}>
      <H2 id="status">Status</H2>
      <Callout kind="warn" title="V1 is in development">
        The threat model in the repository is a draft that still needs independent review and owner sign-off. No compliance certification is claimed.
      </Callout>
      <H2 id="boundary">Boundaries</H2>
      <ul>
        <li>The browser reaches only the web app. The query API (<code>:8080</code>) and the ingest listener (<code>:4318</code>) are on internal Docker networks and are not published to the host.</li>
        <li>The web app calls the query API server-side with a 256-bit random bearer token from its environment. The token is checked in constant time and never sent to the browser.</li>
        <li>The database is reachable only from trace-api.</li>
        <li>Deployment profiles are enforced on the server: <code>public-demo</code> has no <code>/app</code>, <code>operator-prod</code> has no <code>/demo</code>, and an unknown profile serves neither.</li>
      </ul>
      <H2 id="ingest">Ingestion is off by default</H2>
      <p><strong>Remote OTLP ingestion is off by default.</strong> The ingest listener is reachable only from the Collector and demo services on a private network and is not routed to the internet. Enabling remote ingestion would need a separate decision with authentication, TLS and rate limiting; none of that exists today, so do not expose port 4318. Request size limits, concurrency limits and gzip bomb protection apply to the listener regardless.</p>
      <H2 id="auth">Sign-in</H2>
      <p>Sign-in is implemented for the <code>operator-prod</code> profile: GitHub OAuth for a single operator, with access limited to an allowlist of numeric GitHub user IDs (usernames are never used for access decisions). Details, from ADR-0005:</p>
      <ul>
        <li>Sessions are stored server-side in a separate PostgreSQL database that the trace data roles cannot reach. Cookies are <code>__Host-</code> prefixed, <code>HttpOnly</code>, <code>Secure</code> and <code>SameSite=Lax</code>. A session idles out after 12 hours and never lasts more than 7 days.</li>
        <li>The allowlist and the 7-day limit are checked again on every request, so removing an ID takes effect immediately.</li>
        <li>Every <code>/app</code> page and every server action checks for a signed-in operator on the server; the route gate alone is not trusted. Without one, <code>/app</code> redirects to <code>/login</code> and renders no data.</li>
        <li>Origin and CSRF checks are on, account linking is off, and signing out clears the session and tells the browser to drop cached site data.</li>
        <li>With missing or invalid sign-in configuration, <code>operator-prod</code> serves no sign-in and <code>/app</code> stays closed.</li>
      </ul>
      <Callout kind="warn" title="Real GitHub sign-in has not been tested">
        The flow has been exercised against a mocked GitHub and in automated tests with an unreachable auth database. It has not been run against a real GitHub OAuth app yet, and no <code>operator-prod</code> deployment exists. The <code>local-dev</code> profile has no sign-in: it acts as a fixed local operator and only for loopback hosts, which is why the Compose file publishes the web app on <code>127.0.0.1</code> only. <Link href="/docs/deployment#notbuilt">Hosted deployment is not built.</Link>
      </Callout>
      <H2 id="data">Data minimisation</H2>
      <ul>
        <li>TRACEFLOW stores the trace data producers send. It does not collect request bodies, and the demo services do not record them.</li>
        <li>Two redaction layers run before storage: the Collector deletes attributes whose names look like secrets (authorization, cookie, password, token, api key, session and similar) and request/response bodies, and trace-api applies its own denylist and replaces matching values with <code>[REDACTED]</code>.</li>
        <li>Attribute values are length-limited and shown as text; the interface never renders them as HTML.</li>
        <li>Retention is configurable (1–90 days) and old data is deleted hourly.</li>
        <li>Do not send third-party personal data to a V1 deployment; the project has not done the legal review that would require.</li>
      </ul>
      <H2 id="web">Web app</H2>
      <ul>
        <li>All <code>/app</code> responses are <code>Cache-Control: private, no-store</code> and rendered per request.</li>
        <li>Trace and service names, attributes and error messages are rendered as plain text by React; there is no raw HTML injection path.</li>
        <li>Fonts, scripts and images come from the same origin; the site loads no third-party resources.</li>
      </ul>
      <H2 id="limits">Limitations</H2>
      <ul>
        <li>Real GitHub sign-in is untested (above). No multi-user access control: V1 targets one operator.</li>
        <li>Delivery from SDK to database is not zero-loss (see <Link href="/docs/instrumentation#caveats">Instrumentation</Link>).</li>
        <li>No dependency or image vulnerability scan has been run yet; a secret scan of the repository history has passed.</li>
        <li>No hosted deployment, TLS or backup procedure exists yet.</li>
      </ul>
      <H2 id="contact">Reporting a problem</H2>
      <p>A private security contact has not been published yet. Until one is, please do not post exploit details publicly; open an issue on the GitHub repository asking for a private channel, without describing the vulnerability.</p>
    </DocArticle>
  );
}
