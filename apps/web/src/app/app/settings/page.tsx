import Link from "next/link";
import { RetentionForm } from "@/components/RetentionForm";
import { SamplingCaveat } from "@/components/Scope";
import { Badge, Notice, PageHeader, Panel, ProblemState } from "@/components/ui";
import { formatBytes, formatCount, formatDateTime } from "@/lib/format";
import { recentWindow } from "@/lib/time/window";
import { getIngestionStatus, getSettings } from "@/lib/server/data";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const win = recentWindow(3600);
  const [r, ing] = await Promise.all([getSettings(), getIngestionStatus(win.from, win.to)]);
  if (!r.ok) {
    return <div data-testid="settings"><PageHeader title="Settings" />{r.error.code === "not_found" || r.error.code === "forbidden"
      ? <Notice kind="warn" testId="settings.unavailable">Settings are not available in this deployment.</Notice> : <ProblemState problem={r.error} />}</div>;
  }
  const s = r.data;
  const lr = s.last_retention_run;
  return (
    <div data-testid="settings">
      <PageHeader title="Settings" />
      <div className="grid gap-4">
        <Panel title="Retention" id="ret" testId="settings.retention-panel">
          {s.read_only ? (
            <Notice testId="settings.read-only">This deployment is read-only. Retention is {s.retention_days} days and cannot be changed here.</Notice>
          ) : <RetentionForm current={s.retention_days} nextRun={s.next_retention_run ? formatDateTime(s.next_retention_run) : null} />}
          <dl className="mt-4 grid grid-cols-[160px_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-3">Retention</dt><dd className="m-0" data-testid="settings.retention.current">{s.retention_days} days</dd>
            <dt className="text-ink-3">Next retention run</dt><dd className="m-0">{s.next_retention_run ? formatDateTime(s.next_retention_run) : "Not scheduled yet"}</dd>
            <dt className="text-ink-3">Last retention run</dt>
            <dd className="m-0" data-testid="settings.last-run">{lr ? <>{formatDateTime(lr.finished_at)} — {lr.status === "ok" ? <Badge tone="ok">ok</Badge> : <Badge tone="warn">{lr.status}</Badge>} · {formatCount(lr.traces_deleted)} traces, {formatCount(lr.spans_deleted)} spans deleted</> : "Has not run yet"}</dd>
          </dl>
          {lr && lr.status !== "ok" && <Notice kind="warn" testId="settings.last-run-warning">The last retention run finished with status “{lr.status}”. Old data may not have been fully removed.</Notice>}
        </Panel>

        <Panel title="Deployment" id="dep" testId="settings.auth-status">
          <dl className="grid grid-cols-[160px_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-3">Profile</dt><dd className="m-0" data-testid="settings.profile">{s.profile}</dd>
            <dt className="text-ink-3">Operator</dt><dd className="m-0">Sign-in is not implemented yet; this local build does not identify operators. Changes are audited with a placeholder actor.</dd>
            <dt className="text-ink-3">Times</dt><dd className="m-0">All times are shown in UTC.</dd>
          </dl>
        </Panel>

        <Panel title="Limits (read-only)" id="lim" testId="settings.limits">
          <dl className="grid grid-cols-[minmax(0,260px)_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-3">Request size, compressed</dt><dd className="m-0">{formatBytes(s.limits.max_request_bytes_compressed)}</dd>
            <dt className="text-ink-3">Request size, uncompressed</dt><dd className="m-0">{formatBytes(s.limits.max_request_bytes_raw)}</dd>
            <dt className="text-ink-3">Spans per request</dt><dd className="m-0">{formatCount(s.limits.max_spans_per_request)}</dd>
            <dt className="text-ink-3">Spans per trace</dt><dd className="m-0">{formatCount(s.limits.max_spans_per_trace)}</dd>
            <dt className="text-ink-3">Longest query window</dt><dd className="m-0">{s.limits.max_query_window_seconds / 86400} days</dd>
          </dl>
        </Panel>

        <Panel title="Ingestion (last hour)" id="ing" testId="settings.ingestion">
          {!ing.ok ? <ProblemState problem={ing.error} compact /> : (
            <p className="m-0 text-sm">{formatCount(ing.data.spans_accepted)} spans accepted, {formatCount(ing.data.spans_duplicate)} duplicate, {formatCount(ing.data.spans_rejected)} rejected. <Link href="/app/onboarding">Connection help</Link></p>
          )}
        </Panel>
      </div>
      <SamplingCaveat />
    </div>
  );
}
