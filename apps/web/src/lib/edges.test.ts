import { describe, expect, it } from "vitest";
import { edgeEvidenceText, edgesOf } from "./edges";

const e = (source: string, target: string, basis: "client_server_parent_child" | "other_parent_child") => ({
  source, target, evidence: { basis, parent_child_pairs: 1, trace_count: 1, sample_trace_ids: [], first_seen_unix_nano: "1", last_seen_unix_nano: "2" },
});

describe("edges", () => {
  it("describes evidence by basis without overclaiming", () => {
    expect(edgeEvidenceText(e("a", "b", "client_server_parent_child"))).toBe("Verified: client span in a → server span in b");
    expect(edgeEvidenceText(e("a", "b", "other_parent_child"))).toMatch(/no client\/server pair/);
  });
  it("splits upstream and downstream", () => {
    const list = [e("a", "b", "other_parent_child"), e("b", "c", "other_parent_child")];
    const r = edgesOf("b", list);
    expect(r.upstream.map((x) => x.source)).toEqual(["a"]);
    expect(r.downstream.map((x) => x.target)).toEqual(["c"]);
  });
});
