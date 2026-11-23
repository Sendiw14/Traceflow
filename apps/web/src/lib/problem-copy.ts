// Problem code → user-facing copy (page-matrix §0). Detail from the API is plain text, rendered as text only.
export interface ProblemCopy { heading: string; body: string; kind: "link" | "retry" | "session" | "readonly" | "notfound" | "unavailable" }

export function problemCopy(code: string): ProblemCopy {
  switch (code) {
    case "invalid_parameter":
    case "window_too_large":
    case "cursor_invalid":
    case "cursor_filter_mismatch":
      return { heading: "This view's link has invalid settings", body: "Reset the filters to continue.", kind: "link" };
    case "unauthorized":
      return { heading: "Session expired", body: "Sign in again to continue.", kind: "session" };
    case "forbidden":
      return { heading: "Not available in this deployment", body: "This deployment is read-only for this action.", kind: "readonly" };
    case "not_found":
      return { heading: "Not found", body: "The requested item does not exist in retained data.", kind: "notfound" };
    case "query_timeout":
      return { heading: "Query took too long", body: "Narrow the time range and retry.", kind: "retry" };
    default:
      return { heading: "TRACEFLOW can't reach its database", body: "The trace API is unavailable. Retry in a moment.", kind: "unavailable" };
  }
}
