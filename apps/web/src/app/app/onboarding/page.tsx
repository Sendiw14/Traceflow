import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CopyButton } from "@/components/CopyButton";
import { SamplingCaveat } from "@/components/Scope";
import { Notice, PageHeader, Panel, ProblemState } from "@/components/ui";
import { formatCount, formatDateTime } from "@/lib/format";
import { connectionState, failedRequests, rejectAdvice } from "@/lib/onboarding";
import { recentWindow } from "@/lib/time/window";
import { getIngestionStatus } from "@/lib/server/data";

export const metadata = { title: "Onboarding" };

// Mirrors infra/otel/collector.yaml (pinned contrib 0.165.0); replace the host with where TRACEFLOW runs.
const COLLECTOR_YAML = `receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

processors:
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 20
  attributes/redact:
    actions:
      - { pattern: "(?i).*(authorization|cookie|password|passwd|secret|token|api[_-]?key|session).*", action: delete }
      - { key: http.request.body, action: delete }
      - { key: http.response.body, action: delete }

exporters:
  otlp_http/traceflow:
    traces_endpoint: http://trace-api:4318/v1/traces
    encoding: proto
    compression: gzip
    sending_queue:
      enabled: true
      queue_size: 50000

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, attributes/redact]
      exporters: [otlp_http/traceflow]
`;

export default async function OnboardingPage() {
  const { from, to } = recentWindow(900);
  const r = await getIngestionStatus(from, to);
  const conn = r.ok ? connectionState(r.data) : null;
  return (
    <div data-testid="onboarding">
      <PageHeader title="Onboarding" />
      <Panel title="Connection status" id="conn" testId="onboarding.status" className="mb-4">
        {!r.ok ? <ProblemState problem={r.error} compact /> : (
          <div aria-live="polite" data-state={conn!.kind === "connected" ? "partial" : "empty-nodata"}>
            {conn!.kind === "waiting" && <p className="m-0" data-testid="onboarding.status.waiting"><strong>No data yet — listening.</strong> TRACEFLOW has never received a span. Complete the steps below.</p>}
            {conn!.kind === "quiet" && <p className="m-0" data-testid="onboarding.status.quiet"><strong>Connected earlier, quiet now.</strong> First span was received {formatDateTime(conn!.firstAt)}; none were accepted in the last 15 minutes.</p>}
            {conn!.kind === "connected" && (
              <p className="m-0" data-testid="onboarding.status.connected"><strong>Connected.</strong> Received {formatCount(conn!.accepted)} spans in the last 15 minutes{conn!.at ? `, latest request ${formatDateTime(conn!.at)}` : ""}.
                {r.data.latest_trace_id && <> <Link href={`/app/traces/${r.data.latest_trace_id}`}>Open the latest trace</Link>.</>}</p>
            )}
            {failedRequests(r.data.requests).length > 0 && (
              <Notice kind="warn">Some ingest requests failed: {failedRequests(r.data.requests).map(([k, v]) => `HTTP ${k} × ${formatCount(v)}`).join(", ")}.</Notice>
            )}
            {Object.entries(r.data.reject_reasons).filter(([, v]) => v > 0).map(([k, v]) => (
              <Notice key={k} kind="warn" testId={`onboarding.reject.${k}`}>{formatCount(v)} spans rejected ({k}). {rejectAdvice(k)}</Notice>
            ))}
            <p className="mt-2 text-xs text-ink-3">If spans are dropped before reaching TRACEFLOW (Collector queue full, SDK sampling), they never appear here; these counts only cover what TRACEFLOW received.</p>
            <AutoRefresh seconds={3} active={conn!.kind === "waiting"} />
          </div>
        )}
      </Panel>

      <Panel title="Quickstart" id="quick" className="mb-4" testId="onboarding.quickstart">
        <ol className="m-0 space-y-2 pl-5 text-sm">
          <li>Start TRACEFLOW: <code className="mono">make env &amp;&amp; make up</code> in the repository root.</li>
          <li>Point your application&apos;s OpenTelemetry SDK at an OpenTelemetry Collector (OTLP/HTTP, port 4318) using the configuration below.</li>
          <li>Send a request through your application. A trace should appear here within a few seconds.</li>
          <li>Open <Link href="/app/traces">Traces</Link> and select the newest trace.</li>
        </ol>
      </Panel>

      <Panel title="Collector configuration" id="cfg" className="mb-4" testId="onboarding.collector-config">
        <p className="mt-0 text-sm text-ink-2">Replace the <code className="mono">traces_endpoint</code> host with where trace-api runs. This sends binary Protobuf over OTLP/HTTP and removes common secret-bearing attributes before storage.</p>
        <pre tabIndex={0} className="max-h-96 overflow-auto rounded-md bg-sunken p-3 text-[13px]" aria-label="Collector configuration YAML"><code className="mono">{COLLECTOR_YAML}</code></pre>
        <p className="mt-2"><CopyButton value={COLLECTOR_YAML} label="configuration" testId="onboarding.config.copy" /></p>
      </Panel>

      <Panel title="Troubleshooting" id="trouble" testId="onboarding.troubleshooting">
        <ul className="m-0 space-y-1 pl-5 text-sm">
          <li><strong>Still “No data yet”:</strong> check the Collector logs for export errors and that the exporter points at port 4318 of trace-api.</li>
          <li><strong>HTTP 4xx in the request counts:</strong> the payload was refused (size limit or malformed Protobuf). Limits are listed in <Link href="/app/settings">Settings</Link>.</li>
          <li><strong>Traces look incomplete:</strong> missing parent spans usually mean an uninstrumented hop or head-based sampling; TRACEFLOW does not reconstruct dropped spans.</li>
        </ul>
      </Panel>
      <SamplingCaveat />
    </div>
  );
}
