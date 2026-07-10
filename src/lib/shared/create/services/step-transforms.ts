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
 * For single-hand transforms, positions are recomputed from both hands via
 * reconcileStepDerived (a position is a function of BOTH locations). Letters are
 * reconciled asynchronously by the calling sequence-transform operation.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import { reconcileStepDerived } from "$lib/shared/create/services/sequence-derived-fields";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_POSITION_MAP,
  SWAPPED_POSITION_MAP,
} from "$lib/shared/create/domain/strict-loop-position-maps";
import {
  mirrorMotion,
  flipMotion,
  rotateMotion,
  swapMotionColor,
  invertMotion,
  rewindMotion,
} from "$lib/shared/create/services/motion-transforms";
import { getToggledGridMode } from "$lib/shared/create/services/rotation-helpers";
import type { TargetHand } from "$lib/shared/create/state/panel-coordination-state.svelte";

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
  step: StepData,
  gridMode: GridMode,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<StepData> {
  if (step.isBlank || !step) return step;

  const mirroredMotions = { ...step.motions };
  const willTransformBlue = shouldTransformHand(MotionColor.BLUE, targetHand);
  const willTransformRed = shouldTransformHand(MotionColor.RED, targetHand);

  const blueMotion = step.motions[MotionColor.BLUE];
  const redMotion = step.motions[MotionColor.RED];

  if (blueMotion && willTransformBlue) {
    mirroredMotions[MotionColor.BLUE] = mirrorMotion(blueMotion);
  }
  if (redMotion && willTransformRed) {
    mirroredMotions[MotionColor.RED] = mirrorMotion(redMotion);
  }

  // For "both" mode, use fast path with position maps (no lookup needed)
  if (targetHand === "both") {
    return createStepData({
      ...step,
      startPosition: step.startPosition
        ? VERTICAL_MIRROR_POSITION_MAP[step.startPosition]
        : null,
      endPosition: step.endPosition
        ? VERTICAL_MIRROR_POSITION_MAP[step.endPosition]
        : null,
      motions: mirroredMotions,
    });
  }

  // Single-hand: positions depend on BOTH locations, so recompute them from the
  // mutated motions. Letter is reconciled asynchronously by the caller.
  return reconcileStepDerived(
    createStepData({
      ...step,
      motions: mirroredMotions,
    })
  );
}

/**
 * Flip a beat across the horizontal axis (N ↔ S).
 * For single-hand transforms, keeps existing positions/letter for smooth animation.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function flipBeat(
  step: StepData,
  gridMode: GridMode,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<StepData> {
  if (step.isBlank || !step) return step;

  const flippedMotions = { ...step.motions };
  const blueMotion = step.motions[MotionColor.BLUE];
  const redMotion = step.motions[MotionColor.RED];
  if (blueMotion && shouldTransformHand(MotionColor.BLUE, targetHand)) {
    flippedMotions[MotionColor.BLUE] = flipMotion(blueMotion);
  }
  if (redMotion && shouldTransformHand(MotionColor.RED, targetHand)) {
    flippedMotions[MotionColor.RED] = flipMotion(redMotion);
  }

  // For "both" mode, use fast path with position maps (no lookup needed)
  if (targetHand === "both") {
    return createStepData({
      ...step,
      startPosition: step.startPosition
        ? HORIZONTAL_MIRROR_POSITION_MAP[step.startPosition]
        : null,
      endPosition: step.endPosition
        ? HORIZONTAL_MIRROR_POSITION_MAP[step.endPosition]
        : null,
      motions: flippedMotions,
    });
  }

  // Single-hand: recompute positions from the mutated motions (letter is async).
  return reconcileStepDerived(
    createStepData({
      ...step,
      motions: flippedMotions,
    })
  );
}

/**
 * Rotate a beat by 45° steps.
 * For both-hand transforms, derives new positions from rotated locations.
 * For single-hand transforms, keeps existing positions/letter for smooth animation.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function rotateBeat(
  step: StepData,
  rotationAmount: number,
  gridMode: GridMode,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<StepData> {
  if (step.isBlank || !step) return step;

  const currentGridMode =
    step.motions[MotionColor.BLUE]?.gridMode ?? GridMode.DIAMOND;
  // Note: newGridMode is calculated but not used - positions are derived from motion locations
  void getToggledGridMode(currentGridMode, rotationAmount);

  const rotatedMotions = { ...step.motions };
  const stepBlue = step.motions[MotionColor.BLUE];
  const stepRed = step.motions[MotionColor.RED];
  if (stepBlue && shouldTransformHand(MotionColor.BLUE, targetHand)) {
    rotatedMotions[MotionColor.BLUE] = rotateMotion(stepBlue, rotationAmount);
  }
  if (stepRed && shouldTransformHand(MotionColor.RED, targetHand)) {
    rotatedMotions[MotionColor.RED] = rotateMotion(stepRed, rotationAmount);
  }

  const blueMotion = rotatedMotions[MotionColor.BLUE];
  const redMotion = rotatedMotions[MotionColor.RED];

  // For "both" mode, derive positions from rotated locations (no letter lookup needed)
  if (targetHand === "both") {
    let rotatedStartPosition = step.startPosition ?? null;
    let rotatedEndPosition = step.endPosition ?? null;

    // Invisible placeholder = hand not really there (both-required Step
    // shape): keep the stale-position behavior the old absent-hand path had.
    if (isVisibleMotion(blueMotion) && isVisibleMotion(redMotion)) {
      rotatedStartPosition = getGridPositionFromLocations(
        blueMotion.startLocation,
        redMotion.startLocation
      );
      rotatedEndPosition = getGridPositionFromLocations(
        blueMotion.endLocation,
        redMotion.endLocation
      );
    }

    return createStepData({
      ...step,
      startPosition: rotatedStartPosition,
      endPosition: rotatedEndPosition,
      motions: rotatedMotions,
    });
  }

  // Single-hand: recompute positions from the rotated motions (letter is async).
  return reconcileStepDerived(
    createStepData({
      ...step,
      motions: rotatedMotions,
    })
  );
}

/**
 * Swap colors in a beat (blue ↔ red).
 */
export function colorSwapBeat(step: StepData): StepData {
  if (step.isBlank || !step) return step;

  const stepBlue = step.motions[MotionColor.BLUE];
  const stepRed = step.motions[MotionColor.RED];
  const swappedMotions = {
    [MotionColor.BLUE]: stepRed
      ? swapMotionColor(stepRed, MotionColor.BLUE)
      : undefined,
    [MotionColor.RED]: stepBlue
      ? swapMotionColor(stepBlue, MotionColor.RED)
      : undefined,
  };

  return createStepData({
    ...step,
    startPosition: step.startPosition
      ? SWAPPED_POSITION_MAP[step.startPosition]
      : null,
    endPosition: step.endPosition
      ? SWAPPED_POSITION_MAP[step.endPosition]
      : null,
    motions: swappedMotions,
    blueReversal: step.redReversal,
    redReversal: step.blueReversal,
  });
}

/**
 * Invert a beat's motion types (PRO ↔ ANTI) and rotation directions (CW ↔ CCW).
 * For both-hand transforms, looks up correct letter from dataset.
 * For single-hand transforms, keeps existing letter for smooth animation.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function invertBeat(
  step: StepData,
  gridMode: GridMode,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<StepData> {
  if (step.isBlank || !step) return step;

  const invertedMotions = { ...step.motions };
  const stepBlue = step.motions[MotionColor.BLUE];
  const stepRed = step.motions[MotionColor.RED];
  if (stepBlue && shouldTransformHand(MotionColor.BLUE, targetHand)) {
    invertedMotions[MotionColor.BLUE] = invertMotion(stepBlue);
  }
  if (stepRed && shouldTransformHand(MotionColor.RED, targetHand)) {
    invertedMotions[MotionColor.RED] = invertMotion(stepRed);
  }

  // For single-hand mode, keep existing letter for instant animation
  if (targetHand !== "both") {
    return createStepData({
      ...step,
      motions: invertedMotions,
    });
  }

  // Look up correct letter from dataset (only when both hands transformed)
  let correctLetter: Letter | null = step.letter ?? null;
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
        `Failed to find letter for inverted step ${step.stepNumber}:`,
        error
      );
    }
  }

  return createStepData({
    ...step,
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
  step: StepData,
  newStepNumber: number,
  gridMode: GridMode,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<StepData> {
  if (step.isBlank || !step) {
    return { ...step, stepNumber: newStepNumber };
  }

  const rewindMotions = { ...step.motions };
  const stepBlue = step.motions[MotionColor.BLUE];
  const stepRed = step.motions[MotionColor.RED];
  if (stepBlue && shouldTransformHand(MotionColor.BLUE, targetHand)) {
    rewindMotions[MotionColor.BLUE] = rewindMotion(stepBlue);
  }
  if (stepRed && shouldTransformHand(MotionColor.RED, targetHand)) {
    rewindMotions[MotionColor.RED] = rewindMotion(stepRed);
  }

  // For single-hand mode, keep existing positions and letter for instant animation
  if (targetHand !== "both") {
    return createStepData({
      ...step,
      stepNumber: newStepNumber,
      motions: rewindMotions,
      // Clear reversal flags - they must be recalculated based on the new sequence order
      blueReversal: false,
      redReversal: false,
    });
  }

  // Look up correct letter from dataset (only when both hands transformed)
  let correctLetter: Letter | null = step.letter ?? null;
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
      console.error(`Error looking up letter for rewound step:`, error);
    }
  }

  return createStepData({
    ...step,
    stepNumber: newStepNumber,
    startPosition: step.endPosition ?? null,
    endPosition: step.startPosition ?? null,
    motions: rewindMotions,
    letter: correctLetter,
    // Clear reversal flags - they must be recalculated based on the new sequence order
    blueReversal: false,
    redReversal: false,
  });
}
