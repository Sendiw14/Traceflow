import { describe, expect, it } from "vitest";
import { scalarText } from "./any-value";

describe("scalarText", () => {
  it("renders typed scalars, keeping ints exact", () => {
    expect(scalarText({ type: "int", value: "9223372036854775807" })).toBe("9223372036854775807");
    expect(scalarText({ type: "bool", value: false })).toBe("false");
    expect(scalarText({ type: "double", value: 1.5 })).toBe("1.5");
    expect(scalarText({ type: "empty" })).toBe("(empty)");
    expect(scalarText({ type: "bytes", value: "AAEC" })).toMatch(/base64, 4 chars/);
  });
  it("leaves containers to structural rendering", () => {
    expect(scalarText({ type: "array", value: [] })).toBeNull();
    expect(scalarText({ type: "kvlist", value: [] })).toBeNull();
  });
});
