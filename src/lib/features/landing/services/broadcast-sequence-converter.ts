/**
 * Broadcast Sequence Converter
 *
 * Transforms broadcast data formats (from the live broadcast system) into
 * internal sequence formats used by the animation engine.
 */

import type { BroadcastSequence, BroadcastStepData } from "$lib/shared/landing/domain/broadcast-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { GridPosition, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  MotionType,
  RotationDirection} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  MotionColor,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";

export function convertBeat(beat: BroadcastStepData, index: number): StepData {
  const gridMode = GridMode.DIAMOND; // Default for broadcast sequences

  return {
    id: beat.id,
    letter: beat.letter as StepData["letter"],
    startPosition: beat.startPosition as GridPosition,
    endPosition: beat.endPosition as GridPosition,
    motions: {
      blue: createMotionData({
        motionType: beat.blue.motionType as MotionType,
        rotationDirection: beat.blue.rotationDirection as RotationDirection,
        startLocation: beat.blue.startLocation as GridLocation,
        endLocation: beat.blue.endLocation as GridLocation,
        startOrientation: (beat.blue.startOrientation as Orientation) ?? Orientation.IN,
        endOrientation: (beat.blue.endOrientation as Orientation) ?? Orientation.IN,
        color: MotionColor.BLUE,
        gridMode,
      }),
      red: createMotionData({
        motionType: beat.red.motionType as MotionType,
        rotationDirection: beat.red.rotationDirection as RotationDirection,
        startLocation: beat.red.startLocation as GridLocation,
        endLocation: beat.red.endLocation as GridLocation,
        startOrientation: (beat.red.startOrientation as Orientation) ?? Orientation.IN,
        endOrientation: (beat.red.endOrientation as Orientation) ?? Orientation.IN,
        color: MotionColor.RED,
        gridMode,
      }),
    },
    stepNumber: beat.stepNumber ?? index + 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
  };
}

export function convertSequence(broadcast: BroadcastSequence): SequenceData {
  // First beat is start position (beat 0), rest are actual steps
  const startStep = broadcast.steps[0];
  const actualSteps = broadcast.steps.slice(1);
  const gridMode = (broadcast.gridMode as GridMode) ?? GridMode.DIAMOND;

  const startPosition: StartPositionData | undefined = startStep
    ? {
        isStartPosition: true as const,
        id: startStep.id,
        letter: startStep.letter as StartPositionData["letter"],
        startPosition: startStep.startPosition as GridPosition,
        endPosition: startStep.endPosition as GridPosition,
        motions: {
          blue: createMotionData({
            motionType: startStep.blue.motionType as MotionType,
            rotationDirection: startStep.blue.rotationDirection as RotationDirection,
            startLocation: startStep.blue.startLocation as GridLocation,
            endLocation: startStep.blue.endLocation as GridLocation,
            startOrientation: (startStep.blue.startOrientation as Orientation) ?? Orientation.IN,
            endOrientation: (startStep.blue.endOrientation as Orientation) ?? Orientation.IN,
            color: MotionColor.BLUE,
            gridMode,
          }),
          red: createMotionData({
            motionType: startStep.red.motionType as MotionType,
            rotationDirection: startStep.red.rotationDirection as RotationDirection,
            startLocation: startStep.red.startLocation as GridLocation,
            endLocation: startStep.red.endLocation as GridLocation,
            startOrientation: (startStep.red.startOrientation as Orientation) ?? Orientation.IN,
            endOrientation: (startStep.red.endOrientation as Orientation) ?? Orientation.IN,
            color: MotionColor.RED,
            gridMode,
          }),
        },
      }
    : undefined;

  return {
    id: broadcast.id,
    name: broadcast.word,
    word: broadcast.word,
    steps: actualSteps.map((b, i) => convertBeat(b, i)),
    startPosition,
    thumbnails: [],
    isFavorite: false,
    isCircular: broadcast.isCircular,
    loopType: broadcast.loopType,
    gridMode,
    tags: [],
    metadata: {},
  };
}
