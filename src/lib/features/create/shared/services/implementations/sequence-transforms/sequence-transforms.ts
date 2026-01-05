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

import type { BeatData } from "../../../domain/models/BeatData";
import type { StartPositionData } from "../../../domain/models/StartPositionData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import {
  updateSequenceData,
  createSequenceData,
} from "$lib/shared/foundation/domain/models/SequenceData";
import { createBeatData } from "../../../domain/factories/createBeatData";
import { createStartPositionData } from "../../../domain/factories/createStartPositionData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";

import {
  mirrorBeat,
  flipBeat,
  rotateBeat,
  colorSwapBeat,
  invertBeat,
  rewindBeat,
} from "./beat-transforms";
import {
  mirrorStartPosition,
  flipStartPosition,
  rotateStartPosition,
  colorSwapStartPosition,
  invertStartPosition,
} from "./start-position-transforms";
import { recalculateAllOrientations } from "./orientation-propagation";
import { getToggledGridMode } from "./rotation-helpers";
import type { TargetHand } from "../../../state/panel-coordination-state.svelte";

/**
 * Clear all beats in a sequence (make them blank).
 */
export function clearSequence(sequence: SequenceData): SequenceData {
  const clearedBeats = sequence.beats.map((beat) => ({
    ...beat,
    isBlank: true,
    pictographData: null,
    blueReversal: false,
    redReversal: false,
  }));

  return updateSequenceData(sequence, { beats: clearedBeats });
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
    beats: sequence.beats.map((beat) => ({
      ...beat,
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
  positionDeriver: IGridPositionDeriver,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  const gridMode = sequence.gridMode ?? GridMode.DIAMOND;

  const mirroredBeats = await Promise.all(
    sequence.beats.map((beat) =>
      mirrorBeat(beat, gridMode, positionDeriver, motionQueryHandler, targetHand)
    )
  );

  // Transform start positions (always StartPositionData, never BeatData)
  const mirroredStartPosition = sequence.startPosition
    ? mirrorStartPosition(sequence.startPosition, targetHand, positionDeriver)
    : undefined;

  const mirroredStartingPositionBeat = sequence.startingPositionBeat
    ? mirrorStartPosition(sequence.startingPositionBeat, targetHand, positionDeriver)
    : undefined;

  return updateSequenceData(sequence, {
    beats: mirroredBeats,
    ...(mirroredStartPosition && { startPosition: mirroredStartPosition }),
    ...(mirroredStartingPositionBeat && {
      startingPositionBeat: mirroredStartingPositionBeat,
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
  positionDeriver: IGridPositionDeriver,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  const gridMode = sequence.gridMode ?? GridMode.DIAMOND;

  const flippedBeats = await Promise.all(
    sequence.beats.map((beat) =>
      flipBeat(beat, gridMode, positionDeriver, motionQueryHandler, targetHand)
    )
  );

  // Transform start positions (always StartPositionData, never BeatData)
  const flippedStartPosition = sequence.startPosition
    ? flipStartPosition(sequence.startPosition, targetHand, positionDeriver)
    : undefined;

  const flippedStartingPositionBeat = sequence.startingPositionBeat
    ? flipStartPosition(sequence.startingPositionBeat, targetHand, positionDeriver)
    : undefined;

  return updateSequenceData(sequence, {
    beats: flippedBeats,
    ...(flippedStartPosition && { startPosition: flippedStartPosition }),
    ...(flippedStartingPositionBeat && {
      startingPositionBeat: flippedStartingPositionBeat,
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
  positionDeriver: IGridPositionDeriver,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  const gridMode = sequence.gridMode ?? GridMode.DIAMOND;

  const rotatedBeats = await Promise.all(
    sequence.beats.map((beat) =>
      rotateBeat(
        beat,
        rotationAmount,
        gridMode,
        positionDeriver,
        motionQueryHandler,
        targetHand
      )
    )
  );

  // Transform start positions (always StartPositionData, never BeatData)
  const rotatedStartPosition = sequence.startPosition
    ? rotateStartPosition(sequence.startPosition, rotationAmount, positionDeriver, targetHand)
    : undefined;

  const rotatedStartingPositionBeat = sequence.startingPositionBeat
    ? rotateStartPosition(sequence.startingPositionBeat, rotationAmount, positionDeriver, targetHand)
    : undefined;

  // Only toggle grid mode when both hands are rotated
  const newGridMode =
    targetHand === "both"
      ? getToggledGridMode(gridMode, rotationAmount)
      : gridMode;

  return updateSequenceData(sequence, {
    beats: rotatedBeats,
    ...(rotatedStartPosition && { startPosition: rotatedStartPosition }),
    ...(rotatedStartingPositionBeat && {
      startingPositionBeat: rotatedStartingPositionBeat,
    }),
    gridMode: newGridMode,
  });
}

/**
 * Swap colors in sequence (blue ↔ red).
 */
export function colorSwapSequence(sequence: SequenceData): SequenceData {
  const swappedBeats = sequence.beats.map(colorSwapBeat);

  // Transform start positions (always StartPositionData, never BeatData)
  const swappedStartPosition = sequence.startPosition
    ? colorSwapStartPosition(sequence.startPosition)
    : undefined;

  const swappedStartingPositionBeat = sequence.startingPositionBeat
    ? colorSwapStartPosition(sequence.startingPositionBeat)
    : undefined;

  return updateSequenceData(sequence, {
    beats: swappedBeats,
    ...(swappedStartPosition && { startPosition: swappedStartPosition }),
    ...(swappedStartingPositionBeat && {
      startingPositionBeat: swappedStartingPositionBeat,
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
  orientationCalculator: IOrientationCalculator,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  if (sequence.beats.length === 0) return sequence;

  const gridMode = sequence.gridMode ?? GridMode.DIAMOND;
  const invertedBeats: BeatData[] = [];

  for (const beat of sequence.beats) {
    const invertedBeat = await invertBeat(
      beat,
      gridMode,
      motionQueryHandler,
      targetHand
    );
    invertedBeats.push(invertedBeat);
  }

  // Transform start positions (always StartPositionData, never BeatData)
  const invertedStartPosition = sequence.startPosition
    ? invertStartPosition(sequence.startPosition, orientationCalculator, targetHand)
    : undefined;

  const invertedStartingPositionBeat = sequence.startingPositionBeat
    ? invertStartPosition(sequence.startingPositionBeat, orientationCalculator, targetHand)
    : undefined;

  const invertedSequence = updateSequenceData(sequence, {
    beats: invertedBeats,
    ...(invertedStartPosition && { startPosition: invertedStartPosition }),
    ...(invertedStartingPositionBeat && {
      startingPositionBeat: invertedStartingPositionBeat,
    }),
  });

  return recalculateAllOrientations(invertedSequence, orientationCalculator);
}

/**
 * Rewind sequence (play backwards).
 * Creates new start position from final beat, reverses and transforms beats.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 * Note: Beat reordering only happens when both hands are selected.
 */
export async function rewindSequence(
  sequence: SequenceData,
  motionQueryHandler: IMotionQueryHandler,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  if (sequence.beats.length === 0) return sequence;

  const gridMode = sequence.gridMode ?? GridMode.DIAMOND;

  // Only reverse beat order and create new start position when both hands selected
  const shouldReverseOrder = targetHand === "both";

  // Create new start position from final beat's end state (only for both hands)
  const finalBeat = sequence.beats[sequence.beats.length - 1]!;
  const newStartPosition = shouldReverseOrder
    ? createStartPositionFromBeatEnd(finalBeat)
    : sequence.startPosition;

  // Rewind and transform each beat
  const rewindBeats: BeatData[] = [];
  const beatsToProcess = shouldReverseOrder
    ? [...sequence.beats].reverse()
    : sequence.beats;

  for (let index = 0; index < beatsToProcess.length; index++) {
    const beat = beatsToProcess[index]!;
    const rewoundBeat = await rewindBeat(
      beat,
      shouldReverseOrder ? index + 1 : beat.beatNumber,
      gridMode,
      motionQueryHandler,
      targetHand
    );
    rewindBeats.push(rewoundBeat);
  }

  return updateSequenceData(sequence, {
    beats: rewindBeats,
    ...(shouldReverseOrder && newStartPosition
      ? {
          startPosition: newStartPosition,
          startingPositionBeat: newStartPosition,
          name: `${sequence.name} (Rewound)`,
        }
      : {}),
  });
}

/**
 * Shift the start position of a sequence.
 * For circular: rotates beats so target beat's end becomes new start.
 * For non-circular: truncates beats before target.
 */
export function shiftStartPosition(
  sequence: SequenceData,
  targetBeatNumber: number
): SequenceData {
  if (targetBeatNumber < 1 || targetBeatNumber > sequence.beats.length) {
    return sequence;
  }

  // No-op if targeting beat 1
  if (targetBeatNumber === 1) {
    return sequence;
  }

  if (sequence.isCircular) {
    return shiftCircularSequence(sequence, targetBeatNumber);
  } else {
    return truncateToNewStart(sequence, targetBeatNumber);
  }
}

/**
 * Shift a circular sequence by rotating beats.
 * Target beat becomes the new beat 1.
 * The beat BEFORE target's end position becomes the new start.
 */
function shiftCircularSequence(
  sequence: SequenceData,
  targetBeatNumber: number
): SequenceData {
  // New start position is the beat BEFORE target's end position
  // (which is the same as target beat's start position)
  const beatBeforeTarget = sequence.beats[targetBeatNumber - 2];
  const newStartPosition = beatBeforeTarget
    ? createStartPositionFromBeatEnd(beatBeforeTarget)
    : sequence.startPosition || sequence.startingPositionBeat;

  // Rotate beats: target and after come first, then everything before target
  const fromTarget = sequence.beats.slice(targetBeatNumber - 1);
  const beforeTarget = sequence.beats.slice(0, targetBeatNumber - 1);
  const rotatedBeats = [...fromTarget, ...beforeTarget];

  // Renumber beats
  const renumberedBeats = rotatedBeats.map((beat, index) =>
    createBeatData({ ...beat, beatNumber: index + 1 })
  );

  return updateSequenceData(sequence, {
    beats: renumberedBeats,
    startPosition: newStartPosition,
    startingPositionBeat: newStartPosition,
  });
}

/**
 * Truncate a non-circular sequence to a new start point.
 * Removes beats before the target beat.
 */
function truncateToNewStart(
  sequence: SequenceData,
  targetBeatNumber: number
): SequenceData {
  // New start position from beat BEFORE target
  const beatBeforeTarget = sequence.beats[targetBeatNumber - 2]!;
  const newStartPosition = createStartPositionFromBeatEnd(beatBeforeTarget);

  // Keep only beats from target onwards
  const keptBeats = sequence.beats.slice(targetBeatNumber - 1);

  // Renumber
  const renumberedBeats = keptBeats.map((beat, index) =>
    createBeatData({ ...beat, beatNumber: index + 1 })
  );

  return updateSequenceData(sequence, {
    beats: renumberedBeats,
    startPosition: newStartPosition,
    startingPositionBeat: newStartPosition,
    isCircular: false, // No longer circular after truncation
  });
}

/**
 * Derive the static letter (α, β, Γ) from a grid position.
 * Alpha positions → Letter.ALPHA (α)
 * Beta positions → Letter.BETA (β)
 * Gamma positions → Letter.GAMMA (Γ)
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
 * Derive correct letters for all beats in a sequence.
 * Used as Phase 2 after synchronous transforms to update letters asynchronously.
 * This allows smooth CSS animations while still getting correct letter values.
 */
export async function deriveSequenceLetters(
  sequence: SequenceData,
  motionQueryHandler: IMotionQueryHandler
): Promise<SequenceData> {
  const gridMode = sequence.gridMode ?? GridMode.DIAMOND;

  // Derive letters for all beats in parallel
  const beatsWithLetters = await Promise.all(
    sequence.beats.map(async (beat) => {
      if (beat.isBlank) return beat;

      const blueMotion = beat.motions[MotionColor.BLUE];
      const redMotion = beat.motions[MotionColor.RED];

      if (!blueMotion || !redMotion) return beat;

      try {
        const foundLetter =
          await motionQueryHandler.findLetterByMotionConfiguration(
            blueMotion,
            redMotion,
            gridMode
          );
        if (foundLetter) {
          return createBeatData({
            ...beat,
            letter: foundLetter as Letter,
          });
        }
      } catch (error) {
        console.warn(
          `Failed to derive letter for beat ${beat.beatNumber}:`,
          error
        );
      }
      return beat;
    })
  );

  return updateSequenceData(sequence, {
    beats: beatsWithLetters,
  });
}

/**
 * Create a start position from a beat's end state.
 * Returns StartPositionData (not BeatData) - start positions are semantically distinct from beats.
 */
export function createStartPositionFromBeatEnd(beat: BeatData): StartPositionData {
  const blueMotion = beat.motions[MotionColor.BLUE];
  const redMotion = beat.motions[MotionColor.RED];

  // Derive the correct letter from the end position (alpha, beta, or gamma)
  const letter = getStaticLetterFromGridPosition(beat.endPosition);

  return createStartPositionData({
    id: `start-${Date.now()}`,
    letter: letter,
    startPosition: beat.endPosition ?? null,
    endPosition: beat.endPosition ?? null,
    gridPosition: beat.endPosition ?? null,
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
