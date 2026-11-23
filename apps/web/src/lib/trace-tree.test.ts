import { describe, expect, it } from "vitest";
import { barGeometry, buildTree, computeAxis, errorSpanIds, flatten, ORPHAN_GROUP, parentIds, type SpanT } from "./trace-tree";

function span(id: string, parent: string | null, start: number, durMs: number, extra: Partial<SpanT> = {}): SpanT {
  const s = BigInt(start) * 1_000_000n, d = BigInt(durMs) * 1_000_000n;
  return {
    span_id: id, parent_span_id: parent, parent_present: parent !== null, name: `op-${id}`, kind: "internal",
    start_unix_nano: s.toString(), end_unix_nano: (s + d).toString(), duration_nano: d.toString(),
    status: { code: "unset" }, service_name: "svc", resource_ref: 0, scope_ref: 0,
    attribute_count: 0, event_count: 0, link_count: 0, quality: { negative_duration: false, zero_duration: false, truncated: false },
    ...extra,
  };
}

describe("buildTree", () => {
  it("nests children under present parents ordered by start", () => {
    const t = buildTree([span("c2", "r", 30, 5), span("r", null, 0, 100), span("c1", "r", 10, 5)]);
    expect(t).toHaveLength(1);
    expect(t[0]!.children.map((c) => c.id)).toEqual(["c1", "c2"]);
  });
  it("puts parent_present=false spans under one synthetic group, never under invented parents", () => {
    const t = buildTree([span("r", null, 0, 100), span("o1", "missing", 5, 5, { parent_present: false }), span("o2", "missing2", 6, 5, { parent_present: false })]);
    expect(t.map((n) => n.id)).toEqual(["r", ORPHAN_GROUP]);
    expect(t[1]!.span).toBeNull();
    expect(t[1]!.children.map((c) => c.id)).toEqual(["o1", "o2"]);
  });
  it("keeps multiple roots at root level", () => {
    expect(buildTree([span("a", null, 0, 1), span("b", null, 5, 1)]).map((n) => n.id)).toEqual(["a", "b"]);
  });
  it("treats a present-but-not-returned parent (truncation) as root level and survives cycles", () => {
    const t = buildTree([span("x", "gone", 0, 1, { parent_present: true }), span("p", "q", 0, 1), span("q", "p", 0, 1)]);
    expect(t.map((n) => n.id).sort()).toEqual(["p", "q", "x"]);
  });
});

describe("flatten / parentIds", () => {
  const roots = buildTree([span("r", null, 0, 100), span("a", "r", 1, 10), span("b", "a", 2, 5)]);
  it("shows only expanded descendants", () => {
    expect(flatten(roots, new Set()).map((r) => r.node.id)).toEqual(["r"]);
    expect(flatten(roots, new Set(["r"])).map((r) => r.node.id)).toEqual(["r", "a"]);
    const all = flatten(roots, parentIds(roots));
    expect(all.map((r) => [r.node.id, r.depth])).toEqual([["r", 1], ["a", 2], ["b", 3]]);
  });
});

describe("computeAxis / barGeometry", () => {
  it("ignores negative-duration spans when scaling", () => {
    const ok = span("r", null, 1000, 100);
    const skew = span("s", "r", 0, 0, { duration_nano: "-5000000", end_unix_nano: "0", start_unix_nano: "0" });
    const axis = computeAxis([ok, skew]);
    expect(axis.start).toBe(1_000n * 1_000_000n);
    expect(axis.end).toBe(1_100n * 1_000_000n);
  });
  it("gives a minimum width to zero-duration spans and a marker to skewed ones", () => {
    const axis = computeAxis([span("r", null, 0, 100)]);
    expect(barGeometry(span("z", "r", 50, 0), axis).widthPct).toBeGreaterThan(0);
    const g = barGeometry(span("s", "r", 20, 0, { duration_nano: "-1" }), axis);
    expect(g.skew).toBe(true);
    expect(g.leftPct).toBeCloseTo(20);
  });
  it("positions bars proportionally", () => {
    const axis = computeAxis([span("r", null, 0, 200)]);
    const g = barGeometry(span("c", "r", 50, 100), axis);
    expect(g.leftPct).toBeCloseTo(25);
    expect(g.widthPct).toBeCloseTo(50);
  });
});

describe("errorSpanIds", () => {
  it("lists error spans in order", () => {
    expect(errorSpanIds([span("a", null, 0, 1), span("b", "a", 1, 1, { status: { code: "error" } })])).toEqual(["b"]);
  });
});
