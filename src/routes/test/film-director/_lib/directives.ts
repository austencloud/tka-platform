import { z } from "zod";

/**
 * A directive-capable value: either the concrete value itself, or an
 * expression the resolver compiles into one. This is the written form of
 * constraint intent — "different prop each", "anything but LED" — so the
 * document, not the translating agent, carries the meaning.
 */
export type DirectiveExpression<T extends string | number> =
  | { pick: "any" | "distinct"; from?: readonly T[]; not?: T | readonly T[] }
  | { oneOf: readonly T[] }
  | { not: T | readonly T[]; from?: readonly T[] }
  | { sameAs: string };

export type DirectiveValue<T extends string | number> = T | DirectiveExpression<T>;

/**
 * The resolved shape of a directive, keyed by `kind` so illegal
 * combinations (e.g. a `pool` on a `sameAs`) are unrepresentable.
 *
 * `pool: null` on the `pick` variant means "the axis's full catalog".
 */
export type NormalizedDirective<T extends string | number> =
  | { kind: "literal"; literal: T }
  | { kind: "pick"; distinct: boolean; pool: readonly T[] | null; exclude: readonly T[] }
  /**
   * `sameAs` copies the value from another performer's resolved value on
   * the same axis. The string is that other performer's id, not a value
   * on this axis.
   */
  | { kind: "sameAs"; sameAs: string };

export function directiveSchema<S extends z.ZodType>(value: S) {
  return z.union(
    [
      value,
      z
        .object({
          pick: z.enum(["any", "distinct"]),
          from: z.array(value).min(1).optional(),
          not: z.union([value, z.array(value).min(1)]).optional(),
        })
        .strict(),
      z.object({ oneOf: z.array(value).min(1) }).strict(),
      z
        .object({
          not: z.union([value, z.array(value).min(1)]),
          from: z.array(value).min(1).optional(),
        })
        .strict(),
      z.object({ sameAs: z.string().min(1) }).strict(),
    ],
    {
      error:
        "Expected a literal value or a directive object ({pick}, {pick, not}, {oneOf}, {not}, {sameAs})",
    }
  );
}

export function isDirectiveExpression<T extends string | number>(
  value: DirectiveValue<T>
): value is DirectiveExpression<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("pick" in value || "oneOf" in value || "not" in value || "sameAs" in value)
  );
}

/**
 * Normalizes a directive value into its resolved shape.
 *
 * Input is expected to already be schema-validated (`directiveSchema`),
 * which rejects any object carrying more than one grammar key. Given
 * unvalidated multi-key input, this function normalizes by precedence:
 * sameAs > oneOf > pick > not.
 *
 * `pick` precedes `not` because an object carrying both keys is now a legal
 * pick-with-exclusions, not a bare `not` that happens to mention a pick. The
 * reorder is safe for every document that already existed: before the combined
 * spelling, `directiveSchema` rejected any object carrying both keys, so no
 * validated document ever reached this function with both — none changes
 * meaning.
 */
export function normalizeDirective<T extends string | number>(
  value: DirectiveValue<T>
): NormalizedDirective<T> {
  if (!isDirectiveExpression(value)) {
    return { kind: "literal", literal: value };
  }
  if ("sameAs" in value) return { kind: "sameAs", sameAs: value.sameAs };
  if ("oneOf" in value) {
    return { kind: "pick", distinct: false, pool: [...value.oneOf], exclude: [] };
  }
  if ("pick" in value) {
    const exclude =
      value.not === undefined
        ? []
        : Array.isArray(value.not)
          ? [...value.not]
          : [value.not];
    return {
      kind: "pick",
      distinct: value.pick === "distinct",
      pool: value.from ? [...value.from] : null,
      exclude,
    };
  }
  // bare { not, from? }. `"not" in value` can be true with `value.not`
  // itself `undefined` (e.g. a spread-constructed object) — that carries no
  // exclusion at all, so it falls back to the same benign default a
  // no-grammar-keys object gets rather than computing `exclude: [undefined]`.
  if (value.not === undefined) {
    return { kind: "pick", distinct: false, pool: null, exclude: [] };
  }
  const exclude = Array.isArray(value.not) ? [...value.not] : [value.not];
  return {
    kind: "pick",
    distinct: false,
    pool: value.from ? [...value.from] : null,
    exclude,
  };
}
