import {
  buildBoundedSpinRatios,
  buildTheorySpinRatioAtlas,
  jointSpinRatioClosureHandCycles,
  makeSpinRatio,
  parseSpinRatio,
  spinRatioClosureHandCycles,
  spinRatioKey,
  spinRatioPetals,
  spinRatioToTkaTurns,
  spinRatioToTkaTurnFraction,
  THEORY_SPIN_RATIO_MAX_PART,
} from "../../packages/vtg-domain/src/reference/spin-ratio";
import { describe, expect, it } from "vitest";

describe("VTG spin ratios", () => {
  it("reduces and serializes exact ratios", () => {
    expect(makeSpinRatio(2, 6)).toEqual({
      propRotations: 1,
      handCycles: 3,
    });
    expect(spinRatioKey({ propRotations: 2, handCycles: 6 })).toBe("1:3");
    expect(parseSpinRatio(" 2:6 ")).toEqual({
      propRotations: 1,
      handCycles: 3,
    });
    expect(parseSpinRatio("0:0")).toBeNull();
    expect(parseSpinRatio("1/-3")).toBeNull();
    expect(() => makeSpinRatio(0, 0)).toThrow("0:0");
  });

  it("generates every ratio reachable from two values through 15", () => {
    const finite = buildBoundedSpinRatios(9);
    const atlas = buildTheorySpinRatioAtlas();
    const keys = new Set(atlas.map(spinRatioKey));

    expect(finite).toHaveLength(29);
    expect(atlas[0]).toEqual(makeSpinRatio(0, 1));
    expect(spinRatioKey(atlas.at(-1)!)).toBe("1:0");
    expect(keys.size).toBe(atlas.length);

    for (
      let propRotations = 0;
      propRotations <= THEORY_SPIN_RATIO_MAX_PART;
      propRotations += 1
    ) {
      for (
        let handCycles = 0;
        handCycles <= THEORY_SPIN_RATIO_MAX_PART;
        handCycles += 1
      ) {
        if (propRotations === 0 && handCycles === 0) continue;
        expect(
          keys.has(spinRatioKey(makeSpinRatio(propRotations, handCycles)))
        ).toBe(true);
      }
    }
  });

  it("converts ratios without inventing Float or Static turn numbers", () => {
    expect(spinRatioToTkaTurns(makeSpinRatio(0, 1))).toBe("fl");
    expect(spinRatioToTkaTurns(makeSpinRatio(1, 2))).toBe(-0.25);
    expect(spinRatioToTkaTurns(makeSpinRatio(1, 3))).toBeCloseTo(-1 / 3);
    expect(spinRatioToTkaTurns(makeSpinRatio(1, 1))).toBe(0);
    expect(spinRatioToTkaTurns(makeSpinRatio(1, 0))).toBeNull();
    expect(spinRatioToTkaTurnFraction(makeSpinRatio(0, 1))).toBe("fl");
    expect(spinRatioToTkaTurnFraction(makeSpinRatio(1, 2))).toEqual({
      numerator: -1,
      denominator: 4,
    });
    expect(spinRatioToTkaTurnFraction(makeSpinRatio(2, 7))).toEqual({
      numerator: -5,
      denominator: 14,
    });
    expect(spinRatioToTkaTurnFraction(makeSpinRatio(1, 0))).toBeNull();
  });

  it("calculates individual and joint closure cycles", () => {
    expect(spinRatioClosureHandCycles(makeSpinRatio(2, 9))).toBe(9);
    expect(spinRatioClosureHandCycles(makeSpinRatio(1, 0))).toBe(0);
    expect(
      jointSpinRatioClosureHandCycles([
        makeSpinRatio(1, 8),
        makeSpinRatio(2, 9),
      ])
    ).toBe(72);
    expect(
      jointSpinRatioClosureHandCycles([
        makeSpinRatio(1, 0),
        makeSpinRatio(2, 7),
      ])
    ).toBe(7);
    expect(jointSpinRatioClosureHandCycles([makeSpinRatio(1, 0)])).toBe(1);
  });

  it("derives pro and anti petal counts from reduced ratio integers", () => {
    expect(spinRatioPetals(makeSpinRatio(1, 3), "pro")).toBe(2);
    expect(spinRatioPetals(makeSpinRatio(1, 3), "anti")).toBe(4);
    expect(spinRatioPetals(makeSpinRatio(2, 7), "pro")).toBe(5);
    expect(spinRatioPetals(makeSpinRatio(2, 7), "anti")).toBe(9);
    expect(spinRatioPetals(makeSpinRatio(1, 0), "pro")).toBe(1);
    expect(spinRatioPetals(makeSpinRatio(1, 0), "anti")).toBe(1);
  });
});
