// tests/unit/film-director/directives.test.ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  directiveSchema,
  normalizeDirective,
} from "../../../src/routes/test/film-director/_lib/directives";

const propValue = z.enum(["staff", "fan", "club"]);
const schema = directiveSchema(propValue);

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
});
