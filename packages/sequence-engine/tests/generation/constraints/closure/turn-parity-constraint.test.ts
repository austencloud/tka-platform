/**
 * TurnParityConstraint — closure-math validation.
 *
 * Validates the core math: per-pass turn totals combined with target period
 * produce the correct satisfied/not-satisfied decision.
 */

import { describe, it, expect } from "vitest";
import { TurnParityConstraint } from "../../../../src/generation/constraints/closure/turn-parity-constraint.js";
import type { PictographData } from "../../../../src/generation/constraints/types.js";

function step(blueTurns: number, redTurns: number): PictographData {
  return {
    letter: "A",
    startPosition: "alpha1",
    endPosition: "alpha1",
    timing: "split",
    direction: "same",
    blueMotion: {
      motionType: "pro",
      startLocation: "n",
      endLocation: "n",
      rotationDirection: "cw",
      startOrientation: "in",
      endOrientation: "in",
      turns: blueTurns,
    } as unknown as PictographData["blueMotion"],
    redMotion: {
      motionType: "pro",
      startLocation: "s",
      endLocation: "s",
      rotationDirection: "cw",
      startOrientation: "in",
      endOrientation: "in",
      turns: redTurns,
    } as unknown as PictographData["redMotion"],
  };
}

describe("TurnParityConstraint", () => {
  describe("period 2", () => {
    const c = new TurnParityConstraint(2);

    it("accepts integer turn totals (delta even)", () => {
      const seq = [step(1, 1), step(1, 0)];
      // Blue total: 2 turns = 4q; mod 4 = 0. Red: 1 turn = 2q; mod 4 = 2.
      // Both periods-2-close: (2 * 0) mod 4 = 0, (2 * 2) mod 4 = 0. ✓
      expect(c.evaluateSequence(seq).satisfied).toBe(true);
    });

    it("rejects half-turn totals (delta odd)", () => {
      const seq = [step(0.5, 0)];
      // Blue total: 0.5 turns = 1q; mod 4 = 1. (2 * 1) mod 4 = 2 ≠ 0. ✗
      expect(c.evaluateSequence(seq).satisfied).toBe(false);
    });
  });

  describe("period 4", () => {
    const c = new TurnParityConstraint(4);

    it("accepts half-turn totals (any integer quarter-turn count closes)", () => {
      const seq = [step(0.5, 0)];
      // Blue: 1q, (4 * 1) mod 4 = 0. ✓
      expect(c.evaluateSequence(seq).satisfied).toBe(true);
    });

    it("accepts integer turn totals", () => {
      const seq = [step(1, 2)];
      // Blue: 2q, (4 * 2) mod 4 = 0. Red: 4q, mod 4 = 0. Both close. ✓
      expect(c.evaluateSequence(seq).satisfied).toBe(true);
    });
  });

  describe("single-variation evaluate", () => {
    it("always returns satisfied at the variation level (sequence-level check only)", () => {
      const c = new TurnParityConstraint(2);
      // evaluate() short-circuits — it's a sequence-level constraint.
      const result = c.evaluate({} as never);
      expect(result.satisfied).toBe(true);
    });
  });
});
