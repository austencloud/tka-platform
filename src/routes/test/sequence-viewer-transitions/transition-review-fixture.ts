import { createStartPositionData } from "$lib/shared/foundation/domain/factories/create-start-position-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  GridLocation,
  GridMode,
  GridPosition,
  type GridPosition as GridPositionValue,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  HandSide,
  MotionType,
  Orientation,
  RotationDirection,
  type MotionType as MotionTypeValue,
  type Orientation as OrientationValue,
  type RotationDirection as RotationDirectionValue,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";

interface CanonicalMotionInput {
  startLocation: (typeof GridLocation)[keyof typeof GridLocation];
  endLocation: (typeof GridLocation)[keyof typeof GridLocation];
  motionType: MotionTypeValue;
  rotationDirection: RotationDirectionValue;
  startOrientation: OrientationValue;
  endOrientation: OrientationValue;
}

interface CanonicalStepInput {
  letter: (typeof Letter)[keyof typeof Letter];
  startPosition: GridPositionValue;
  endPosition: GridPositionValue;
  variation: number;
  left: CanonicalMotionInput;
  right: CanonicalMotionInput;
}

function motion(
  color: (typeof HandSide)[keyof typeof HandSide],
  input: CanonicalMotionInput
): MotionData {
  return createMotionData({
    hand: color,
    ...input,
    arrowLocation: input.startLocation,
    gridMode: GridMode.DIAMOND,
    isVisible: true,
  });
}

const STATIC_EAST: CanonicalMotionInput = {
  startLocation: GridLocation.EAST,
  endLocation: GridLocation.EAST,
  motionType: MotionType.STATIC,
  rotationDirection: RotationDirection.NO_ROTATION,
  startOrientation: Orientation.IN,
  endOrientation: Orientation.IN,
};

const STATIC_WEST: CanonicalMotionInput = {
  ...STATIC_EAST,
  startLocation: GridLocation.WEST,
  endLocation: GridLocation.WEST,
};

// Generated from the Flow Arts Knowledge MCP with word ABCDEFGH and the smooth
// constraint preset. This review fixture keeps the A-E prefix plus every J
// bridge, so each end position is the following step's start position.
const CANONICAL_STEPS: readonly CanonicalStepInput[] = [
  {
    letter: Letter.A,
    startPosition: GridPosition.ALPHA7,
    endPosition: GridPosition.ALPHA1,
    variation: 2,
    left: {
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.SOUTH,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
    },
    right: {
      startLocation: GridLocation.WEST,
      endLocation: GridLocation.NORTH,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
    },
  },
  {
    letter: Letter.B,
    startPosition: GridPosition.ALPHA1,
    endPosition: GridPosition.ALPHA7,
    variation: 1,
    left: {
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.EAST,
      motionType: MotionType.ANTI,
      rotationDirection: RotationDirection.CLOCKWISE,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
    },
    right: {
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.WEST,
      motionType: MotionType.ANTI,
      rotationDirection: RotationDirection.CLOCKWISE,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
    },
  },
  {
    letter: Letter.C,
    startPosition: GridPosition.ALPHA7,
    endPosition: GridPosition.ALPHA5,
    variation: 3,
    left: {
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.NORTH,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
      startOrientation: Orientation.OUT,
      endOrientation: Orientation.OUT,
    },
    right: {
      startLocation: GridLocation.WEST,
      endLocation: GridLocation.SOUTH,
      motionType: MotionType.ANTI,
      rotationDirection: RotationDirection.CLOCKWISE,
      startOrientation: Orientation.OUT,
      endOrientation: Orientation.IN,
    },
  },
  {
    letter: Letter.J,
    startPosition: GridPosition.ALPHA5,
    endPosition: GridPosition.BETA7,
    variation: 0,
    left: {
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.WEST,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
      startOrientation: Orientation.OUT,
      endOrientation: Orientation.OUT,
    },
    right: {
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.WEST,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
    },
  },
  {
    letter: Letter.D,
    startPosition: GridPosition.BETA7,
    endPosition: GridPosition.ALPHA1,
    variation: 0,
    left: {
      startLocation: GridLocation.WEST,
      endLocation: GridLocation.SOUTH,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
      startOrientation: Orientation.OUT,
      endOrientation: Orientation.OUT,
    },
    right: {
      startLocation: GridLocation.WEST,
      endLocation: GridLocation.NORTH,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
    },
  },
  {
    letter: Letter.J,
    startPosition: GridPosition.ALPHA1,
    endPosition: GridPosition.BETA3,
    variation: 0,
    left: {
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.EAST,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
      startOrientation: Orientation.OUT,
      endOrientation: Orientation.OUT,
    },
    right: {
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.EAST,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
    },
  },
  {
    letter: Letter.E,
    startPosition: GridPosition.BETA3,
    endPosition: GridPosition.ALPHA5,
    variation: 0,
    left: {
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.NORTH,
      motionType: MotionType.ANTI,
      rotationDirection: RotationDirection.CLOCKWISE,
      startOrientation: Orientation.OUT,
      endOrientation: Orientation.IN,
    },
    right: {
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.SOUTH,
      motionType: MotionType.ANTI,
      rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
    },
  },
  {
    letter: Letter.J,
    startPosition: GridPosition.ALPHA5,
    endPosition: GridPosition.BETA3,
    variation: 1,
    left: {
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.EAST,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
    },
    right: {
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.EAST,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
      startOrientation: Orientation.OUT,
      endOrientation: Orientation.OUT,
    },
  },
];

const startPosition = createStartPositionData({
  id: "transition-review-start",
  letter: Letter.ALPHA,
  gridPosition: GridPosition.ALPHA7,
  startPosition: GridPosition.ALPHA7,
  endPosition: GridPosition.ALPHA7,
  motions: {
    left: motion(HandSide.LEFT, STATIC_EAST),
    right: motion(HandSide.RIGHT, STATIC_WEST),
  },
});

export const TRANSITION_REVIEW_SEQUENCE = createSequenceData({
  id: "sequence-viewer-transition-review",
  name: "Transition review",
  intendedWord: "ABCDE",
  word: "ABCJDJEJ",
  gridMode: GridMode.DIAMOND,
  startPosition,
  startingPosition: startPosition,
  steps: CANONICAL_STEPS.map((step, index) =>
    createStepData({
      id: `transition-review-step-${index + 1}`,
      stepNumber: index + 1,
      letter: step.letter,
      startPosition: step.startPosition,
      endPosition: step.endPosition,
      variation: step.variation,
      gridMode: GridMode.DIAMOND,
      duration: 1,
      motions: {
        left: motion(HandSide.LEFT, step.left),
        right: motion(HandSide.RIGHT, step.right),
      },
    })
  ),
});
