import { describe, expect, it } from "vitest";
import { connectionState, failedRequests, rejectAdvice } from "./onboarding";

const base = { window: { from: "0", to: "1" }, freshness: { generated_at: "1", last_span_received_at: null }, latest_trace_id: null, first_span_received_at: null, requests: {}, spans_received: 0, spans_accepted: 0, spans_duplicate: 0, spans_rejected: 0, spans_conflict: 0, reject_reasons: {} };

describe("onboarding", () => {
  it("distinguishes never from quiet from connected", () => {
    expect(connectionState(base).kind).toBe("waiting");
    expect(connectionState({ ...base, first_span_received_at: "5" }).kind).toBe("quiet");
    expect(connectionState({ ...base, first_span_received_at: "5", spans_accepted: 3, last_request_at: "9" })).toEqual({ kind: "connected", accepted: 3, at: "9" });
  });
  it("gives advice for known reasons and a generic line for unknown ones", () => {
    expect(rejectAdvice("invalid_id")).toMatch(/trace or span ID/);
    expect(rejectAdvice("brand_new_reason")).toMatch(/does not recognise/);
  });
  it("lists only non-2xx request counts", () => {
    expect(failedRequests({ "200": 10, "413": 2, "503": 1, "400": 0 })).toEqual([["413", 2], ["503", 1]]);
  });
});
