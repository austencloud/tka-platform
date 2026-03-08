import { describe, it, expect } from "vitest";
import {
  applyEffortEasing,
  sampleEasingCurve,
} from "../../src/lib/features/effort-lab/domain/effort-easing";
import type { EffortQuality } from "../../src/lib/features/effort-lab/domain/effort-qualities";

const ALL_QUALITIES: EffortQuality[] = [
  "linear",
  "sustained",
  "sudden",
  "heavy",
  "light",
  "bound",
  "free",
];

describe("Effort Easing Functions", () => {
  describe("boundary invariants", () => {
    it.each(ALL_QUALITIES)(
      "%s: f(0) ≈ 0 and f(1) ≈ 1",
      (quality) => {
        expect(applyEffortEasing(quality, 0)).toBeCloseTo(0, 2);
        expect(applyEffortEasing(quality, 1)).toBeCloseTo(1, 2);
      },
    );
  });

  describe("clamping", () => {
    it.each(ALL_QUALITIES)(
      "%s: negative input maps to 0 region",
      (quality) => {
        const result = applyEffortEasing(quality, -0.5);
        expect(result).toBeCloseTo(0, 2);
      },
    );

    it.each(ALL_QUALITIES)(
      "%s: input > 1 maps to 1 region",
      (quality) => {
        const result = applyEffortEasing(quality, 1.5);
        expect(result).toBeCloseTo(1, 2);
      },
    );
  });

  describe("linear", () => {
    it("is the identity function", () => {
      expect(applyEffortEasing("linear", 0.5)).toBeCloseTo(0.5, 5);
      expect(applyEffortEasing("linear", 0.25)).toBeCloseTo(0.25, 5);
      expect(applyEffortEasing("linear", 0.75)).toBeCloseTo(0.75, 5);
    });
  });

  describe("sudden", () => {
    it("at midpoint, output < 0.15 (quintic stays very low)", () => {
      const midpoint = applyEffortEasing("sudden", 0.5);
      expect(midpoint).toBeLessThan(0.15);
    });
  });

  describe("light", () => {
    it("at midpoint, output > 0.8 (quartic ease-out jumps ahead)", () => {
      const midpoint = applyEffortEasing("light", 0.5);
      expect(midpoint).toBeGreaterThan(0.8);
    });
  });

  describe("bound", () => {
    it("produces stepped output (adjacent inputs within same step produce close values)", () => {
      // Within step 1 (0.25-0.5), values in the hold region should be identical
      const a = applyEffortEasing("bound", 0.32);
      const b = applyEffortEasing("bound", 0.40);
      // Both should be at the step-end value since they're past the 20% transition
      expect(Math.abs(a - b)).toBeLessThan(0.01);
    });

    it("has distinct plateaus", () => {
      // Sample the hold regions of different steps
      const step0Hold = applyEffortEasing("bound", 0.15); // step 0, past transition
      const step1Hold = applyEffortEasing("bound", 0.40); // step 1, past transition
      const step2Hold = applyEffortEasing("bound", 0.65); // step 2, past transition
      const step3Hold = applyEffortEasing("bound", 0.90); // step 3, past transition

      // Each plateau should be at a distinct level
      expect(step1Hold - step0Hold).toBeGreaterThan(0.1);
      expect(step2Hold - step1Hold).toBeGreaterThan(0.1);
      expect(step3Hold - step2Hold).toBeGreaterThan(0.1);
    });
  });

  describe("free", () => {
    it("overshoots > 1.02 at some point during 0→1 transition", () => {
      const samples = sampleEasingCurve("free", 256);
      const maxValue = Math.max(...samples.map((s) => s.value));
      expect(maxValue).toBeGreaterThan(1.02);
    });
  });

  describe("sampleEasingCurve", () => {
    it("returns samples + 1 points (inclusive of endpoints)", () => {
      const curve = sampleEasingCurve("linear", 64);
      expect(curve).toHaveLength(65);
    });

    it("first sample is t=0, last sample is t=1", () => {
      const curve = sampleEasingCurve("sustained", 32);
      expect(curve[0].t).toBe(0);
      expect(curve[curve.length - 1].t).toBe(1);
    });
  });
});
