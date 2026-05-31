/**
 * Example data for visibility settings previews.
 * Used by Pictograph, Animation, and Image panels to show live previews
 * of how visibility settings affect the displayed content.
 */

import { Letter } from "$lib/shared/foundation/domain/models/letter";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";

/** Example pictograph data showing Letter A with blue and red motions */
export const examplePictographData = {
  id: "visibility-preview",
  letter: Letter.A,
  startPosition: GridPosition.ALPHA1,
  endPosition: GridPosition.ALPHA3,
  gridMode: GridMode.DIAMOND,
  blueReversal: true,
  redReversal: true,
  motions: {
    blue: createMotionData({
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.WEST,
      turns: 1,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
      color: MotionColor.BLUE,
      isVisible: true,
      arrowLocation: GridLocation.WEST,
      gridMode: GridMode.DIAMOND,
    }),
    red: createMotionData({
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.EAST,
      turns: 1,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
      color: MotionColor.RED,
      isVisible: true,
      arrowLocation: GridLocation.EAST,
      gridMode: GridMode.DIAMOND,
    }),
  },
};

/** Example step data extending pictograph data with beat-specific properties */
export const exampleStepData: StepData = {
  ...examplePictographData,
  stepNumber: 1,
  duration: 1,
  isBlank: false,
};

/** Example sequence data for animation preview */
export const exampleSequenceData: SequenceData = {
  id: "visibility-preview-seq",
  name: "Preview",
  word: "A",
  steps: [exampleStepData],
  thumbnails: [],
  isFavorite: false,
  isCircular: false,
  tags: [],
  metadata: {},
};

/**
 * Example start position data derived from the example pictograph.
 * Shows the starting configuration (Alpha 1 - hands at opposite points: blue at south, red at north).
 * Used in the Image Export preview to show what the start position cell looks like.
 */
/** AABB sequence steps for Image Export preview */
export const aabbStepData: Array<{
  letter: Letter;
  blueMotion: Parameters<typeof createMotionData>[0];
  redMotion: Parameters<typeof createMotionData>[0];
  stepNumber: number;
}> = [
  {
    letter: Letter.A,
    stepNumber: 1,
    blueMotion: {
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.WEST,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      color: MotionColor.BLUE,
      isVisible: true,
      arrowLocation: GridLocation.WEST,
      gridMode: GridMode.DIAMOND,
    },
    redMotion: {
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.EAST,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      color: MotionColor.RED,
      isVisible: true,
      arrowLocation: GridLocation.EAST,
      gridMode: GridMode.DIAMOND,
    },
  },
  {
    letter: Letter.A,
    stepNumber: 2,
    blueMotion: {
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.WEST,
      endLocation: GridLocation.NORTH,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      color: MotionColor.BLUE,
      isVisible: true,
      arrowLocation: GridLocation.NORTH,
      gridMode: GridMode.DIAMOND,
    },
    redMotion: {
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.SOUTH,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      color: MotionColor.RED,
      isVisible: true,
      arrowLocation: GridLocation.SOUTH,
      gridMode: GridMode.DIAMOND,
    },
  },
  {
    letter: Letter.B,
    stepNumber: 3,
    blueMotion: {
      motionType: MotionType.ANTI,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.WEST,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
      color: MotionColor.BLUE,
      isVisible: true,
      arrowLocation: GridLocation.WEST,
      gridMode: GridMode.DIAMOND,
    },
    redMotion: {
      motionType: MotionType.ANTI,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.EAST,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
      color: MotionColor.RED,
      isVisible: true,
      arrowLocation: GridLocation.EAST,
      gridMode: GridMode.DIAMOND,
    },
  },
  {
    letter: Letter.B,
    stepNumber: 4,
    blueMotion: {
      motionType: MotionType.ANTI,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.WEST,
      endLocation: GridLocation.SOUTH,
      turns: 0,
      startOrientation: Orientation.OUT,
      endOrientation: Orientation.IN,
      color: MotionColor.BLUE,
      isVisible: true,
      arrowLocation: GridLocation.SOUTH,
      gridMode: GridMode.DIAMOND,
    },
    redMotion: {
      motionType: MotionType.ANTI,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.NORTH,
      turns: 0,
      startOrientation: Orientation.OUT,
      endOrientation: Orientation.IN,
      color: MotionColor.RED,
      isVisible: true,
      arrowLocation: GridLocation.NORTH,
      gridMode: GridMode.DIAMOND,
    },
  },
];

/** Convert aabbStepData to pictograph data objects for rendering */
export function getAabbPictographSteps() {
  return aabbStepData.map((step) => ({
    id: `aabb-step-${step.stepNumber}`,
    letter: step.letter,
    startPosition: GridPosition.ALPHA1,
    endPosition: GridPosition.ALPHA1,
    gridMode: GridMode.DIAMOND,
    stepNumber: step.stepNumber,
    motions: {
      blue: createMotionData(step.blueMotion),
      red: createMotionData(step.redMotion),
    },
  }));
}

/** AABB as a proper SequenceData for ChoreoCard rendering */
export function getAabbSequenceData(): SequenceData {
  const steps: StepData[] = aabbStepData.map((step) => ({
    id: `aabb-step-${step.stepNumber}`,
    letter: step.letter,
    startPosition: GridPosition.ALPHA1,
    endPosition: GridPosition.ALPHA1,
    gridMode: GridMode.DIAMOND,
    stepNumber: step.stepNumber,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      blue: createMotionData(step.blueMotion),
      red: createMotionData(step.redMotion),
    },
  }));

  return {
    id: "visibility-preview-aabb",
    name: "AABB",
    word: "AABB",
    steps,
    startPosition: exampleStartPositionData,
    thumbnails: [],
    isFavorite: false,
    isCircular: false,
    tags: [],
    metadata: {},
  };
}

export const exampleStartPositionData: StartPositionData = {
  isStartPosition: true,
  id: "visibility-preview-start",
  letter: Letter.ALPHA,
  startPosition: GridPosition.ALPHA1,
  endPosition: GridPosition.ALPHA1,
  gridPosition: GridPosition.ALPHA1,
  motions: {
    blue: createMotionData({
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.SOUTH,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      color: MotionColor.BLUE,
      isVisible: true,
      arrowLocation: GridLocation.SOUTH,
      gridMode: GridMode.DIAMOND,
    }),
    red: createMotionData({
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.NORTH,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      color: MotionColor.RED,
      isVisible: true,
      arrowLocation: GridLocation.NORTH,
      gridMode: GridMode.DIAMOND,
    }),
  },
};
