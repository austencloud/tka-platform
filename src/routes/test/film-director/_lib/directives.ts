// src/routes/test/film-director/_lib/directives.ts
import { z } from "zod";

/**
 * A directive-capable value: either the concrete value itself, or an
 * expression the resolver compiles into one. This is the written form of
 * constraint intent — "different prop each", "anything but LED" — so the
 * document, not the translating agent, carries the meaning.
 */
export type DirectiveExpression<T extends string | number> =
  | { pick: "any" | "distinct"; from?: readonly T[] }
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
        "Expected a literal value or a directive object ({pick}, {oneOf}, {not}, {sameAs})",
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
 * sameAs > oneOf > not > pick.
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
  if ("not" in value) {
    const exclude = Array.isArray(value.not) ? [...value.not] : [value.not];
    return {
      kind: "pick",
      distinct: false,
      pool: value.from ? [...value.from] : null,
      exclude,
    };
  }
  return {
    kind: "pick",
    distinct: value.pick === "distinct",
    pool: value.from ? [...value.from] : null,
    exclude: [],
  };
}
