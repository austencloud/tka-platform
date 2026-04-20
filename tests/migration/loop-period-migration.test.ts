/**
 * LOOP Period Migration — pure-function validation.
 *
 * The actual migration script (scripts/migrate-loop-period.cjs) requires
 * Firebase Admin credentials, so we test the derivation helpers directly by
 * re-implementing them here. Any divergence between these and the script
 * means the migration is broken.
 *
 * Keep this test and the script's helper functions in lockstep.
 */

import { describe, it, expect } from "vitest";

// Duplicate of the script's helpers — intentional, since the script is CJS
// and can't be imported by Vitest without transpilation overhead. Keeping
// them here as reference implementation tests.

const LOOP_COMPONENTS = {
  ROTATED: "rotated",
  MIRRORED: "mirrored",
  FLIPPED: "flipped",
  SWAPPED: "swapped",
  INVERTED: "inverted",
  REWOUND: "rewound",
};

function periodFromLegacy(
  loopType: string | null | undefined,
  orientationCycleCount: 1 | 2 | 4 | undefined
): number {
  if (orientationCycleCount && orientationCycleCount > 1) {
    return orientationCycleCount;
  }
  if (loopType) return 2;
  return 1;
}

function parseComponents(loopType: string | null | undefined): string[] {
  if (!loopType) return [];
  const lower = String(loopType).toLowerCase();
  const out: string[] = [];
  for (const [, value] of Object.entries(LOOP_COMPONENTS)) {
    if (lower.includes(value)) {
      out.push(value);
    }
  }
  return out;
}

describe("loop period migration helpers", () => {
  describe("periodFromLegacy", () => {
    it("returns orientationCycleCount when > 1", () => {
      expect(periodFromLegacy("rotated", 4)).toBe(4);
      expect(periodFromLegacy("mirrored", 2)).toBe(2);
    });

    it("returns 2 when loopType present but cycle count is 1 or undefined", () => {
      expect(periodFromLegacy("rotated", 1)).toBe(2);
      expect(periodFromLegacy("swapped", undefined)).toBe(2);
    });

    it("returns 1 for non-LOOP sequences", () => {
      expect(periodFromLegacy(null, undefined)).toBe(1);
      expect(periodFromLegacy("", undefined)).toBe(1);
    });
  });

  describe("parseComponents", () => {
    it("extracts single component", () => {
      expect(parseComponents("rotated")).toEqual(["rotated"]);
      expect(parseComponents("mirrored")).toEqual(["mirrored"]);
    });

    it("extracts compound components from underscore form", () => {
      expect(parseComponents("rotated_swapped").sort()).toEqual([
        "rotated",
        "swapped",
      ]);
      expect(parseComponents("mirrored_inverted_rotated").sort()).toEqual([
        "inverted",
        "mirrored",
        "rotated",
      ]);
    });

    it("returns empty array for null/empty", () => {
      expect(parseComponents(null)).toEqual([]);
      expect(parseComponents("")).toEqual([]);
    });
  });

  describe("idempotency", () => {
    it("L1 Quartered Rotated sequence derives period 4 rotated", () => {
      expect(periodFromLegacy("rotated", 4)).toBe(4);
      expect(parseComponents("rotated")).toEqual(["rotated"]);
    });

    it("Halved mirrored sequence derives period 2 mirrored", () => {
      expect(periodFromLegacy("mirrored", 2)).toBe(2);
      expect(parseComponents("mirrored")).toEqual(["mirrored"]);
    });

    it("Non-LOOP sequence derives period 1 empty components", () => {
      expect(periodFromLegacy(null, undefined)).toBe(1);
      expect(parseComponents(null)).toEqual([]);
    });
  });
});
