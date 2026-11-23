import { describe, expect, it } from "vitest";
import { edgeWidth, layoutGraph, nearest, NODE_W, volumeBucket } from "./graph-layout";

describe("layoutGraph", () => {
  it("layers a chain left to right deterministically", () => {
    const l = layoutGraph(["c", "a", "b"], [{ source: "a", target: "b" }, { source: "b", target: "c" }]);
    expect(l.byId.get("a")!.layer).toBe(0);
    expect(l.byId.get("b")!.layer).toBe(1);
    expect(l.byId.get("c")!.layer).toBe(2);
    expect(l.byId.get("b")!.x).toBeGreaterThan(l.byId.get("a")!.x + NODE_W - 1);
    expect(layoutGraph(["c", "a", "b"], [{ source: "a", target: "b" }, { source: "b", target: "c" }])).toEqual(l);
  });
  it("terminates on cycles and keeps every node", () => {
    const l = layoutGraph(["a", "b"], [{ source: "a", target: "b" }, { source: "b", target: "a" }]);
    expect(l.nodes).toHaveLength(2);
  });
  it("places isolated nodes in layer 0", () => {
    expect(layoutGraph(["x"], []).nodes[0]).toMatchObject({ layer: 0, index: 0 });
  });
});

describe("nearest", () => {
  const l = layoutGraph(["a", "b", "c"], [{ source: "a", target: "b" }, { source: "a", target: "c" }]);
  it("moves to the neighbour in the requested direction", () => {
    expect(nearest(l.nodes, l.byId.get("a")!, "right")?.id).toBe("b");
    expect(nearest(l.nodes, l.byId.get("b")!, "down")?.id).toBe("c");
    expect(nearest(l.nodes, l.byId.get("b")!, "left")?.id).toBe("a");
    expect(nearest(l.nodes, l.byId.get("a")!, "left")).toBeNull();
  });
});

describe("encodings", () => {
  it("edge width grows with trace count but is bounded", () => {
    expect(edgeWidth(1)).toBeLessThan(edgeWidth(100));
    expect(edgeWidth(1e12)).toBeLessThanOrEqual(8);
  });
  it("volume buckets", () => {
    expect([0, 10, 100, 1000].map(volumeBucket)).toEqual([1, 2, 3, 4]);
  });
});
