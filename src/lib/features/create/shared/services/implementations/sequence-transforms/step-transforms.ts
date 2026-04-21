/**
 * Beat Transforms
 *
 * Pure functions that transform StepData objects.
 * Composes motion transforms with position updates.
 *
 * Supports targetHand parameter to transform only specific hand(s):
 * - "blue": Only transform blue motion
 * - "red": Only transform red motion
 * - "both": Transform both motions (default, original behavior)
 *
 * For single-hand transforms, positions and letters are kept unchanged
 * since they're derived from both hands and remain valid. This ensures
 * instant synchronous transforms for smooth CSS animations.
 */

import type { StepData } from "../../../domain/models/StepData";
import { createStepData } from "../../../domain/factories/createStepData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_POSITION_MAP,
  SWAPPED_POSITION_MAP,
} from "../../../../generate/circular/domain/constants/strict-loop-position-maps";
import {
  mirrorMotion,
  flipMotion,
  rotateMotion,
  swapMotionColor,
  invertMotion,
  rewindMotion,
} from "./motion-transforms";
import { getToggledGridMode } from "./rotation-helpers";
import type { TargetHand } from "../../../state/panel-coordination-state.svelte";

/**
 * Check if a specific hand should be transformed.
 */
function shouldTransformHand(
  hand: MotionColor,
  targetHand: TargetHand
): boolean {
  if (targetHand === "both") return true;
  if (targetHand === "blue" && hand === MotionColor.BLUE) return true;
  if (targetHand === "red" && hand === MotionColor.RED) return true;
  return false;
}

/**
 * Mirror a beat across the vertical axis (E ↔ W).
 * For single-hand transforms, keeps existing positions/letter for smooth animation.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function mirrorBeat(
  beat: StepData,
  gridMode: GridMode,
  positionDeriver: IGridPositionDeriver,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<StepData> {
  if (beat.isBlank || !beat) return beat;

  const mirroredMotions = { ...beat.motions };
  const willTransformBlue = shouldTransformHand(MotionColor.BLUE, targetHand);
  const willTransformRed = shouldTransformHand(MotionColor.RED, targetHand);

  const blueMotion = beat.motions[MotionColor.BLUE];
  const redMotion = beat.motions[MotionColor.RED];

  if (blueMotion && willTransformBlue) {
    mirroredMotions[MotionColor.BLUE] = mirrorMotion(blueMotion);
  }
  if (redMotion && willTransformRed) {
    mirroredMotions[MotionColor.RED] = mirrorMotion(redMotion);
  }

  // For "both" mode, use fast path with position maps (no lookup needed)
  if (targetHand === "both") {
    return createStepData({
      ...beat,
      startPosition: beat.startPosition
        ? VERTICAL_MIRROR_POSITION_MAP[beat.startPosition]
        : null,
      endPosition: beat.endPosition
        ? VERTICAL_MIRROR_POSITION_MAP[beat.endPosition]
        : null,
      motions: mirroredMotions,
    });
  }

  // For single-hand mode, keep existing positions and letter for instant animation
  // Positions are derived from both hands, so they stay valid when only one changes
  return createStepData({
    ...beat,
    motions: mirroredMotions,
  });
}

/**
 * Flip a beat across the horizontal axis (N ↔ S).
 * For single-hand transforms, keeps existing positions/letter for smooth animation.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function flipBeat(
  beat: StepData,
  gridMode: GridMode,
  positionDeriver: IGridPositionDeriver,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<StepData> {
  if (beat.isBlank || !beat) return beat;

  const flippedMotions = { ...beat.motions };
  const blueMotion = beat.motions[MotionColor.BLUE];
  const redMotion = beat.motions[MotionColor.RED];
  if (blueMotion && shouldTransformHand(MotionColor.BLUE, targetHand)) {
    flippedMotions[MotionColor.BLUE] = flipMotion(blueMotion);
  }
  if (redMotion && shouldTransformHand(MotionColor.RED, targetHand)) {
    flippedMotions[MotionColor.RED] = flipMotion(redMotion);
  }

  // For "both" mode, use fast path with position maps (no lookup needed)
  if (targetHand === "both") {
    return createStepData({
      ...beat,
      startPosition: beat.startPosition
        ? HORIZONTAL_MIRROR_POSITION_MAP[beat.startPosition]
        : null,
      endPosition: beat.endPosition
        ? HORIZONTAL_MIRROR_POSITION_MAP[beat.endPosition]
        : null,
      motions: flippedMotions,
    });
  }

  // For single-hand mode, keep existing positions and letter for instant animation
  // Positions are derived from both hands, so they stay valid when only one changes
  return createStepData({
    ...beat,
    motions: flippedMotions,
  });
}

/**
 * Rotate a beat by 45° steps.
 * For both-hand transforms, derives new positions from rotated locations.
 * For single-hand transforms, keeps existing positions/letter for smooth animation.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function rotateBeat(
  beat: StepData,
  rotationAmount: number,
  gridMode: GridMode,
  positionDeriver: IGridPositionDeriver,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<StepData> {
  if (beat.isBlank || !beat) return beat;

  const currentGridMode =
    beat.motions[MotionColor.BLUE]?.gridMode ?? GridMode.DIAMOND;
  // Note: newGridMode is calculated but not used - positions are derived from motion locations
  void getToggledGridMode(currentGridMode, rotationAmount);

  const rotatedMotions = { ...beat.motions };
  const beatBlue = beat.motions[MotionColor.BLUE];
  const beatRed = beat.motions[MotionColor.RED];
  if (beatBlue && shouldTransformHand(MotionColor.BLUE, targetHand)) {
    rotatedMotions[MotionColor.BLUE] = rotateMotion(beatBlue, rotationAmount);
  }
  if (beatRed && shouldTransformHand(MotionColor.RED, targetHand)) {
    rotatedMotions[MotionColor.RED] = rotateMotion(beatRed, rotationAmount);
  }

  const blueMotion = rotatedMotions[MotionColor.BLUE];
  const redMotion = rotatedMotions[MotionColor.RED];

  // For "both" mode, derive positions from rotated locations (no letter lookup needed)
  if (targetHand === "both") {
    let rotatedStartPosition = beat.startPosition ?? null;
    let rotatedEndPosition = beat.endPosition ?? null;

    if (blueMotion && redMotion) {
      rotatedStartPosition = positionDeriver.getGridPositionFromLocations(
        blueMotion.startLocation,
        redMotion.startLocation
      );
      rotatedEndPosition = positionDeriver.getGridPositionFromLocations(
        blueMotion.endLocation,
        redMotion.endLocation
      );
    }

    return createStepData({
      ...beat,
      startPosition: rotatedStartPosition,
      endPosition: rotatedEndPosition,
      motions: rotatedMotions,
    });
  }

  // For single-hand mode, keep existing positions and letter for instant animation
  // Positions are derived from both hands, so they stay valid when only one changes
  return createStepData({
    ...beat,
    motions: rotatedMotions,
  });
}

/**
 * Swap colors in a beat (blue ↔ red).
 */
export function colorSwapBeat(beat: StepData): StepData {
  if (beat.isBlank || !beat) return beat;

  const beatBlue = beat.motions[MotionColor.BLUE];
  const beatRed = beat.motions[MotionColor.RED];
  const swappedMotions = {
    [MotionColor.BLUE]: beatRed
      ? swapMotionColor(beatRed, MotionColor.BLUE)
      : undefined,
    [MotionColor.RED]: beatBlue
      ? swapMotionColor(beatBlue, MotionColor.RED)
      : undefined,
  };

  return createStepData({
    ...beat,
    startPosition: beat.startPosition
      ? SWAPPED_POSITION_MAP[beat.startPosition]
      : null,
    endPosition: beat.endPosition
      ? SWAPPED_POSITION_MAP[beat.endPosition]
      : null,
    motions: swappedMotions,
    blueReversal: beat.redReversal,
    redReversal: beat.blueReversal,
  });
}

/**
 * Invert a beat's motion types (PRO ↔ ANTI) and rotation directions (CW ↔ CCW).
 * For both-hand transforms, looks up correct letter from dataset.
 * For single-hand transforms, keeps existing letter for smooth animation.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function invertBeat(
  beat: StepData,
  gridMode: GridMode,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<StepData> {
  if (beat.isBlank || !beat) return beat;

  const invertedMotions = { ...beat.motions };
  const beatBlue = beat.motions[MotionColor.BLUE];
  const beatRed = beat.motions[MotionColor.RED];
  if (beatBlue && shouldTransformHand(MotionColor.BLUE, targetHand)) {
    invertedMotions[MotionColor.BLUE] = invertMotion(beatBlue);
  }
  if (beatRed && shouldTransformHand(MotionColor.RED, targetHand)) {
    invertedMotions[MotionColor.RED] = invertMotion(beatRed);
  }

  // For single-hand mode, keep existing letter for instant animation
  if (targetHand !== "both") {
    return createStepData({
      ...beat,
      motions: invertedMotions,
    });
  }

  // Look up correct letter from dataset (only when both hands transformed)
  let correctLetter: Letter | null = beat.letter ?? null;
  const invertedBlue = invertedMotions[MotionColor.BLUE];
  const invertedRed = invertedMotions[MotionColor.RED];
  if (invertedBlue && invertedRed) {
    try {
      const foundLetter =
        await motionQueryHandler.findLetterByMotionConfiguration(
          invertedBlue,
          invertedRed,
          gridMode
        );
      if (foundLetter) {
        correctLetter = foundLetter as Letter;
      }
    } catch (error) {
      console.warn(
        `Failed to find letter for inverted beat ${beat.stepNumber}:`,
        error
      );
    }
  }

  return createStepData({
    ...beat,
    letter: correctLetter,
    motions: invertedMotions,
  });
}

/**
 * Rewind a beat (swap start/end, flip rotation).
 * For both-hand transforms, swaps positions and looks up correct letter.
 * For single-hand transforms, keeps existing positions/letter for smooth animation.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function rewindBeat(
  beat: StepData,
  newStepNumber: number,
  gridMode: GridMode,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<StepData> {
  if (beat.isBlank || !beat) {
    return { ...beat, stepNumber: newStepNumber };
  }

  const rewindMotions = { ...beat.motions };
  const beatBlue = beat.motions[MotionColor.BLUE];
  const beatRed = beat.motions[MotionColor.RED];
  if (beatBlue && shouldTransformHand(MotionColor.BLUE, targetHand)) {
    rewindMotions[MotionColor.BLUE] = rewindMotion(beatBlue);
  }
  if (beatRed && shouldTransformHand(MotionColor.RED, targetHand)) {
    rewindMotions[MotionColor.RED] = rewindMotion(beatRed);
  }

  // For single-hand mode, keep existing positions and letter for instant animation
  if (targetHand !== "both") {
    return createStepData({
      ...beat,
      stepNumber: newStepNumber,
      motions: rewindMotions,
      // Clear reversal flags - they must be recalculated based on the new sequence order
      blueReversal: false,
      redReversal: false,
    });
  }

  // Look up correct letter from dataset (only when both hands transformed)
  let correctLetter: Letter | null = beat.letter ?? null;
  const rewoundBlue = rewindMotions[MotionColor.BLUE];
  const rewoundRed = rewindMotions[MotionColor.RED];
  if (rewoundBlue && rewoundRed) {
    try {
      const foundLetter =
        await motionQueryHandler.findLetterByMotionConfiguration(
          rewoundBlue,
          rewoundRed,
          gridMode
        );
      if (foundLetter) {
        correctLetter = foundLetter as Letter;
      }
    } catch (error) {
      console.error(`Error looking up letter for rewound beat:`, error);
    }
  }

  return createStepData({
    ...beat,
    stepNumber: newStepNumber,
    startPosition: beat.endPosition ?? null,
    endPosition: beat.startPosition ?? null,
    motions: rewindMotions,
    letter: correctLetter,
    // Clear reversal flags - they must be recalculated based on the new sequence order
    blueReversal: false,
    redReversal: false,
  });
}
