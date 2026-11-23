"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

/** Server-rendered freshness text plus manual refresh and optional polling via router.refresh() (BFF re-render). */
export function Freshness({ updated, lastSpan, intervalSeconds = 5, polling = true }: { updated: string; lastSpan: string | null; intervalSeconds?: number; polling?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [auto, setAuto] = useState(false);
  const [hidden, setHidden] = useState(false);

  const refresh = useCallback(() => {
    if (!pending) start(() => router.refresh()); // never overlap refreshes
  }, [router, pending]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!auto || hidden) return;
    const id = setInterval(refresh, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [auto, hidden, intervalSeconds, refresh]);

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-ink-3" data-testid="freshness">
      <span>Updated {updated} UTC{lastSpan ? ` · last span received ${lastSpan} UTC` : " · no spans received yet"}</span>
      <button type="button" className="btn" onClick={refresh} disabled={pending}>{pending ? "Refreshing…" : "Refresh"}</button>
      {polling && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Auto-refresh every {intervalSeconds} s
          {auto && hidden && <span> (paused: tab hidden)</span>}
        </label>
      )}
    </div>
  );
}
