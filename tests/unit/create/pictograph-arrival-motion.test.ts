import { describe, expect, it } from "vitest";
import {
  getPictographArrivalPropMotionDurationMs,
  PICTOGRAPH_ARRIVAL_PROP_MOTION_MAX_MS,
  PICTOGRAPH_ARRIVAL_PROP_MOTION_MIN_MS,
} from "$lib/features/create/shared/workspace-panel/sequence-display/domain/pictograph-arrival-motion";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";

function staticSpin(color: MotionColor, turns: number) {
  return createMotionData({
    color,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns,
  });
}

describe("pictograph arrival prop timing", () => {
  it("keeps ordinary motions on the readable 850ms floor", () => {
    const step = createStepData({
      motions: {
        blue: staticSpin(MotionColor.BLUE, 1),
        red: staticSpin(MotionColor.RED, 0),
      },
    });

    expect(getPictographArrivalPropMotionDurationMs(step)).toBe(
      PICTOGRAPH_ARRIVAL_PROP_MOTION_MIN_MS
    );
  });

  it("extends the shared clock for the prop with the larger effective rotation", () => {
    const step = createStepData({
      motions: {
        blue: staticSpin(MotionColor.BLUE, 2),
        red: staticSpin(MotionColor.RED, 3),
      },
    });

    expect(getPictographArrivalPropMotionDurationMs(step)).toBe(1500);
  });

  it("includes a shift's base rotation instead of timing from turns alone", () => {
    const step = createStepData({
      motions: {
        blue: createMotionData({
          color: MotionColor.BLUE,
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.NORTH,
          endLocation: GridLocation.EAST,
          turns: 3,
        }),
      },
    });

    expect(getPictographArrivalPropMotionDurationMs(step)).toBe(1750);
  });

  it("caps extreme imported motion data at two seconds", () => {
    const step = createStepData({
      motions: { blue: staticSpin(MotionColor.BLUE, 10) },
    });

    expect(getPictographArrivalPropMotionDurationMs(step)).toBe(
      PICTOGRAPH_ARRIVAL_PROP_MOTION_MAX_MS
    );
  });
});
