import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  applyReversalToMotion,
  getReversalFlagsForBeat,
  applyReversalPattern,
  REVERSAL_PATTERNS,
} = require("../../scripts/apply-reversal-pattern.cjs");

describe("applyReversalToMotion", () => {
  it("flips pro to anti when reversed", () => {
    expect(applyReversalToMotion("pro", true)).toBe("anti");
  });

  it("flips anti to pro when reversed", () => {
    expect(applyReversalToMotion("anti", true)).toBe("pro");
  });

  it("leaves pro unchanged when not reversed", () => {
    expect(applyReversalToMotion("pro", false)).toBe("pro");
  });

  it("leaves anti unchanged when not reversed", () => {
    expect(applyReversalToMotion("anti", false)).toBe("anti");
  });

  it("leaves static unchanged when reversed", () => {
    expect(applyReversalToMotion("static", true)).toBe("static");
  });

  it("leaves static unchanged when not reversed", () => {
    expect(applyReversalToMotion("static", false)).toBe("static");
  });

  it("leaves dash unchanged when reversed", () => {
    expect(applyReversalToMotion("dash", true)).toBe("dash");
  });

  it("leaves dash unchanged when not reversed", () => {
    expect(applyReversalToMotion("dash", false)).toBe("dash");
  });
});

describe("getReversalFlagsForBeat", () => {
  it("P symbol → both hands reversed", () => {
    const flags = getReversalFlagsForBeat("PPPP", 0);
    expect(flags).toEqual({ blueReversal: true, redReversal: true });
  });

  it("R symbol → red reversed, blue not reversed", () => {
    const flags = getReversalFlagsForBeat("RRRR", 0);
    expect(flags).toEqual({ blueReversal: false, redReversal: true });
  });

  it("B symbol → blue reversed, red not reversed", () => {
    const flags = getReversalFlagsForBeat("BBBB", 0);
    expect(flags).toEqual({ blueReversal: true, redReversal: false });
  });

  it("- symbol → neither hand reversed", () => {
    const flags = getReversalFlagsForBeat("----", 0);
    expect(flags).toEqual({ blueReversal: false, redReversal: false });
  });

  it("reads correct symbol for beat index 1", () => {
    // Pattern 'P-': index 0 = P, index 1 = -
    expect(getReversalFlagsForBeat("P-", 1)).toEqual({
      blueReversal: false,
      redReversal: false,
    });
  });

  it("wraps around with modulo (beat 4 on length-2 pattern same as beat 0)", () => {
    // Pattern 'P-' has length 2: beat 4 % 2 = 0 → P
    const flagsAt0 = getReversalFlagsForBeat("P-", 0);
    const flagsAt4 = getReversalFlagsForBeat("P-", 4);
    expect(flagsAt4).toEqual(flagsAt0);
    expect(flagsAt4).toEqual({ blueReversal: true, redReversal: true });
  });

  it("wraps correctly for odd beat index (beat 5 on length-2 pattern same as beat 1)", () => {
    const flagsAt1 = getReversalFlagsForBeat("P-", 1);
    const flagsAt5 = getReversalFlagsForBeat("P-", 5);
    expect(flagsAt5).toEqual(flagsAt1);
    expect(flagsAt5).toEqual({ blueReversal: false, redReversal: false });
  });

  it("throws on unknown symbol", () => {
    expect(() => getReversalFlagsForBeat("X", 0)).toThrow();
  });
});

function makeSteps(count: number, blueMotion = "pro", redMotion = "pro") {
  return Array.from({ length: count }, (_, i) => ({
    stepNumber: i,
    blueMotionType: blueMotion,
    redMotionType: redMotion,
    blueReversal: false,
    redReversal: false,
  }));
}

describe("applyReversalPattern", () => {
  it("book pattern on all-pro steps → alternating anti/pro (cumulative), all flags set", () => {
    const steps = makeSteps(4, "pro", "pro");
    applyReversalPattern(steps, "book");

    // PPPP toggles parity every beat: flipped, base, flipped, base → anti/pro/anti/pro.
    const expected = ["anti", "pro", "anti", "pro"];
    steps.forEach((step, i) => {
      expect(step.blueReversal).toBe(true);
      expect(step.redReversal).toBe(true);
      expect(step.blueMotionType).toBe(expected[i]);
      expect(step.redMotionType).toBe(expected[i]);
    });
  });

  it("continuous pattern (-) leaves all pro steps unchanged", () => {
    const steps = makeSteps(4, "pro", "pro");
    applyReversalPattern(steps, "continuous");

    for (const step of steps) {
      expect(step.blueReversal).toBe(false);
      expect(step.redReversal).toBe(false);
      expect(step.blueMotionType).toBe("pro");
      expect(step.redMotionType).toBe("pro");
    }
  });

  it("alternating pattern (RBRB) — red flips on even beats, blue on odd", () => {
    // Pattern: R B R B R B R B
    const steps = makeSteps(4, "pro", "pro");
    applyReversalPattern(steps, "alternating");

    expect(steps[0].redReversal).toBe(true);
    expect(steps[0].blueReversal).toBe(false);
    expect(steps[0].redMotionType).toBe("anti");
    expect(steps[0].blueMotionType).toBe("pro");

    expect(steps[1].blueReversal).toBe(true);
    expect(steps[1].redReversal).toBe(false);
    expect(steps[1].blueMotionType).toBe("anti");
    // Cumulative: red toggled at beat 0 and not at beat 1, so red parity is still
    // reversed here → red stays anti (not back to pro).
    expect(steps[1].redMotionType).toBe("anti");

    expect(steps[2].redReversal).toBe(true);
    expect(steps[2].blueReversal).toBe(false);

    expect(steps[3].blueReversal).toBe(true);
    expect(steps[3].redReversal).toBe(false);
  });

  it("static motions remain static under book pattern, but flags are still set", () => {
    const steps = makeSteps(2, "static", "static");
    applyReversalPattern(steps, "book");

    for (const step of steps) {
      expect(step.blueReversal).toBe(true);
      expect(step.redReversal).toBe(true);
      // Static doesn't flip — no rotation to reverse
      expect(step.blueMotionType).toBe("static");
      expect(step.redMotionType).toBe("static");
    }
  });

  it("mixed motion types: pro flips, dash stays, static stays", () => {
    const steps = [
      { stepNumber: 0, blueMotionType: "pro", redMotionType: "dash", blueReversal: false, redReversal: false },
      { stepNumber: 1, blueMotionType: "static", redMotionType: "anti", blueReversal: false, redReversal: false },
    ];
    applyReversalPattern(steps, "book");

    // PPPP: beat0 parity→true (flip), beat1 parity→false (base).
    expect(steps[0].blueMotionType).toBe("anti"); // pro flipped → anti
    expect(steps[0].redMotionType).toBe("dash");  // dash unchanged
    expect(steps[1].blueMotionType).toBe("static"); // static unchanged
    expect(steps[1].redMotionType).toBe("anti");  // parity back to base → red anti unchanged
  });

  it("throws when given an unknown pattern id", () => {
    const steps = makeSteps(2);
    expect(() => applyReversalPattern(steps, "nonexistent-pattern-xyz")).toThrow();
  });

  it("returns the mutated steps array (same reference)", () => {
    const steps = makeSteps(2);
    const result = applyReversalPattern(steps, "book");
    expect(result).toBe(steps);
  });
});

describe("REVERSAL_PATTERNS", () => {
  it("contains all 15 expected patterns", () => {
    const keys = Object.keys(REVERSAL_PATTERNS);
    expect(keys).toHaveLength(15);
  });

  it("each pattern has sequence and period fields", () => {
    for (const [id, pattern] of Object.entries(REVERSAL_PATTERNS)) {
      expect(typeof (pattern as any).sequence).toBe("string");
      expect(typeof (pattern as any).period).toBe("number");
    }
  });

  it("continuous pattern has all dashes and period 1", () => {
    const p = REVERSAL_PATTERNS["continuous"] as any;
    expect(p.sequence).toMatch(/^-+$/);
    expect(p.period).toBe(1);
  });

  it("book pattern has all P's and period 1", () => {
    const p = REVERSAL_PATTERNS["book"] as any;
    expect(p.sequence).toMatch(/^P+$/);
    expect(p.period).toBe(1);
  });

  it("alternating pattern is RBRB with period 2", () => {
    const p = REVERSAL_PATTERNS["alternating"] as any;
    expect(p.sequence).toBe("RBRB");
    expect(p.period).toBe(2);
  });

  it("solo-3 has period 32", () => {
    expect((REVERSAL_PATTERNS["solo-3"] as any).period).toBe(32);
  });

  it("dense-weave-3 has period 32", () => {
    expect((REVERSAL_PATTERNS["dense-weave-3"] as any).period).toBe(32);
  });

  it("sparse-weave-3 has period 32", () => {
    expect((REVERSAL_PATTERNS["sparse-weave-3"] as any).period).toBe(32);
  });

  it("all pattern sequences only contain valid symbols (P, R, B, -)", () => {
    for (const [id, pattern] of Object.entries(REVERSAL_PATTERNS)) {
      const seq = (pattern as any).sequence as string;
      expect(seq).toMatch(/^[PRB-]+$/);
    }
  });
});
