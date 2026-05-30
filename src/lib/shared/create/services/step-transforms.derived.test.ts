import { describe, it, expect } from "vitest";
import { rotateBeat } from "./step-transforms";
import { createStepData } from "$lib/shared/create/factories/createStepData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";

const queryStub = {
  findLetterByMotionConfiguration: async () => null,
} as unknown as IMotionQueryHandler;

describe("single-hand rotateBeat reconciles positions", () => {
  it("recomputes startPosition from the rotated blue location (no longer stale)", async () => {
    const s = createStepData({
      stepNumber: 1,
      motions: {
        [MotionColor.BLUE]: createMotionData({
          color: MotionColor.BLUE,
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.NORTH,
          endLocation: GridLocation.EAST,
        }),
        [MotionColor.RED]: createMotionData({
          color: MotionColor.RED,
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
          startLocation: GridLocation.SOUTH,
          endLocation: GridLocation.WEST,
        }),
      },
    });

    // Rotate ONLY blue by 1 step (45° CW) — positions must reflect the new pair.
    const out = await rotateBeat(s, 1, GridMode.DIAMOND, queryStub, "blue");

    const blue = out.motions[MotionColor.BLUE]!;
    const red = out.motions[MotionColor.RED]!;
    expect(out.startPosition).toBe(
      getGridPositionFromLocations(blue.startLocation, red.startLocation)
    );
    expect(out.endPosition).toBe(
      getGridPositionFromLocations(blue.endLocation, red.endLocation)
    );
  });
});
