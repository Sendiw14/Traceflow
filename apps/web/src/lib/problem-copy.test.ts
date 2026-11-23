import { describe, expect, it } from "vitest";
import { problemCopy } from "./problem-copy";

describe("problemCopy", () => {
  it("maps codes to documented copy", () => {
    expect(problemCopy("window_too_large").kind).toBe("link");
    expect(problemCopy("query_timeout").body).toMatch(/Narrow the time range/);
    expect(problemCopy("storage_unavailable").heading).toMatch(/can't reach its database/);
    expect(problemCopy("unauthorized").kind).toBe("session");
    expect(problemCopy("???").kind).toBe("unavailable");
  });
});
