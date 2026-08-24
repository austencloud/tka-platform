// src/routes/test/film-director/_lib/directives.ts
import { z } from "zod";

/**
 * A directive-capable value: either the concrete value itself, or an
 * expression the resolver compiles into one. This is the written form of
 * constraint intent — "different prop each", "anything but LED" — so the
 * document, not the translating agent, carries the meaning.
 */
export type DirectiveExpression<T> =
  | { pick: "any" | "distinct"; from?: readonly T[] }
  | { oneOf: readonly T[] }
  | { not: T | readonly T[]; from?: readonly T[] }
  | { sameAs: string };

export type DirectiveValue<T> = T | DirectiveExpression<T>;

export interface NormalizedDirective<T> {
  kind: "literal" | "pick" | "sameAs";
  literal?: T;
  distinct?: boolean;
  /** Allowed candidates; null means "the axis's full catalog". */
  pool?: readonly T[] | null;
  exclude?: readonly T[];
  sameAs?: string;
}

export function directiveSchema<S extends z.ZodTypeAny>(value: S) {
  return z.union([
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
  ]);
}

export function isDirectiveExpression<T>(
  value: DirectiveValue<T>
): value is DirectiveExpression<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("pick" in value || "oneOf" in value || "not" in value || "sameAs" in value)
  );
}

export function normalizeDirective<T>(
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
