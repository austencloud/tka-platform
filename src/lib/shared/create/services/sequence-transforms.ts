/**
 * Sequence Transforms
 *
 * Pure functions that transform entire SequenceData objects.
 * Composes beat and start position transforms.
 *
 * Supports targetHand parameter to transform only specific hand(s):
 * - "blue": Only transform blue motion
 * - "red": Only transform red motion
 * - "both": Transform both motions (default, original behavior)
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  updateSequenceData,
  createSequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import { createStepData } from "$lib/shared/create/factories/create-step-data";
import { createStartPositionData } from "$lib/shared/create/factories/create-start-position-data";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";

import {
  mirrorBeat,
  flipBeat,
  rotateBeat,
  colorSwapBeat,
  invertBeat,
  rewindBeat,
} from "$lib/shared/create/services/step-transforms";
import { rewindMotion } from "$lib/shared/create/services/motion-transforms";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import {
  mirrorStartPosition,
  flipStartPosition,
  rotateStartPosition,
  colorSwapStartPosition,
  invertStartPosition,
} from "$lib/shared/create/services/start-position-transforms";
import { recalculateAllOrientations } from "$lib/shared/create/services/orientation-propagation";
import { getToggledGridMode } from "$lib/shared/create/services/rotation-helpers";
import type { TargetHand } from "$lib/shared/create/state/panel-coordination-state.svelte";

/**
 * Clear all steps in a sequence (make them blank).
 */
export function clearSequence(sequence: SequenceData): SequenceData {
  const clearedBeats = sequence.steps.map((step) => ({
    ...step,
    isBlank: true,
    pictographData: null,
    blueReversal: false,
    redReversal: false,
  }));

  return updateSequenceData(sequence, { steps: clearedBeats });
}

/**
 * Duplicate a sequence with new IDs.
 */
export function duplicateSequence(
  sequence: SequenceData,
  newName?: string
): SequenceData {
  return createSequenceData({
    ...sequence,
    id: crypto.randomUUID(),
    name: newName || `${sequence.name} (Copy)`,
    steps: sequence.steps.map((step) => ({
      ...step,
      id: crypto.randomUUID(),
    })),
  });
}

/**
 * Mirror sequence across vertical axis (E ↔ W).
 * For single-hand transforms, derives new positions and looks up new letters.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function mirrorSequence(
  sequence: SequenceData,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  const gridMode = sequence.gridMode ?? GridMode.DIAMOND;

  const mirroredBeats = await Promise.all(
    sequence.steps.map((step) =>
      mirrorBeat(step, gridMode, motionQueryHandler, targetHand)
    )
  );

  // Transform start positions (always StartPositionData, never StepData)
  const mirroredStartPosition = sequence.startPosition
    ? mirrorStartPosition(sequence.startPosition, targetHand)
    : undefined;

  const mirroredStartingPositionStep = sequence.startingPosition
    ? mirrorStartPosition(sequence.startingPosition, targetHand)
    : undefined;

  return updateSequenceData(sequence, {
    steps: mirroredBeats,
    ...(mirroredStartPosition && { startPosition: mirroredStartPosition }),
    ...(mirroredStartingPositionStep && {
      startingPosition: mirroredStartingPositionStep,
    }),
  });
}

/**
 * Flip sequence across horizontal axis (N ↔ S).
 * For single-hand transforms, derives new positions and looks up new letters.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function flipSequence(
  sequence: SequenceData,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  const gridMode = sequence.gridMode ?? GridMode.DIAMOND;

  const flippedBeats = await Promise.all(
    sequence.steps.map((step) =>
      flipBeat(step, gridMode, motionQueryHandler, targetHand)
    )
  );

  // Transform start positions (always StartPositionData, never StepData)
  const flippedStartPosition = sequence.startPosition
    ? flipStartPosition(sequence.startPosition, targetHand)
    : undefined;

  const flippedStartingPositionStep = sequence.startingPosition
    ? flipStartPosition(sequence.startingPosition, targetHand)
    : undefined;

  return updateSequenceData(sequence, {
    steps: flippedBeats,
    ...(flippedStartPosition && { startPosition: flippedStartPosition }),
    ...(flippedStartingPositionStep && {
      startingPosition: flippedStartingPositionStep,
    }),
  });
}

/**
 * Rotate sequence by 45° steps.
 * For single-hand transforms, also looks up new letters.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function rotateSequence(
  sequence: SequenceData,
  rotationAmount: number,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  const gridMode = sequence.gridMode ?? GridMode.DIAMOND;

  const rotatedBeats = await Promise.all(
    sequence.steps.map((step) =>
      rotateBeat(
        step,
        rotationAmount,
        gridMode,
        motionQueryHandler,
        targetHand
      )
    )
  );

  // Transform start positions (always StartPositionData, never StepData)
  const rotatedStartPosition = sequence.startPosition
    ? rotateStartPosition(sequence.startPosition, rotationAmount, targetHand)
    : undefined;

  const rotatedStartingPositionStep = sequence.startingPosition
    ? rotateStartPosition(sequence.startingPosition, rotationAmount, targetHand)
    : undefined;

  // Only toggle grid mode when both hands are rotated
  const newGridMode =
    targetHand === "both"
      ? getToggledGridMode(gridMode, rotationAmount)
      : gridMode;

  return updateSequenceData(sequence, {
    steps: rotatedBeats,
    ...(rotatedStartPosition && { startPosition: rotatedStartPosition }),
    ...(rotatedStartingPositionStep && {
      startingPosition: rotatedStartingPositionStep,
    }),
    gridMode: newGridMode,
  });
}

/**
 * Swap colors in sequence (blue ↔ red).
 */
export function colorSwapSequence(sequence: SequenceData): SequenceData {
  const swappedBeats = sequence.steps.map(colorSwapBeat);

  // Transform start positions (always StartPositionData, never StepData)
  const swappedStartPosition = sequence.startPosition
    ? colorSwapStartPosition(sequence.startPosition)
    : undefined;

  const swappedStartingPositionStep = sequence.startingPosition
    ? colorSwapStartPosition(sequence.startingPosition)
    : undefined;

  return updateSequenceData(sequence, {
    steps: swappedBeats,
    ...(swappedStartPosition && { startPosition: swappedStartPosition }),
    ...(swappedStartingPositionStep && {
      startingPosition: swappedStartingPositionStep,
    }),
  });
}

/**
 * Invert sequence motion types (PRO ↔ ANTI) and rotation directions (CW ↔ CCW).
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export async function invertSequence(
  sequence: SequenceData,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  if (sequence.steps.length === 0) return sequence;

  const gridMode = sequence.gridMode ?? GridMode.DIAMOND;
  const invertedBeats: StepData[] = [];

  for (const step of sequence.steps) {
    const invertedBeat = await invertBeat(
      step,
      gridMode,
      motionQueryHandler,
      targetHand
    );
    invertedBeats.push(invertedBeat);
  }

  // Transform start positions (always StartPositionData, never StepData)
  const invertedStartPosition = sequence.startPosition
    ? invertStartPosition(sequence.startPosition, targetHand)
    : undefined;

  const invertedStartingPositionStep = sequence.startingPosition
    ? invertStartPosition(sequence.startingPosition, targetHand)
    : undefined;

  const invertedSequence = updateSequenceData(sequence, {
    steps: invertedBeats,
    ...(invertedStartPosition && { startPosition: invertedStartPosition }),
    ...(invertedStartingPositionStep && {
      startingPosition: invertedStartingPositionStep,
    }),
  });

  return recalculateAllOrientations(invertedSequence);
}

/**
 * Rewind sequence (play backwards).
 *
 * "both": the whole sequence plays in reverse — reverse beat ORDER and rewind
 * each beat (both hands), with the new start position taken from the old final
 * end.
 *
 * "blue"/"red": rewind ONE hand's path while the other hand plays forward. This
 * is an independent, valid operation — the target hand retraces its own path and
 * the other hand is untouched, so both hands stay continuous. The result is a
 * legitimate sequence with new letters and a different feel. See
 * {@link rewindSingleHand}.
 *
 * @param targetHand - Which hand(s) to rewind. Defaults to "both".
 */
export async function rewindSequence(
  sequence: SequenceData,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  if (sequence.steps.length === 0) return sequence;

  const gridMode = sequence.gridMode ?? GridMode.DIAMOND;

  if (targetHand !== "both") {
    return rewindSingleHand(sequence, targetHand, gridMode, motionQueryHandler);
  }

  // Both hands: reverse beat order, rewind each beat, derive the new start
  // position from the old final beat's end state.
  const finalStep = sequence.steps[sequence.steps.length - 1]!;
  const newStartPosition = createStartPositionFromStepEnd(finalStep);

  const beatsToProcess = [...sequence.steps].reverse();
  const rewindBeats: StepData[] = [];
  for (let index = 0; index < beatsToProcess.length; index++) {
    const beat = beatsToProcess[index]!;
    const rewoundBeat = await rewindBeat(
      beat,
      index + 1,
      gridMode,
      motionQueryHandler,
      "both"
    );
    rewindBeats.push(rewoundBeat);
  }

  return updateSequenceData(sequence, {
    steps: rewindBeats,
    startPosition: newStartPosition,
    startingPosition: newStartPosition,
    name: `${sequence.name} (Rewound)`,
  });
}

/**
 * Rewind a single hand's path while the other hand plays forward.
 *
 * The correctness point: reverse the target hand's BEAT ORDER, do not flip each
 * beat in place. New beat i pairs the rewound (N-1-i)th target motion with the
 * i-th forward other-hand motion. Because the target retraces its own contiguous
 * path and the other hand keeps its own, both hands chain (each beat's start ==
 * previous beat's end). Positions and letters are re-derived from the new
 * hand-location pairs (they are genuinely new — neither the original start nor
 * end labels apply). The new start position is just beat 1's start state: the
 * target hand at its path end, the other hand at its original start.
 */
async function rewindSingleHand(
  sequence: SequenceData,
  targetHand: Exclude<TargetHand, "both">,
  gridMode: GridMode,
  motionQueryHandler: IMotionQueryHandler
): Promise<SequenceData> {
  const steps = sequence.steps;
  const n = steps.length;
  const targetColor =
    targetHand === "blue" ? MotionColor.BLUE : MotionColor.RED;

  const newSteps: StepData[] = [];
  for (let i = 0; i < n; i++) {
    const forwardStep = steps[i]!; // supplies the non-target hand (forward)
    const targetSource = steps[n - 1 - i]!; // supplies the rewound target hand

    const newMotions = { ...forwardStep.motions };
    const targetSrcMotion = targetSource.motions[targetColor];
    if (targetSrcMotion) {
      newMotions[targetColor] = rewindMotion(targetSrcMotion);
    }

    const blueM = newMotions[MotionColor.BLUE];
    const redM = newMotions[MotionColor.RED];

    let startPosition: GridPosition | null = forwardStep.startPosition ?? null;
    let endPosition: GridPosition | null = forwardStep.endPosition ?? null;
    if (blueM && redM) {
      try {
        startPosition = getGridPositionFromLocations(
          blueM.startLocation,
          redM.startLocation
        );
        endPosition = getGridPositionFromLocations(
          blueM.endLocation,
          redM.endLocation
        );
      } catch (error) {
        console.warn(
          "Failed to derive positions for single-hand rewind beat:",
          error
        );
      }
    }

    let letter: Letter | null = forwardStep.letter ?? null;
    if (blueM && redM) {
      try {
        const found = await motionQueryHandler.findLetterByMotionConfiguration(
          blueM,
          redM,
          gridMode
        );
        if (found) letter = found as Letter;
      } catch (error) {
        console.error("Error looking up letter for single-hand rewind:", error);
      }
    }

    newSteps.push(
      createStepData({
        ...forwardStep,
        stepNumber: i + 1,
        motions: newMotions,
        startPosition,
        endPosition,
        letter,
        // Reversal flags must be recalculated for the new ordering.
        blueReversal: false,
        redReversal: false,
      })
    );
  }

  const newStartPosition = newSteps[0]
    ? createStartPositionFromBeatStart(newSteps[0])
    : sequence.startPosition;

  return updateSequenceData(sequence, {
    steps: newSteps,
    ...(newStartPosition
      ? { startPosition: newStartPosition, startingPosition: newStartPosition }
      : {}),
    name: `${sequence.name} (Rewound)`,
  });
}

/**
 * Shift the start position of a sequence.
 * For circular: rotates steps so target beat's end becomes new start.
 * For non-circular: truncates steps before target.
 */
export function shiftStartPosition(
  sequence: SequenceData,
  targetStepNumber: number
): SequenceData {
  if (targetStepNumber < 1 || targetStepNumber > sequence.steps.length) {
    return sequence;
  }

  // No-op if targeting beat 1
  if (targetStepNumber === 1) {
    return sequence;
  }

  if (sequence.isCircular) {
    return shiftCircularSequence(sequence, targetStepNumber);
  } else {
    return truncateToNewStart(sequence, targetStepNumber);
  }
}

/**
 * Shift a circular sequence by rotating steps.
 * Target beat becomes the new beat 1.
 * The beat BEFORE target's end position becomes the new start.
 */
function shiftCircularSequence(
  sequence: SequenceData,
  targetStepNumber: number
): SequenceData {
  // New start position is the beat BEFORE target's end position
  // (which is the same as target beat's start position)
  const beatBeforeTarget = sequence.steps[targetStepNumber - 2];
  const newStartPosition = beatBeforeTarget
    ? createStartPositionFromStepEnd(beatBeforeTarget)
    : sequence.startPosition || sequence.startingPosition;

  // Rotate steps: target and after come first, then everything before target
  const fromTarget = sequence.steps.slice(targetStepNumber - 1);
  const beforeTarget = sequence.steps.slice(0, targetStepNumber - 1);
  const rotatedBeats = [...fromTarget, ...beforeTarget];

  // Renumber steps
  const renumberedSteps = rotatedBeats.map((step, index) =>
    createStepData({ ...step, stepNumber: index + 1 })
  );

  return updateSequenceData(sequence, {
    steps: renumberedSteps,
    startPosition: newStartPosition,
    startingPosition: newStartPosition,
  });
}

/**
 * Truncate a non-circular sequence to a new start point.
 * Removes steps before the target beat.
 */
function truncateToNewStart(
  sequence: SequenceData,
  targetStepNumber: number
): SequenceData {
  // New start position from beat BEFORE target
  const beatBeforeTarget = sequence.steps[targetStepNumber - 2]!;
  const newStartPosition = createStartPositionFromStepEnd(beatBeforeTarget);

  // Keep only steps from target onwards
  const keptBeats = sequence.steps.slice(targetStepNumber - 1);

  // Renumber
  const renumberedSteps = keptBeats.map((step, index) =>
    createStepData({ ...step, stepNumber: index + 1 })
  );

  return updateSequenceData(sequence, {
    steps: renumberedSteps,
    startPosition: newStartPosition,
    startingPosition: newStartPosition,
    isCircular: false, // No longer circular after truncation
  });
}

/**
 * Derive the static letter (α, β, γ) from a grid position.
 * Alpha positions → Letter.ALPHA (α)
 * Beta positions → Letter.BETA (β)
 * Gamma positions → Letter.GAMMA (γ)
 */
function getStaticLetterFromGridPosition(
  position: GridPosition | null | undefined
): Letter {
  if (!position) return Letter.ALPHA; // Fallback for null/undefined

  const positionStr = position.toString().toLowerCase();
  if (positionStr.startsWith("beta")) return Letter.BETA;
  if (positionStr.startsWith("gamma")) return Letter.GAMMA;
  return Letter.ALPHA; // Default for alpha positions
}

/**
 * Derive correct letters for all steps in a sequence.
 * Used as Phase 2 after synchronous transforms to update letters asynchronously.
 * This allows smooth CSS animations while still getting correct letter values.
 */
export async function deriveSequenceLetters(
  sequence: SequenceData,
  motionQueryHandler: IMotionQueryHandler
): Promise<SequenceData> {
  // Derive letters for all steps in parallel
  const stepsWithLetters = await Promise.all(
    sequence.steps.map(async (step) => {
      if (step.isBlank) return step;

      const blueMotion = step.motions[MotionColor.BLUE];
      const redMotion = step.motions[MotionColor.RED];

      // Invisible placeholder = hand not really there (both-required Step
      // shape): keep the existing letter, exactly like the old absent-hand skip
      // (a dataframe lookup against a placeholder would rewrite the word).
      if (!isVisibleMotion(blueMotion) || !isVisibleMotion(redMotion)) return step;

      // Derive gridMode per-step from the motions — never trust the stale
      // sequence-level value (a box step inside a diamond-labelled sequence
      // would otherwise be looked up under the wrong grid mode).
      const gridMode = deriveGridMode(blueMotion, redMotion);

      try {
        const foundLetter =
          await motionQueryHandler.findLetterByMotionConfiguration(
            blueMotion,
            redMotion,
            gridMode
          );
        if (foundLetter) {
          return createStepData({
            ...step,
            letter: foundLetter as Letter,
          });
        }
      } catch (error) {
        console.warn(
          `Failed to derive letter for step ${step.stepNumber}:`,
          error
        );
      }
      return step;
    })
  );

  return updateSequenceData(sequence, {
    steps: stepsWithLetters,
  });
}

/**
 * Create a start position from a beat's end state.
 * Returns StartPositionData (not StepData) - start positions are semantically distinct from steps.
 */
export function createStartPositionFromStepEnd(step: StepData): StartPositionData {
  const blueMotion = step.motions[MotionColor.BLUE];
  const redMotion = step.motions[MotionColor.RED];

  // Derive the correct letter from the end position (alpha, beta, or gamma)
  const letter = getStaticLetterFromGridPosition(step.endPosition);

  return createStartPositionData({
    id: `start-${Date.now()}`,
    letter: letter,
    startPosition: step.endPosition ?? null,
    endPosition: step.endPosition ?? null,
    gridPosition: step.endPosition ?? null,
    motions: {
      [MotionColor.BLUE]: blueMotion
        ? {
            ...blueMotion,
            motionType: MotionType.STATIC,
            rotationDirection: RotationDirection.NO_ROTATION,
            startLocation: blueMotion.endLocation,
            endLocation: blueMotion.endLocation,
            arrowLocation: blueMotion.endLocation,
            startOrientation: blueMotion.endOrientation,
            endOrientation: blueMotion.endOrientation,
            turns: 0,
          }
        : undefined,
      [MotionColor.RED]: redMotion
        ? {
            ...redMotion,
            motionType: MotionType.STATIC,
            rotationDirection: RotationDirection.NO_ROTATION,
            startLocation: redMotion.endLocation,
            endLocation: redMotion.endLocation,
            arrowLocation: redMotion.endLocation,
            startOrientation: redMotion.endOrientation,
            endOrientation: redMotion.endOrientation,
            turns: 0,
          }
        : undefined,
    },
  });
}

/**
 * Create a start position from a beat's START state.
 * Used when a sequence doesn't have an explicit startPosition but we need to derive one
 * from beat 1's starting configuration.
 * Returns StartPositionData (not StepData) - start positions are semantically distinct from steps.
 */
export function createStartPositionFromBeatStart(step: StepData): StartPositionData {
  const blueMotion = step.motions[MotionColor.BLUE];
  const redMotion = step.motions[MotionColor.RED];

  // Derive the correct letter from the start position (alpha, beta, or gamma)
  const letter = getStaticLetterFromGridPosition(step.startPosition);

  return createStartPositionData({
    id: `start-derived-${Date.now()}`,
    letter: letter,
    startPosition: step.startPosition ?? null,
    endPosition: step.startPosition ?? null,
    gridPosition: step.startPosition ?? null,
    motions: {
      [MotionColor.BLUE]: blueMotion
        ? {
            ...blueMotion,
            motionType: MotionType.STATIC,
            rotationDirection: RotationDirection.NO_ROTATION,
            startLocation: blueMotion.startLocation,
            endLocation: blueMotion.startLocation,
            arrowLocation: blueMotion.startLocation,
            startOrientation: blueMotion.startOrientation,
            endOrientation: blueMotion.startOrientation,
            turns: 0,
          }
        : undefined,
      [MotionColor.RED]: redMotion
        ? {
            ...redMotion,
            motionType: MotionType.STATIC,
            rotationDirection: RotationDirection.NO_ROTATION,
            startLocation: redMotion.startLocation,
            endLocation: redMotion.startLocation,
            arrowLocation: redMotion.startLocation,
            startOrientation: redMotion.startOrientation,
            endOrientation: redMotion.startOrientation,
            turns: 0,
          }
        : undefined,
    },
  });
}
