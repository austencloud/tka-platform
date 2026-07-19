/**
 * Pure-math tests for the prop morph's flourish curves (prop-morph-easing.ts).
 * The renderer draw path is exercised visually (screenshot verification in the
 * hero attract act); these lock the curve SHAPES the draw path relies on.
 */
import { describe, it, expect } from "vitest";
import {
  easeInOutCosine,
  propMorphOutgoingScale,
  propMorphIncomingScale,
  propMorphGlowBlur,
  PROP_MORPH_OUTGOING_PEAK_SCALE,
  PROP_MORPH_INCOMING_START_SCALE,
  PROP_MORPH_GLOW_PEAK_PX,
} from "../prop-morph-easing";

describe("easeInOutCosine", () => {
  it("anchors 0 -> 0, 0.5 -> 0.5, 1 -> 1 and clamps out-of-range input", () => {
    expect(easeInOutCosine(0)).toBeCloseTo(0);
    expect(easeInOutCosine(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCosine(1)).toBeCloseTo(1);
    expect(easeInOutCosine(-2)).toBeCloseTo(0);
    expect(easeInOutCosine(3)).toBeCloseTo(1);
  });

  it("eases: slower than linear at the edges, symmetric about the midpoint", () => {
    expect(easeInOutCosine(0.1)).toBeLessThan(0.1);
    expect(easeInOutCosine(0.9)).toBeGreaterThan(0.9);
    expect(easeInOutCosine(0.25) + easeInOutCosine(0.75)).toBeCloseTo(1);
  });
});

describe("morph scale curves", () => {
  it("outgoing grows from 1 to the peak scale as it dissolves", () => {
    expect(propMorphOutgoingScale(0)).toBeCloseTo(1);
    expect(propMorphOutgoingScale(1)).toBeCloseTo(PROP_MORPH_OUTGOING_PEAK_SCALE);
    expect(propMorphOutgoingScale(0.5)).toBeGreaterThan(1);
    expect(propMorphOutgoingScale(0.5)).toBeLessThan(PROP_MORPH_OUTGOING_PEAK_SCALE);
  });

  it("incoming condenses from its start scale up to exactly 1", () => {
    expect(propMorphIncomingScale(0)).toBeCloseTo(PROP_MORPH_INCOMING_START_SCALE);
    expect(propMorphIncomingScale(1)).toBeCloseTo(1);
  });
});

describe("propMorphGlowBlur", () => {
  it("is zero at both ends and peaks at the midpoint, scaled to canvas size", () => {
    const canvas = 950; // 1:1 with the reference viewBox
    expect(propMorphGlowBlur(0, canvas, 950)).toBeCloseTo(0);
    expect(propMorphGlowBlur(1, canvas, 950)).toBeCloseTo(0);
    expect(propMorphGlowBlur(0.5, canvas, 950)).toBeCloseTo(PROP_MORPH_GLOW_PEAK_PX);
    // Half-size canvas -> half the blur radius.
    expect(propMorphGlowBlur(0.5, 475, 950)).toBeCloseTo(PROP_MORPH_GLOW_PEAK_PX / 2);
  });

  it("degrades to zero on a nonsensical viewbox instead of dividing by it", () => {
    expect(propMorphGlowBlur(0.5, 516, 0)).toBe(0);
  });
});
