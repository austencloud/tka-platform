import { z } from "zod";

/** A concrete cast value or a constraint the Director resolver compiles. */
export type DirectiveExpression<T extends string | number> =
  | { pick: "any" | "distinct"; from?: readonly T[]; not?: T | readonly T[] }
  | { oneOf: readonly T[] }
  | { not: T | readonly T[]; from?: readonly T[] }
  | { sameAs: string };

export type DirectiveValue<T extends string | number> =
  | T
  | DirectiveExpression<T>;

export type NormalizedDirective<T extends string | number> =
  | { kind: "literal"; literal: T }
  | {
      kind: "pick";
      distinct: boolean;
      pool: readonly T[] | null;
      exclude: readonly T[];
    }
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

export function normalizeDirective<T extends string | number>(
  value: DirectiveValue<T>
): NormalizedDirective<T> {
  if (!isDirectiveExpression(value)) return { kind: "literal", literal: value };
  if ("sameAs" in value) return { kind: "sameAs", sameAs: value.sameAs };
  if ("oneOf" in value) {
    return {
      kind: "pick",
      distinct: false,
      pool: [...value.oneOf],
      exclude: [],
    };
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
