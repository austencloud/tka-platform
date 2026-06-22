import { describe, it, expect } from "vitest";
import { shapeKey } from "$lib/shared/mandala/services/mandala-fingerprint";
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";

function paths(blue: string[], red: string[], purple: string[] = []): MandalaPaths {
  return {
    blue: blue.map((d, i) => ({ d, tipIndex: i })),
    red: red.map((d, i) => ({ d, tipIndex: i })),
    purple: purple.map((d, i) => ({ d, tipIndex: i })),
  };
}

const ARC = "M 10.00 0.00 C 5.00 5.00, 0.00 10.00, -10.00 0.00";
const LINE = "M -50.00 -50.00 C -25.00 -25.00, 0.00 0.00, 50.00 50.00";

describe("shapeKey", () => {
  it("is deterministic", () => {
    const p = paths([ARC], [LINE]);
    expect(shapeKey(p)).toBe(shapeKey(p));
  });

  it("is color-blind: swapping which color draws which line yields the same key", () => {
    const a = paths([ARC], [LINE]);
    const b = paths([LINE], [ARC]);
    expect(shapeKey(a)).toBe(shapeKey(b));
  });

  it("collapses a line drawn by both colors to one line (overlap is one path)", () => {
    const both = paths([ARC], [ARC]);
    const single = paths([ARC], []);
    expect(shapeKey(both)).toBe(shapeKey(single));
  });

  it("distinguishes different shapes", () => {
    expect(shapeKey(paths([ARC], []))).not.toBe(shapeKey(paths([LINE], [])));
  });
});
