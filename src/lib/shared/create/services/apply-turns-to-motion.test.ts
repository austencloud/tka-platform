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

import {
  applyPendingTurnsToOption,
  applyTurnsToOptionVariants,
} from "./apply-turns-to-motion";

function makeMotionOption(
  blueType: MotionType,
  redType: MotionType
): PictographData {
  return {
    letter: "X",
    motions: {
      blue: createMotionData({
        motionType: blueType,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        startLocation: "n",
        endLocation: "s",
      }),
      red: createMotionData({
        motionType: redType,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        startLocation: "e",
        endLocation: "w",
      }),
    },
  } as unknown as PictographData;
}

function makeOption(): PictographData {
  return {
    letter: "A",
    motions: {
      blue: createMotionData({
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        startLocation: "s",
        endLocation: "e",
      }),
      red: createMotionData({
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        turns: 0,
        startOrientation: "in",
        endOrientation: "in",
        startLocation: "n",
        endLocation: "w",
      }),
    },
  } as unknown as PictographData;
}

describe("applyPendingTurnsToOption", () => {
  it("applies turns per hand and recomputes end orientation", () => {
    const result = applyPendingTurnsToOption(makeOption(), 1, 0);
    expect(result.motions.blue!.turns).toBe(1);
    expect(result.motions.blue!.endOrientation).toBe("out");
    expect(result.motions.red!.turns).toBe(0);
    expect(result.motions.red!.endOrientation).toBe("in");
  });

  it("returns a new object and does not mutate the input", () => {
    const input = makeOption();
    const result = applyPendingTurnsToOption(input, 1, 1);
    expect(result).not.toBe(input);
    expect(input.motions.blue!.turns).toBe(0);
  });

  it("returns the option unchanged when a motion is missing", () => {
    const input = { letter: "A", motions: { blue: undefined, red: undefined } } as unknown as PictographData;
    expect(applyPendingTurnsToOption(input, 1, 1)).toBe(input);
  });
});

describe("applyTurnsToOptionVariants", () => {
  it("shifts never fan out — one variant even with turns", () => {
    const opt = makeMotionOption(MotionType.PRO, MotionType.ANTI);
    expect(applyTurnsToOptionVariants(opt, 1, 1)).toHaveLength(1);
  });

  it("dash/static at 0 turns is a single variant (no direction)", () => {
    const opt = makeMotionOption(MotionType.DASH, MotionType.STATIC);
    const variants = applyTurnsToOptionVariants(opt, 0, 0);
    expect(variants).toHaveLength(1);
    expect(variants[0]!.motions.blue!.rotationDirection).toBe(
      RotationDirection.NO_ROTATION
    );
  });

  it("one ambiguous hand (static+turns) fans out to 2 directions", () => {
    // blue shift (fixed), red static with turns → red CW and CCW
    const opt = makeMotionOption(MotionType.PRO, MotionType.STATIC);
    const variants = applyTurnsToOptionVariants(opt, 1, 1);
    expect(variants).toHaveLength(2);
    const redDirs = variants.map((v) => v.motions.red!.rotationDirection).sort();
    expect(redDirs).toEqual(
      [RotationDirection.CLOCKWISE, RotationDirection.COUNTER_CLOCKWISE].sort()
    );
  });

  it("both ambiguous hands (dual dash + turns) fan out to 4 combos", () => {
    const opt = makeMotionOption(MotionType.DASH, MotionType.DASH);
    const variants = applyTurnsToOptionVariants(opt, 1, 1);
    expect(variants).toHaveLength(4);
    const combos = variants
      .map((v) => `${v.motions.blue!.rotationDirection}/${v.motions.red!.rotationDirection}`)
      .sort();
    expect(new Set(combos).size).toBe(4);
  });

  it("only the hand whose turns≥1 fans out", () => {
    // both dash, but only blue has turns → blue CW/CCW, red stays no-rotation
    const opt = makeMotionOption(MotionType.DASH, MotionType.DASH);
    const variants = applyTurnsToOptionVariants(opt, 1, 0);
    expect(variants).toHaveLength(2);
    expect(
      variants.every(
        (v) => v.motions.red!.rotationDirection === RotationDirection.NO_ROTATION
      )
    ).toBe(true);
  });
});
