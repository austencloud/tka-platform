import { describe, it, expect } from "vitest";
import { LOOKS, getLook, lookCopies, propCount } from "./tunnel-looks";

const radial = getLook("radial")!;
const mandala = getLook("mandala")!;

describe("tunnel looks catalog", () => {
  it("is the curated 7-look set in order", () => {
    expect(LOOKS.map((l) => l.id)).toEqual([
      "radial",
      "mirror",
      "flip",
      "counter",
      "echo",
      "cross",
      "mandala",
    ]);
  });

  it("dropped Prism and the split radial looks", () => {
    for (const id of ["prism", "duo", "pinwheel", "kaleido"]) {
      expect(getLook(id)).toBeUndefined();
    }
  });
});

describe("Radial density (rotational, mirror off)", () => {
  it("prop count scales with arm count — base + rotations, 2 props each", () => {
    expect(propCount(radial, 2, false)).toBe(4); // base + 180°
    expect(propCount(radial, 4, false)).toBe(8); // base + 90/180/270
    expect(propCount(radial, 8, false)).toBe(16); // base + seven 45° copies
  });
});

describe("Radial mirror (dihedral)", () => {
  it("mirror doubles the copies", () => {
    expect(propCount(radial, 2, true)).toBe(8); // D₂
    expect(propCount(radial, 4, true)).toBe(16); // D₄
  });

  it("Radial + mirror + 4 arms renders the same stack as the Mandala tile", () => {
    expect(propCount(radial, 4, true)).toBe(propCount(mandala));
    expect(lookCopies(radial, 4, true).length).toBe(lookCopies(mandala).length);
  });
});

describe("fixed looks", () => {
  it("reflections + motion permutations are a single copy = 4 props", () => {
    for (const id of ["mirror", "flip", "counter", "echo"]) {
      expect(propCount(getLook(id)!)).toBe(4);
    }
  });

  it("cross = 8 props, mandala = 16 props", () => {
    expect(propCount(getLook("cross")!)).toBe(8);
    expect(propCount(mandala)).toBe(16);
  });

  it("density/mirror args are ignored by fixed looks", () => {
    expect(propCount(getLook("mirror")!, 8, true)).toBe(4);
  });
});
