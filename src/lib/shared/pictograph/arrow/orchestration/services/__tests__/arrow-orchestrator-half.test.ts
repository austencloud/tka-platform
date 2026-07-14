import { describe, it, expect } from "vitest";
import { calculateArrowPoint } from "$lib/shared/pictograph/arrow/orchestration/services/arrow-positioning-orchestrator";
import { calculateSegmentRotation } from "$lib/shared/pictograph/arrow/positioning/calculation/services/segment-rotation";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

const HALF = { t0: 0, t1: 0.5 };

function segmentPictograph() {
  const motion = createMotionData({
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    startLocation: GridLocation.EAST,
    endLocation: GridLocation.SOUTHEAST,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.CLOCK,
    turns: 1,
    color: MotionColor.RED,
    segment: HALF,
  });
  const picto = {
    letter: null,
    gridMode: motion.gridMode,
    motions: { red: motion, blue: undefined },
  } as unknown as PictographData;
  return { picto, motion };
}

describe("orchestrator — segment frames bypass the letter-adjustment machinery", () => {
  it("positions a letterless half-frame with a {0,0} adjustment (no letter-A tiers)", async () => {
    const { picto, motion } = segmentPictograph();
    const [x, y, rotation] = await calculateArrowPoint(picto, motion);
    expect(rotation).toBeCloseTo(
      calculateSegmentRotation(Orientation.CLOCK, GridLocation.SOUTHEAST, GridLocation.EAST),
      6
    );
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});
