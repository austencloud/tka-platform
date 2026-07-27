/**
 * Minimum Length Calculator — tabulated expected values.
 *
 * Per (loopType, period, level) the expected minimum length is an integer
 * or `Infinity` (infeasible). This test locks every expected answer so
 * the UI's length-chip disabling behavior cannot silently change.
 */

import { describe, it, expect } from "vitest";
import { minLength } from "../../../src/generation/capacity/minimum-length-calculator.js";
import { LOOPType } from "../../../src/loop/loop-types.js";

describe("minLength", () => {
  describe("period 1 (not a LOOP)", () => {
    it("returns 1 regardless of level", () => {
      expect(
        minLength({ loopType: LOOPType.ROTATED, period: 1, level: 1 })
      ).toBe(1);
      expect(
        minLength({ loopType: LOOPType.MIRRORED, period: 1, level: 3 })
      ).toBe(1);
    });
  });

  describe("level 1 (no turns)", () => {
    it("ROTATED period 2 → 4 steps (2 × 2)", () => {
      expect(
        minLength({ loopType: LOOPType.ROTATED, period: 2, level: 1 })
      ).toBe(4);
    });

    it("ROTATED period 4 → 8 steps (2 × 4)", () => {
      expect(
        minLength({ loopType: LOOPType.ROTATED, period: 4, level: 1 })
      ).toBe(8);
    });

    it("MIRRORED period 2 → 4 steps", () => {
      expect(
        minLength({ loopType: LOOPType.MIRRORED, period: 2, level: 1 })
      ).toBe(4);
    });

    it("MIRRORED period 4 → Infinity (L1 can't close orientation)", () => {
      expect(
        minLength({ loopType: LOOPType.MIRRORED, period: 4, level: 1 })
      ).toBe(Infinity);
    });

    it("SWAPPED period 2 → 2 steps (base 1 × period 2)", () => {
      expect(
        minLength({ loopType: LOOPType.SWAPPED, period: 2, level: 1 })
      ).toBe(2);
    });

    it("SWAPPED period 4 → Infinity at L1", () => {
      expect(
        minLength({ loopType: LOOPType.SWAPPED, period: 4, level: 1 })
      ).toBe(Infinity);
    });

    it("REWOUND period 2 → 2 steps", () => {
      expect(
        minLength({ loopType: LOOPType.REWOUND, period: 2, level: 1 })
      ).toBe(2);
    });

    it("INVERTED period 2 → 2 steps", () => {
      expect(
        minLength({ loopType: LOOPType.INVERTED, period: 2, level: 1 })
      ).toBe(2);
    });
  });

  describe("level 2+", () => {
    it("All standard LOOPs at period 4 are feasible at level 2", () => {
      expect(
        minLength({ loopType: LOOPType.ROTATED, period: 4, level: 2 })
      ).toBe(8);
      expect(
        minLength({ loopType: LOOPType.MIRRORED, period: 4, level: 2 })
      ).toBe(8);
      expect(
        minLength({ loopType: LOOPType.SWAPPED, period: 4, level: 2 })
      ).toBe(4);
    });

    it("Period 8 (future L5/L7) returns finite value", () => {
      expect(
        minLength({ loopType: LOOPType.ROTATED, period: 8, level: 5 })
      ).toBe(16);
    });
  });
});
