/**
 * Example data for visibility settings previews.
 * Used by Pictograph, Animation, and Image panels to show live previews
 * of how visibility settings affect the displayed content.
 */

import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

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

/** Example beat data extending pictograph data with beat-specific properties */
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
