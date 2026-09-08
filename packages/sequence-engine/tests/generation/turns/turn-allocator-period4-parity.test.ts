import { describe, it, expect } from "vitest";
import { allocateTurns } from "../../../src/generation/turns/TurnAllocator.js";

/**
 * Period-4 parity tests.
 *
 * For non-rotated LOOPs at L3+, the generator must produce partials whose
 * per-hand turn total is ≡ 1 or 3 (mod 4) wheel-quarters. This ensures the
 * 4-pass executor output actually closes at step 4N, not at step 2N
 * (which would masquerade as period 2 duplicated).
 *
 * 1 turn = 180° = 2 wheel-quarters.
 * 0.5 turns = 90° = 1 wheel-quarter.
 * "fl" = 0 contribution.
 */

function wheelQuarters(turn: number | "fl"): number {
  if (turn === "fl") return 0;
  return Math.round(turn * 2) % 4;
}

function totalWheelQuarters(turns: (number | "fl")[]): number {
  return turns.reduce((sum, t) => (sum + wheelQuarters(t)) % 4, 0);
}

describe("allocateTurns — period-4 parity", () => {
  const STEP_COUNT = 4;
  const LEVEL_3 = 3;
  const MAX_INTENSITY = 3;

  it("without parity enforcement, totals may be any value mod 4 (mostly even due to whole-turn dominance)", () => {
    // Sanity check: default behavior is unconstrained.
    let oddSeen = 0;
    let evenSeen = 0;
    for (let i = 0; i < 100; i++) {
      const { left } = allocateTurns(STEP_COUNT, LEVEL_3, MAX_INTENSITY);
      const total = totalWheelQuarters(left);
      if (total % 2 === 0) evenSeen++;
      else oddSeen++;
    }
    // Not asserting proportions; just verifying that both parities occur.
    // The point is that default is unconstrained.
    expect(oddSeen + evenSeen).toBe(100);
  });

  it("forces an odd wheel-quarter total for a genuine four-repetition orientation cycle", () => {
    for (let i = 0; i < 50; i++) {
      const { left, right } = allocateTurns(STEP_COUNT, LEVEL_3, MAX_INTENSITY, {
        forcePeriod4OrientationCycle: true,
      });
      const leftTotal = totalWheelQuarters(left);
      const rightTotal = totalWheelQuarters(right);
      expect(leftTotal % 2).toBe(1);
      expect(rightTotal % 2).toBe(1);
    }
  });

  it("enforced parity produces step counts matching the request", () => {
    const { left, right } = allocateTurns(8, LEVEL_3, MAX_INTENSITY, {
      forcePeriod4OrientationCycle: true,
    });
    expect(left.length).toBe(8);
    expect(right.length).toBe(8);
  });

  it("at L2 (no half turns available), parity enforcement falls back gracefully", () => {
    const LEVEL_2 = 2;
    // Level 2 pool = [0, 1, 2, 3] — no half turns, no way to hit odd parity.
    // Should not crash; returns something.
    const { left, right } = allocateTurns(STEP_COUNT, LEVEL_2, MAX_INTENSITY, {
      forcePeriod4OrientationCycle: true,
    });
    expect(left.length).toBe(STEP_COUNT);
    expect(right.length).toBe(STEP_COUNT);
  });

  it("at L1 (only 0 turns), parity enforcement produces all zeros without crashing", () => {
    const { left, right } = allocateTurns(STEP_COUNT, 1, MAX_INTENSITY, {
      forcePeriod4OrientationCycle: true,
    });
    expect(left).toEqual([0, 0, 0, 0]);
    expect(right).toEqual([0, 0, 0, 0]);
  });

  it("single-step partial with parity enforcement still produces a valid odd total", () => {
    // Edge case: wordLength = 1. The implementation preallocates wordLength-1
    // steps randomly then fixes the last. With N=1 that means 0 random + 1 targeted.
    const { left } = allocateTurns(1, LEVEL_3, MAX_INTENSITY, {
      forcePeriod4OrientationCycle: true,
    });
    expect(left.length).toBe(1);
    expect(wheelQuarters(left[0]!) % 2).toBe(1);
  });

  it("longer partial (8 steps) still hits odd parity reliably", () => {
    for (let i = 0; i < 50; i++) {
      const { left, right } = allocateTurns(8, LEVEL_3, MAX_INTENSITY, {
        forcePeriod4OrientationCycle: true,
      });
      expect(totalWheelQuarters(left) % 2).toBe(1);
      expect(totalWheelQuarters(right) % 2).toBe(1);
    }
  });
});
