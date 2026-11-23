import type { Schemas } from "@/lib/server/data";

export type AnyValue = Schemas["AnyValue"];

/** Scalar text for an OTLP AnyValue; arrays/kvlists return null (rendered structurally). int stays a decimal string. */
export function scalarText(v: AnyValue): string | null {
  switch (v.type) {
    case "string": return v.value;
    case "bool": return v.value ? "true" : "false";
    case "int": return v.value;
    case "double": return String(v.value);
    case "bytes": return `${v.value} (base64, ${v.value.length} chars)`;
    case "empty": return "(empty)";
    default: return null;
  }
}
