import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  directiveSchema,
  isDirectiveExpression,
  normalizeDirective,
  type DirectiveValue,
} from "../../../src/routes/test/film-director/_lib/directives";

const propValue = z.enum(["staff", "fan", "club"]);
const schema = directiveSchema(propValue);

// Compile-time guard: the schema's inferred type must stay assignable to
// DirectiveValue<T>. If this fails to compile, the schema and the directive
// grammar have drifted apart — fix the drift rather than loosening types.
type _SchemaMatchesDirectiveValue =
  z.infer<typeof schema> extends DirectiveValue<"staff" | "fan" | "club"> ? true : never;
const _schemaMatchesDirectiveValue: _SchemaMatchesDirectiveValue = true;
void _schemaMatchesDirectiveValue;

describe("directiveSchema", () => {
  it("accepts a literal", () => {
    expect(schema.parse("staff")).toBe("staff");
  });

  it("accepts every directive form", () => {
    expect(schema.parse({ pick: "any" })).toEqual({ pick: "any" });
    expect(schema.parse({ pick: "distinct", from: ["staff", "fan"] })).toEqual({
      pick: "distinct",
      from: ["staff", "fan"],
    });
    expect(schema.parse({ oneOf: ["fan", "club"] })).toEqual({
      oneOf: ["fan", "club"],
    });
    expect(schema.parse({ not: "staff" })).toEqual({ not: "staff" });
    expect(schema.parse({ sameAs: "performer-2" })).toEqual({
      sameAs: "performer-2",
    });
  });

  it("rejects unknown literal values and unknown keys", () => {
    expect(() => schema.parse("chainsaw")).toThrow();
    expect(() => schema.parse({ pick: "any", extra: true })).toThrow();
    expect(() => schema.parse({ oneOf: [] })).toThrow();
  });

  it("rejects a malformed directive object with a readable union error", () => {
    const result = schema.safeParse({ pik: "any" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const flattened = result.error.flatten();
    expect(JSON.stringify(flattened)).toContain(
      "Expected a literal value or a directive object ({pick}, {pick, not}, {oneOf}, {not}, {sameAs})"
    );
  });

  it("rejects an empty object", () => {
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty not array", () => {
    expect(schema.safeParse({ not: [] }).success).toBe(false);
  });

  it("rejects an empty sameAs id", () => {
    expect(schema.safeParse({ sameAs: "" }).success).toBe(false);
  });

  it("rejects an empty pick pool", () => {
    expect(schema.safeParse({ pick: "distinct", from: [] }).success).toBe(false);
  });

  it("rejects a multi-key directive object", () => {
    expect(schema.safeParse({ oneOf: ["fan"], not: "staff" }).success).toBe(false);
  });
});

describe("pick with not", () => {
  it("accepts {pick, not} and normalizes not into exclude", () => {
    expect(
      normalizeDirective<string>({ pick: "distinct", not: "wall" })
    ).toEqual({ kind: "pick", distinct: true, pool: null, exclude: ["wall"] });
  });

  it("accepts an array not and keeps the pool", () => {
    expect(
      normalizeDirective<string>({
        pick: "any",
        from: ["wall", "wheel", "floor"],
        not: ["wall", "floor"],
      })
    ).toEqual({
      kind: "pick",
      distinct: false,
      pool: ["wall", "wheel", "floor"],
      exclude: ["wall", "floor"],
    });
  });

  it("schema accepts {pick: 'distinct', not} on a plane axis", () => {
    const planeAxis = directiveSchema(z.string());
    expect(
      planeAxis.safeParse({ pick: "distinct", not: "wall" }).success
    ).toBe(true);
    expect(
      planeAxis.safeParse({ pick: "distinct", not: ["wall", "floor"] }).success
    ).toBe(true);
  });

  it("schema still rejects an empty not array on the pick branch", () => {
    const planeAxis = directiveSchema(z.string());
    expect(planeAxis.safeParse({ pick: "any", not: [] }).success).toBe(false);
  });
});

describe("isDirectiveExpression", () => {
  it("rejects null and undefined", () => {
    expect(isDirectiveExpression(null as unknown as DirectiveValue<"staff">)).toBe(false);
    expect(isDirectiveExpression(undefined as unknown as DirectiveValue<"staff">)).toBe(
      false
    );
  });

  it("rejects arrays", () => {
    expect(isDirectiveExpression(["staff"] as unknown as DirectiveValue<"staff">)).toBe(
      false
    );
  });

  it("rejects a plain object with no grammar keys", () => {
    expect(
      isDirectiveExpression({ from: ["fan"] } as unknown as DirectiveValue<"staff" | "fan">)
    ).toBe(false);
  });

  it("accepts an object carrying a grammar key", () => {
    expect(isDirectiveExpression({ pick: "any" })).toBe(true);
    expect(isDirectiveExpression({ oneOf: ["fan"] })).toBe(true);
    expect(isDirectiveExpression({ not: "staff" })).toBe(true);
    expect(isDirectiveExpression({ sameAs: "performer-1" })).toBe(true);
  });
});

describe("normalizeDirective", () => {
  it("normalizes a literal", () => {
    expect(normalizeDirective("staff")).toEqual({ kind: "literal", literal: "staff" });
  });

  it("normalizes oneOf to a constrained pick", () => {
    expect(normalizeDirective({ oneOf: ["fan", "club"] })).toEqual({
      kind: "pick",
      distinct: false,
      pool: ["fan", "club"],
      exclude: [],
    });
  });

  it("normalizes not with and without a pool", () => {
    expect(normalizeDirective({ not: "staff" })).toEqual({
      kind: "pick",
      distinct: false,
      pool: null,
      exclude: ["staff"],
    });
    expect(normalizeDirective({ not: ["staff"], from: ["staff", "fan"] })).toEqual({
      kind: "pick",
      distinct: false,
      pool: ["staff", "fan"],
      exclude: ["staff"],
    });
  });

  it("normalizes not with a multi-element exclusion array", () => {
    expect(normalizeDirective({ not: ["staff", "fan"] })).toEqual({
      kind: "pick",
      distinct: false,
      pool: null,
      exclude: ["staff", "fan"],
    });
  });

  it("normalizes pick any/distinct and sameAs", () => {
    expect(normalizeDirective({ pick: "distinct" })).toEqual({
      kind: "pick",
      distinct: true,
      pool: null,
      exclude: [],
    });
    expect(normalizeDirective({ sameAs: "performer-1" })).toEqual({
      kind: "sameAs",
      sameAs: "performer-1",
    });
  });

  it("normalizes pick any with a pool, preserving it without distinct", () => {
    expect(normalizeDirective({ pick: "any", from: ["staff", "fan"] })).toEqual({
      kind: "pick",
      distinct: false,
      pool: ["staff", "fan"],
      exclude: [],
    });
  });

  it("normalizes bare pick any with no pool", () => {
    expect(normalizeDirective({ pick: "any" })).toEqual({
      kind: "pick",
      distinct: false,
      pool: null,
      exclude: [],
    });
  });
});
