"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { updateRetention } from "@/app/app/settings/actions";

export function RetentionForm({ current, nextRun }: { current: number; nextRun: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(String(current));
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const parsed = /^[0-9]{1,3}$/.test(value.trim()) ? Number(value.trim()) : NaN;
  const invalid = !Number.isInteger(parsed) || parsed < 1 || parsed > 90;
  const changed = !invalid && parsed !== current;

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await updateRetention(parsed);
      if (r.ok) { setSaved(r.settings.retention_days); router.refresh(); }
      else setError(r.fieldError ?? r.message);
      dialog.current?.close();
    });
  };
  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) { setError("Enter a whole number from 1 to 90."); return; }
    if (parsed < current) dialog.current?.showModal(); // lowering deletes data: confirm first
    else submit();
  };

  return (
    <form onSubmit={onSave} noValidate data-testid="settings.retention">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="retention-days" className="text-sm">Retention (days)</label>
          <input id="retention-days" inputMode="numeric" className="field w-28" value={value} onChange={(e) => { setValue(e.target.value); setError(null); setSaved(null); }}
            aria-describedby="retention-help retention-error" aria-invalid={error !== null || (value !== "" && invalid)} data-testid="settings.retention.input" />
        </div>
        <button ref={trigger} type="submit" className="btn btn-primary" disabled={pending || !changed} data-testid="settings.retention.save">{pending ? "Saving…" : "Save retention"}</button>
      </div>
      <p id="retention-help" className="mt-1 text-xs text-ink-3">Whole days, 1–90. Currently {current} days. Spans older than the limit are deleted by the hourly retention job.</p>
      <p id="retention-error" role="alert" className="mt-1 text-sm text-error" data-testid="settings.retention.error">{error ?? ""}</p>
      <p role="status" className="mt-1 text-sm" data-testid="settings.retention.saved">{saved !== null ? `Retention set to ${saved} days. Recorded in the audit log.` : ""}</p>

      <dialog ref={dialog} aria-labelledby="confirm-h" className="rounded-lg border border-line p-6 shadow-lg backdrop:bg-black/40" data-testid="settings.confirm" onClose={() => trigger.current?.focus()}>
        <h2 id="confirm-h" className="m-0 text-lg font-semibold">Reduce retention to {Number.isNaN(parsed) ? "?" : parsed} days?</h2>
        <p className="mt-2 max-w-md text-sm">Spans older than {Number.isNaN(parsed) ? "?" : parsed} days will be deleted at the next retention run{nextRun ? ` (${nextRun})` : ""}. This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" autoFocus onClick={() => dialog.current?.close()} data-testid="settings.confirm.cancel">Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={pending} data-testid="settings.confirm.ok">Reduce retention to {Number.isNaN(parsed) ? "?" : parsed} days</button>
        </div>
      </dialog>
    </form>
  );
}
