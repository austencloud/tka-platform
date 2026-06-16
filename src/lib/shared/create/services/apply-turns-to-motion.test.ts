import { describe, it, expect, vi } from "vitest";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

// Deterministic orientation: "in" at 0 turns, "out" otherwise — lets us assert
// that turns flow through to an end-orientation recompute.
vi.mock("$lib/shared/pictograph/prop/services/orientation-calculator", () => ({
  calculateEndOrientation: (m: { turns: number | "fl" }) =>
    m.turns === 0 || m.turns === "fl" ? "in" : "out",
}));

import { applyPendingTurnsToOption } from "./apply-turns-to-motion";

const CW = RotationDirection.CLOCKWISE;
const CCW = RotationDirection.COUNTER_CLOCKWISE;
const NONE = RotationDirection.NO_ROTATION;

function makeMotionOption(
  blueType: MotionType,
  redType: MotionType
): PictographData {
  return {
    letter: "X",
    motions: {
      blue: createMotionData({
        motionType: blueType,
        rotationDirection:
          blueType === MotionType.PRO ? CW : NONE,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        startLocation: "n",
        endLocation: "s",
      }),
      red: createMotionData({
        motionType: redType,
        rotationDirection:
          redType === MotionType.PRO ? CCW : NONE,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        startLocation: "e",
        endLocation: "w",
      }),
    },
  } as unknown as PictographData;
}

describe("applyPendingTurnsToOption", () => {
  it("applies turns per hand and recomputes end orientation", () => {
    const opt = makeMotionOption(MotionType.PRO, MotionType.PRO);
    const result = applyPendingTurnsToOption(opt, 1, 0, CW, CW);
    expect(result.motions.blue!.turns).toBe(1);
    expect(result.motions.blue!.endOrientation).toBe("out");
    expect(result.motions.red!.turns).toBe(0);
    expect(result.motions.red!.endOrientation).toBe("in");
  });

  it("returns a new object and does not mutate the input", () => {
    const opt = makeMotionOption(MotionType.PRO, MotionType.PRO);
    const result = applyPendingTurnsToOption(opt, 1, 1, CW, CW);
    expect(result).not.toBe(opt);
    expect(opt.motions.blue!.turns).toBe(0);
  });

  it("returns the option unchanged when a motion is missing", () => {
    const input = { letter: "A", motions: { blue: undefined, red: undefined } } as unknown as PictographData;
    expect(applyPendingTurnsToOption(input, 1, 1, CW, CW)).toBe(input);
  });

  it("applies the chosen spin direction to a dash/static hand with turns", () => {
    const opt = makeMotionOption(MotionType.STATIC, MotionType.DASH);
    const cw = applyPendingTurnsToOption(opt, 1, 1, CW, CW);
    expect(cw.motions.blue!.rotationDirection).toBe(CW);
    expect(cw.motions.red!.rotationDirection).toBe(CW);

    const ccw = applyPendingTurnsToOption(opt, 1, 1, CCW, CCW);
    expect(ccw.motions.blue!.rotationDirection).toBe(CCW);
    expect(ccw.motions.red!.rotationDirection).toBe(CCW);
  });

  it("leaves a shift hand's intrinsic direction alone (override ignored)", () => {
    const opt = makeMotionOption(MotionType.PRO, MotionType.STATIC);
    // blue is a shift (intrinsic CW); passing CCW must not flip it
    const result = applyPendingTurnsToOption(opt, 1, 1, CCW, CCW);
    expect(result.motions.blue!.rotationDirection).toBe(CW);
    expect(result.motions.red!.rotationDirection).toBe(CCW);
  });

  it("a dash/static hand at 0 turns stays at no-rotation regardless of direction", () => {
    const opt = makeMotionOption(MotionType.STATIC, MotionType.STATIC);
    const result = applyPendingTurnsToOption(opt, 0, 0, CW, CW);
    expect(result.motions.blue!.rotationDirection).toBe(NONE);
    expect(result.motions.red!.rotationDirection).toBe(NONE);
  });
});
