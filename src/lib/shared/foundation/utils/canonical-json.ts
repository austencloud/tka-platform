/**
 * Deterministic JSON: object keys sorted recursively (RFC-8785-style) so two
 * logically-identical objects serialize to the same string and hash identically.
 * Arrays keep their order (arrays are ordered data). Used to hash deck recipes
 * into a stable seed.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`).join(",");
  return `{${body}}`;
}
