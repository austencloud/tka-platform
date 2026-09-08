import { describe, expect, it } from "vitest";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  HandSide,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { calculatePictographMotionPositions } from "$lib/shared/pictograph/prop/services/pictograph-motion-positioner";

const step = createStepData({
  id: "arrival-motion-step",
  letter: "A",
  stepNumber: 1,
  gridMode: GridMode.DIAMOND,
  motions: {
    left: createMotionData({
      hand: HandSide.LEFT,
      motionType: MotionType.DASH,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.WEST,
      endLocation: GridLocation.EAST,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      turns: 1,
      propType: PropType.STAFF,
      isVisible: true,
    }),
    right: createMotionData({
      hand: HandSide.RIGHT,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.NORTH,
      startOrientation: Orientation.OUT,
      endOrientation: Orientation.OUT,
      turns: 1,
      propType: PropType.STAFF,
      isVisible: true,
    }),
  },
});

const startPositions = {
  left: { x: 327.4, y: 480.2, rotation: 180 },
  right: { x: 478.8, y: 622.6, rotation: 0 },
};

const endPositions = {
  left: { x: 622.9, y: 471.7, rotation: 0 },
  right: { x: 470.5, y: 326.4, rotation: 180 },
};

describe("calculatePictographMotionPositions", () => {
  it("uses the prepared pictographs as exact start and end frames", () => {
    const common = {
      step,
      gridMode: GridMode.DIAMOND,
      leftPropType: PropType.STAFF,
      rightPropType: PropType.STAFF,
      startPositions,
      endPositions,
    };

    expect(
      calculatePictographMotionPositions({ ...common, progress: 0 })
    ).toEqual(startPositions);
    expect(
      calculatePictographMotionPositions({ ...common, progress: 1 })
    ).toEqual(endPositions);
  });

  it("moves through the animation path instead of jumping between endpoints", () => {
    const midpoint = calculatePictographMotionPositions({
      step,
      progress: 0.5,
      gridMode: GridMode.DIAMOND,
      leftPropType: PropType.STAFF,
      rightPropType: PropType.STAFF,
      startPositions,
      endPositions,
    });

    expect(midpoint.left?.x).toBeGreaterThan(startPositions.left.x);
    expect(midpoint.left?.x).toBeLessThan(endPositions.left.x);
    expect(midpoint.left?.y).toBeCloseTo(475.95, 0);
    expect(midpoint.right?.y).toBeLessThan(startPositions.right.y);
    expect(midpoint.right?.y).toBeGreaterThan(endPositions.right.y);
  });
});
