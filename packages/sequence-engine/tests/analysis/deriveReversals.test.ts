/**
 * Tests for deriveReversals — pure function that computes per-hand reversal
 * flags for a sequence of Step values.
 *
 * A "reversal" occurs when a hand's rotation direction flips between two
 * consecutive non-blank steps. Step 0 (start position) is never a reversal.
 * Blank steps break the rotation chain: the first real step after a blank
 * has no prior direction to reverse against.
 */

import { describe, it, expect } from "vitest";
import {
  createStep,
  createStartStep,
  createMotion,
  GridPosition,
  GridLocation,
  MotionType,
  RotationDirection,
  Orientation,
  Plane,
  PropColor,
  Letter,
  type Motion,
} from "@tka/tka-types";
import { deriveReversals } from "../../src/analysis/deriveReversals.js";

function mkMotion(
  color: "blue" | "red",
  rotationDirection: "cw" | "ccw" | "noRotation"
): Motion {
  return createMotion({
    motionType: MotionType.shift,
    startLocation: GridLocation.n,
    endLocation: GridLocation.e,
    rotationDirection:
      rotationDirection === "cw"
        ? RotationDirection.cw
        : rotationDirection === "ccw"
          ? RotationDirection.ccw
          : RotationDirection.noRotation,
    startOrientation: Orientation.in,
    endOrientation: Orientation.out,
    turns: 0,
    plane: Plane.wall,
    color: color === "blue" ? PropColor.blue : PropColor.red,
  });
}

describe("deriveReversals", () => {
  it("returns an empty array for empty input", () => {
    expect(deriveReversals([])).toEqual([]);
  });

  it("marks the start-position step (stepNumber 0) as no reversal", () => {
    const start = createStartStep(GridPosition.alpha1);
    expect(deriveReversals([start])).toEqual([{ blue: false, red: false }]);
  });

  it("marks a single following step with no reversal when prior was noRotation", () => {
    // Start step has noRotation on both hands (static). First real step with
    // actual rotation has no prior *active* direction to reverse against, so
    // no reversal on step 1.
    const start = createStartStep(GridPosition.alpha1);
    const step1 = createStep({
      id: "s1",
      letter: Letter.A,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha3,
      motions: { blue: mkMotion("blue", "cw"), red: mkMotion("red", "cw") },
      stepNumber: 1,
      duration: 1,
    });

    const result = deriveReversals([start, step1]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ blue: false, red: false });
    expect(result[1]).toEqual({ blue: false, red: false });
  });

  it("detects a blue-hand reversal when direction flips cw → ccw", () => {
    const start = createStartStep(GridPosition.alpha1);
    const step1 = createStep({
      id: "s1",
      letter: Letter.A,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha3,
      motions: { blue: mkMotion("blue", "cw"), red: mkMotion("red", "cw") },
      stepNumber: 1,
      duration: 1,
    });
    const step2 = createStep({
      id: "s2",
      letter: Letter.B,
      startPosition: GridPosition.alpha3,
      endPosition: GridPosition.alpha5,
      motions: { blue: mkMotion("blue", "ccw"), red: mkMotion("red", "cw") },
      stepNumber: 2,
      duration: 1,
    });

    const result = deriveReversals([start, step1, step2]);
    expect(result[2]).toEqual({ blue: true, red: false });
  });

  it("detects both-hand reversals when both directions flip", () => {
    const start = createStartStep(GridPosition.alpha1);
    const step1 = createStep({
      id: "s1",
      letter: Letter.A,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha3,
      motions: { blue: mkMotion("blue", "cw"), red: mkMotion("red", "ccw") },
      stepNumber: 1,
      duration: 1,
    });
    const step2 = createStep({
      id: "s2",
      letter: Letter.B,
      startPosition: GridPosition.alpha3,
      endPosition: GridPosition.alpha5,
      motions: { blue: mkMotion("blue", "ccw"), red: mkMotion("red", "cw") },
      stepNumber: 2,
      duration: 1,
    });

    const result = deriveReversals([start, step1, step2]);
    expect(result[2]).toEqual({ blue: true, red: true });
  });

  it("does not mark reversal when direction stays the same", () => {
    const start = createStartStep(GridPosition.alpha1);
    const step1 = createStep({
      id: "s1",
      letter: Letter.A,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha3,
      motions: { blue: mkMotion("blue", "cw"), red: mkMotion("red", "cw") },
      stepNumber: 1,
      duration: 1,
    });
    const step2 = createStep({
      id: "s2",
      letter: Letter.B,
      startPosition: GridPosition.alpha3,
      endPosition: GridPosition.alpha5,
      motions: { blue: mkMotion("blue", "cw"), red: mkMotion("red", "cw") },
      stepNumber: 2,
      duration: 1,
    });

    const result = deriveReversals([start, step1, step2]);
    expect(result[2]).toEqual({ blue: false, red: false });
  });

  it("does not mark reversal across noRotation on the current step", () => {
    const start = createStartStep(GridPosition.alpha1);
    const step1 = createStep({
      id: "s1",
      letter: Letter.A,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha3,
      motions: { blue: mkMotion("blue", "cw"), red: mkMotion("red", "cw") },
      stepNumber: 1,
      duration: 1,
    });
    const step2 = createStep({
      id: "s2",
      letter: Letter.B,
      startPosition: GridPosition.alpha3,
      endPosition: GridPosition.alpha3,
      motions: {
        blue: mkMotion("blue", "noRotation"),
        red: mkMotion("red", "noRotation"),
      },
      stepNumber: 2,
      duration: 1,
    });

    const result = deriveReversals([start, step1, step2]);
    expect(result[2]).toEqual({ blue: false, red: false });
  });

  it("does not mark reversal when prior step had noRotation (no active direction to reverse)", () => {
    const start = createStartStep(GridPosition.alpha1);
    const step1 = createStep({
      id: "s1",
      letter: Letter.A,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha1,
      motions: {
        blue: mkMotion("blue", "noRotation"),
        red: mkMotion("red", "noRotation"),
      },
      stepNumber: 1,
      duration: 1,
    });
    const step2 = createStep({
      id: "s2",
      letter: Letter.B,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha3,
      motions: { blue: mkMotion("blue", "cw"), red: mkMotion("red", "cw") },
      stepNumber: 2,
      duration: 1,
    });

    const result = deriveReversals([start, step1, step2]);
    expect(result[2]).toEqual({ blue: false, red: false });
  });

  it("breaks the reversal chain across a blank step (step after blank has no reversal)", () => {
    const start = createStartStep(GridPosition.alpha1);
    const step1 = createStep({
      id: "s1",
      letter: Letter.A,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha3,
      motions: { blue: mkMotion("blue", "cw"), red: mkMotion("red", "cw") },
      stepNumber: 1,
      duration: 1,
    });
    const blank = createStep({
      id: "s2",
      letter: null,
      startPosition: GridPosition.alpha3,
      endPosition: GridPosition.alpha3,
      motions: {
        blue: mkMotion("blue", "noRotation"),
        red: mkMotion("red", "noRotation"),
      },
      stepNumber: 2,
      duration: 1,
      isBlank: true,
    });
    const step3 = createStep({
      id: "s3",
      letter: Letter.B,
      startPosition: GridPosition.alpha3,
      endPosition: GridPosition.alpha5,
      // Direction is ccw — would normally be a reversal vs step1's cw, but the
      // blank breaks the chain so no reversal is reported.
      motions: { blue: mkMotion("blue", "ccw"), red: mkMotion("red", "ccw") },
      stepNumber: 3,
      duration: 1,
    });

    const result = deriveReversals([start, step1, blank, step3]);
    expect(result).toHaveLength(4);
    expect(result[3]).toEqual({ blue: false, red: false });
  });

  it("marks the blank step itself as no reversal", () => {
    const start = createStartStep(GridPosition.alpha1);
    const step1 = createStep({
      id: "s1",
      letter: Letter.A,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha3,
      motions: { blue: mkMotion("blue", "cw"), red: mkMotion("red", "cw") },
      stepNumber: 1,
      duration: 1,
    });
    const blank = createStep({
      id: "s2",
      letter: null,
      startPosition: GridPosition.alpha3,
      endPosition: GridPosition.alpha3,
      motions: {
        blue: mkMotion("blue", "noRotation"),
        red: mkMotion("red", "noRotation"),
      },
      stepNumber: 2,
      duration: 1,
      isBlank: true,
    });

    const result = deriveReversals([start, step1, blank]);
    expect(result[2]).toEqual({ blue: false, red: false });
  });

  it("handles a realistic 5-step sequence with mixed reversals", () => {
    const start = createStartStep(GridPosition.alpha1);
    const s1 = createStep({
      id: "s1",
      letter: Letter.A,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha3,
      motions: { blue: mkMotion("blue", "cw"), red: mkMotion("red", "ccw") },
      stepNumber: 1,
      duration: 1,
    });
    const s2 = createStep({
      id: "s2",
      letter: Letter.B,
      startPosition: GridPosition.alpha3,
      endPosition: GridPosition.alpha5,
      // blue flips cw → ccw (reversal). red stays ccw (no reversal).
      motions: { blue: mkMotion("blue", "ccw"), red: mkMotion("red", "ccw") },
      stepNumber: 2,
      duration: 1,
    });
    const s3 = createStep({
      id: "s3",
      letter: Letter.C,
      startPosition: GridPosition.alpha5,
      endPosition: GridPosition.alpha7,
      // blue stays ccw (no reversal). red flips ccw → cw (reversal).
      motions: { blue: mkMotion("blue", "ccw"), red: mkMotion("red", "cw") },
      stepNumber: 3,
      duration: 1,
    });
    const s4 = createStep({
      id: "s4",
      letter: Letter.D,
      startPosition: GridPosition.alpha7,
      endPosition: GridPosition.alpha7,
      // Both noRotation — not reversals (current is noRotation).
      motions: {
        blue: mkMotion("blue", "noRotation"),
        red: mkMotion("red", "noRotation"),
      },
      stepNumber: 4,
      duration: 1,
    });
    const s5 = createStep({
      id: "s5",
      letter: Letter.E,
      startPosition: GridPosition.alpha7,
      endPosition: GridPosition.alpha1,
      // Last active blue was ccw; now cw → reversal.
      // Last active red was cw; now ccw → reversal.
      motions: { blue: mkMotion("blue", "cw"), red: mkMotion("red", "ccw") },
      stepNumber: 5,
      duration: 1,
    });

    const result = deriveReversals([start, s1, s2, s3, s4, s5]);
    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({ blue: false, red: false }); // start
    expect(result[1]).toEqual({ blue: false, red: false }); // first step, no prior active
    expect(result[2]).toEqual({ blue: true, red: false });
    expect(result[3]).toEqual({ blue: false, red: true });
    expect(result[4]).toEqual({ blue: false, red: false }); // current noRotation
    expect(result[5]).toEqual({ blue: true, red: true });
  });
});
