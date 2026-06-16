import { describe, it, expect } from "vitest";
import { countDirectionReversals } from "./reversal-checker";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

function step(blueDir: RotationDirection, redDir = RotationDirection.NO_ROTATION): PictographData {
  return {
    letter: "X",
    motions: {
      blue: createMotionData({
        motionType: MotionType.DASH,
        rotationDirection: blueDir,
        turns: blueDir === RotationDirection.NO_ROTATION ? 0 : 2,
      }),
      red: createMotionData({
        motionType: MotionType.DASH,
        rotationDirection: redDir,
        turns: redDir === RotationDirection.NO_ROTATION ? 0 : 2,
      }),
    },
  } as unknown as PictographData;
}

describe("countDirectionReversals", () => {
  it("is 0 when there is no prior rotation context", () => {
    const option = step(RotationDirection.CLOCKWISE);
    expect(countDirectionReversals(option, [])).toBe(0);
  });

  it("is 0 when the spin direction continues the previous step", () => {
    const prev = step(RotationDirection.CLOCKWISE);
    const option = step(RotationDirection.CLOCKWISE);
    expect(countDirectionReversals(option, [prev])).toBe(0);
  });

  it("is 1 when the spin direction opposes the previous step (a reversal)", () => {
    const prev = step(RotationDirection.CLOCKWISE);
    const option = step(RotationDirection.COUNTER_CLOCKWISE);
    expect(countDirectionReversals(option, [prev])).toBe(1);
  });

  it("ignores turn magnitude — high turns alone are not a direction reversal", () => {
    // Both spin CW, but at 2 turns. The turns>1 heuristic in getReversalCount
    // would flag this; countDirectionReversals must not.
    const prev = step(RotationDirection.CLOCKWISE);
    const option = step(RotationDirection.CLOCKWISE);
    expect(countDirectionReversals(option, [prev])).toBe(0);
  });
});
