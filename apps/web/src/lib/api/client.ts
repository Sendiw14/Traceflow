import createClient from "openapi-fetch";
import type { paths } from "./generated/schema";

/** Server-side only: the browser never talks to trace-api (page-matrix §0). Token comes from server env. */
export function createTraceApiClient(baseUrl: string, serviceToken: string) {
  return createClient<paths>({ baseUrl, headers: { Authorization: `Bearer ${serviceToken}` }, cache: "no-store" });
}
