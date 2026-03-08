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
    it("at midpoint, output < 0.15 (quintic stays very low) with default sharpness", () => {
      const midpoint = applyEffortEasing("sudden", 0.5);
      expect(midpoint).toBeLessThan(0.15);
    });

    it("with sharpness=2, output at 0.5 is higher (less sudden)", () => {
      const midpoint = applyEffortEasing("sudden", 0.5, { sharpness: 2 });
      // t^2 at 0.5 = 0.25, much higher than t^5 at 0.5 = 0.03125
      expect(midpoint).toBeCloseTo(0.25, 2);
      expect(midpoint).toBeGreaterThan(0.15);
    });
  });

  describe("light", () => {
    it("at midpoint, output > 0.8 (quartic ease-out jumps ahead)", () => {
      const midpoint = applyEffortEasing("light", 0.5);
      expect(midpoint).toBeGreaterThan(0.8);
    });
  });

  describe("bound", () => {
    it("with default steps=4, values progress through segments", () => {
      // Sample at segment midpoints to verify distinct levels
      const seg0 = applyEffortEasing("bound", 0.125); // mid of segment 0
      const seg1 = applyEffortEasing("bound", 0.375); // mid of segment 1
      const seg2 = applyEffortEasing("bound", 0.625); // mid of segment 2
      const seg3 = applyEffortEasing("bound", 0.875); // mid of segment 3

      // Each segment should reach a higher level
      expect(seg1).toBeGreaterThan(seg0);
      expect(seg2).toBeGreaterThan(seg1);
      expect(seg3).toBeGreaterThan(seg2);
    });

    it("with steps=2 has 2 distinct segments", () => {
      // Segment 0: 0-0.5, segment 1: 0.5-1.0
      const earlyInSeg0 = applyEffortEasing("bound", 0.05, { steps: 2, smoothness: 0.5 });
      const lateInSeg0 = applyEffortEasing("bound", 0.45, { steps: 2, smoothness: 0.5 });
      const earlyInSeg1 = applyEffortEasing("bound", 0.55, { steps: 2, smoothness: 0.5 });
      const lateInSeg1 = applyEffortEasing("bound", 0.95, { steps: 2, smoothness: 0.5 });

      // Seg 0 values should be in [0, 0.5]
      expect(earlyInSeg0).toBeGreaterThanOrEqual(0);
      expect(lateInSeg0).toBeLessThanOrEqual(0.55);

      // Seg 1 values should be in [0.5, 1.0]
      expect(earlyInSeg1).toBeGreaterThanOrEqual(0.45);
      expect(lateInSeg1).toBeLessThanOrEqual(1.05);

      // Distinct jump between segments
      expect(earlyInSeg1).toBeGreaterThan(earlyInSeg0);
    });

    it("with steps=8 has 8 distinct segments", () => {
      const params = { steps: 8, smoothness: 0.5 };
      // Sample at the midpoint of each of 8 segments
      const values: number[] = [];
      for (let i = 0; i < 8; i++) {
        const t = (i + 0.5) / 8;
        values.push(applyEffortEasing("bound", t, params));
      }

      // Each subsequent segment midpoint should be higher
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]!);
      }
    });
  });

  describe("free", () => {
    it("stays within a reasonable range (0 to ~1.05)", () => {
      const samples = sampleEasingCurve("free", 256);
      const maxValue = Math.max(...samples.map((s) => s.value));
      const minValue = Math.min(...samples.map((s) => s.value));
      // Free is now flowing with subtle wave, not spring overshoot
      expect(maxValue).toBeLessThan(1.1);
      expect(minValue).toBeGreaterThan(-0.1);
    });

    it("with high momentum has slightly more wave variation", () => {
      const lowMomentum = sampleEasingCurve("free", 256, { momentum: 0.1 });
      const highMomentum = sampleEasingCurve("free", 256, { momentum: 1.0 });

      // Compute max deviation from a pure ease-in-out baseline
      function maxDeviation(samples: { t: number; value: number }[]): number {
        let maxDev = 0;
        for (const s of samples) {
          const base = s.t < 0.5 ? 2 * s.t * s.t : 1 - Math.pow(-2 * s.t + 2, 2) / 2;
          maxDev = Math.max(maxDev, Math.abs(s.value - base));
        }
        return maxDev;
      }

      expect(maxDeviation(highMomentum)).toBeGreaterThan(maxDeviation(lowMomentum));
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

    it("passes params through to easing function", () => {
      const defaultCurve = sampleEasingCurve("sudden", 64);
      const sharpCurve = sampleEasingCurve("sudden", 64, { sharpness: 2 });

      // With sharpness=2, midpoint value should differ from default (sharpness=5)
      const defaultMid = defaultCurve[32]!.value;
      const sharpMid = sharpCurve[32]!.value;
      expect(sharpMid).toBeGreaterThan(defaultMid);
    });
  });
});
