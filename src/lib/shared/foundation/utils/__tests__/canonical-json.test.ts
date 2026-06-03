import { describe, it, expect } from "vitest";
import { canonicalJSON } from "../canonical-json";

describe("canonicalJSON", () => {
  it("sorts object keys so key order does not change the string", () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toEqual(canonicalJSON({ a: 2, b: 1 }));
  });

  it("sorts nested object keys", () => {
    const x = canonicalJSON({ outer: { z: 1, a: 2 } });
    const y = canonicalJSON({ outer: { a: 2, z: 1 } });
    expect(x).toEqual(y);
  });

  it("preserves array order (arrays are ordered)", () => {
    expect(canonicalJSON([1, 2, 3])).not.toEqual(canonicalJSON([3, 2, 1]));
  });

  it("is stable for primitives", () => {
    expect(canonicalJSON("x")).toEqual('"x"');
    expect(canonicalJSON(5)).toEqual("5");
    expect(canonicalJSON(null)).toEqual("null");
  });
});
