import { describe, it, expect } from "vitest";
import { shapeKey } from "$lib/shared/mandala/services/mandala-fingerprint";
import { colorSignature, orbitKey } from "$lib/shared/mandala/services/mandala-fingerprint";
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

describe("colorSignature", () => {
  it("flags blue-only", () => {
    const s = colorSignature(paths([ARC], []));
    expect(s).toMatchObject({ blueOnly: true, redOnly: false });
    expect(s.comboPurpleRatio).toBe(0);
  });
  it("flags red-only", () => {
    expect(colorSignature(paths([], [ARC]))).toMatchObject({ blueOnly: false, redOnly: true });
  });
  it("reports full overlap as comboPurpleRatio 1", () => {
    expect(colorSignature(paths([ARC], [ARC])).comboPurpleRatio).toBe(1);
  });
  it("reports zero overlap as comboPurpleRatio 0 but combo true", () => {
    const s = colorSignature(paths([ARC], [LINE]));
    expect(s.blueOnly).toBe(false);
    expect(s.redOnly).toBe(false);
    expect(s.comboPurpleRatio).toBe(0);
  });
});

describe("orbitKey", () => {
  it("is rotation-invariant: a glyph and its 45deg rotation share an orbit key", () => {
    // 45deg rotation of (10,0) about origin = (7.07, 7.07); of (-10,0) = (-7.07,-7.07)
    const rotArc = "M 7.07 7.07 C 0.00 7.07, -7.07 7.07, -7.07 -7.07";
    expect(orbitKey(paths([ARC], []))).toBe(orbitKey(paths([rotArc], [])));
  });
  it("is reflection-invariant: a glyph and its mirror share an orbit key", () => {
    const mirrorArc = "M -10.00 0.00 C -5.00 5.00, 0.00 10.00, 10.00 0.00";
    expect(orbitKey(paths([ARC], []))).toBe(orbitKey(paths([mirrorArc], [])));
  });
  it("returns a fixed-width hash string", () => {
    expect(orbitKey(paths([ARC], []))).toHaveLength(22);
  });
});
