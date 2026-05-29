/**
 * Rotation Direction Handler
 * Handles rotation direction updates with motion type flipping and letter recalculation.
 *
 * CRITICAL BEHAVIOR (matches legacy PropRotDirLogicHandler):
 * 1. Rotation direction can be changed when turns >= 0 (including 0)
 * 2. Rotation direction CANNOT be changed when turns = "fl" (float)
 * 3. When rotation direction changes, motion type FLIPS: PRO ↔ ANTI
 * 4. This flip can change the pictograph's letter
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import { createStartPositionData } from "$lib/shared/create/factories/createStartPositionData";
import type { ICreateModuleState } from "../../types/create-module-types";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import { deriveGridMode as _deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { reversalDetector } from "$lib/shared/create/services/reversal-detector";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import {
  getStepDataFromState,
  START_POSITION_BEAT_NUMBER,
  updateSequenceWord,
} from "./step-data-helpers";
import { calculatePropagatedSteps } from "./orientation-handler";

const logger = createComponentLogger("RotationDirectionHandler");

/**
 * Update rotation direction for a specific prop color in a beat
 */
export function updateRotationDirection(
  stepNumber: number,
  color: string,
  rotationDirection: string,
  createModuleState: ICreateModuleState,
  motionQueryHandler: IMotionQueryHandler | null
): void {
  const stepData = getStepDataFromState(stepNumber, createModuleState);

  if (!stepData?.motions) {
    logger.warn("Cannot update rotation direction - no step data available");
    return;
  }

  const colorKey = color as MotionColor;
  const currentMotion: MotionData | undefined = stepData.motions[colorKey];
  if (!currentMotion) {
    logger.warn(`No motion data for ${color}`);
    return;
  }

  // Block rotation direction change for float turns (they don't have rotation)
  const currentTurns = currentMotion.turns;
  if (currentTurns === "fl") {
    logger.warn(
      `Cannot set rotation direction - float motions don't support rotation`
    );
    return;
  }

  // Map string rotation direction to enum
  const newRotationDirection =
    rotationDirection === "cw" || rotationDirection === "CLOCKWISE"
      ? RotationDirection.CLOCKWISE
      : RotationDirection.COUNTER_CLOCKWISE;

  // Skip if already at this rotation direction
  if (currentMotion.rotationDirection === newRotationDirection) {
    logger.log(`Already at ${newRotationDirection}, no change needed`);
    return;
  }

  // For shifts (pro/anti), motion type is DERIVED from the relationship
  // between rotation direction and hand orbital direction.
  // PRO = prop spins the same way the hand orbits.
  // ANTI = prop spins opposite to the hand orbit.
  // For non-shifts (dash/static/float), motion type is unchanged.
  const newMotionType = deriveMotionType(
    currentMotion,
    newRotationDirection
  );

  // Recalculate endOrientation based on new rotation direction and motion type
  const tempMotionData = createMotionData({
    ...currentMotion,
    rotationDirection: newRotationDirection,
    motionType: newMotionType,
  });
  const newEndOrientation = orientationCalculator.calculateEndOrientation(
    tempMotionData,
    colorKey
  );

  // Create updated step data
  const updatedStepData = {
    ...stepData,
    motions: {
      ...stepData.motions,
      [color]: {
        ...currentMotion,
        rotationDirection: newRotationDirection,
        motionType: newMotionType,
        endOrientation: newEndOrientation,
      },
    },
  };

  // Get current sequence and start position for propagation calculation
  const currentSequence: SequenceData | null =
    createModuleState.sequenceState.currentSequence;
  const startPosition: StartPositionData | null = createModuleState.sequenceState
    .selectedStartPosition ?? null;

  if (!currentSequence) {
    logger.warn("Cannot update rotation direction - no current sequence");
    return;
  }

  // Build the updated sequence with the beat update + propagated orientations
  let updatedSequence = currentSequence;
  let updatedStartPosition: StartPositionData | null = startPosition;

  if (stepNumber === START_POSITION_BEAT_NUMBER) {
    // Create updated start position with new motions
    updatedStartPosition = startPosition
      ? createStartPositionData({
          ...startPosition,
          motions: updatedStepData.motions,
        })
      : null;
    logger.log(
      `Updated start position ${color}: rotation=${newRotationDirection}, motionType=${newMotionType}, endOri=${newEndOrientation}`
    );

    const propagatedSteps = calculatePropagatedSteps(
      stepNumber,
      color,
      currentSequence,
      updatedStartPosition
    );

    updatedSequence = {
      ...currentSequence,
      steps: propagatedSteps,
    };

    // Update start position first
    createModuleState.sequenceState.setStartPosition(updatedStartPosition);
  } else {
    const arrayIndex = stepNumber - 1;
    const updatedSteps = [...currentSequence.steps];
    updatedSteps[arrayIndex] = updatedStepData;

    logger.log(
      `Updated beat ${stepNumber} ${color}: rotation=${newRotationDirection}, motionType=${newMotionType}, endOri=${newEndOrientation}`
    );

    const propagatedSteps = calculatePropagatedSteps(
      stepNumber,
      color,
      { ...currentSequence, steps: updatedSteps },
      startPosition
    );

    updatedSequence = {
      ...currentSequence,
      steps: propagatedSteps,
    };
  }

  // CRITICAL: Derive the new letter BEFORE setting the sequence
  // The PRO ↔ ANTI flip may change the pictograph's letter
  if (motionQueryHandler) {
    const stepToCheck =
      stepNumber === START_POSITION_BEAT_NUMBER
        ? updatedStartPosition
        : updatedSequence.steps[stepNumber - 1];

    if (stepToCheck) {
      recalculateLetterAsync(
        stepNumber,
        stepToCheck,
        createModuleState,
        motionQueryHandler
      );
    }
  }

  // Process reversals to update reversal indicators after rotation direction change
  try {
    updatedSequence = reversalDetector.processReversals(updatedSequence);
  } catch {
    // Reversal service is optional - continue without reversal processing
  }

  // Call setCurrentSequence ONCE with the fully updated sequence
  createModuleState.sequenceState.setCurrentSequence(updatedSequence);
}

/**
 * Asynchronously recalculate letter for a beat after motion changes
 */
async function recalculateLetterAsync(
  stepNumber: number,
  stepToCheck: StepData | StartPositionData,
  createModuleState: ICreateModuleState,
  motionQueryHandler: IMotionQueryHandler
): Promise<void> {
  const blueMotion = stepToCheck.motions?.[MotionColor.BLUE];
  const redMotion = stepToCheck.motions?.[MotionColor.RED];

  if (!blueMotion || !redMotion) return;

  try {
    const gridMode = _deriveGridMode(blueMotion, redMotion);
    const newLetter = await motionQueryHandler.findLetterByMotionConfiguration(
      blueMotion,
      redMotion,
      gridMode
    );

    if (newLetter && newLetter !== stepToCheck.letter) {
      logger.log(
        `📝 Letter changed: "${stepToCheck.letter}" → "${newLetter}" for beat ${stepNumber}`
      );

      // Update the beat with the new letter
      if (stepNumber === START_POSITION_BEAT_NUMBER) {
        const updatedStart = createStartPositionData({
          ...stepToCheck,
          letter: newLetter as Letter,
        });
        createModuleState.sequenceState.setStartPosition(updatedStart);
      } else {
        const arrayIndex = stepNumber - 1;
        const currentSeq = createModuleState.sequenceState.currentSequence;
        if (currentSeq) {
          const stepsWithLetter = [...currentSeq.steps];
          const existingBeat = stepsWithLetter[arrayIndex];
          stepsWithLetter[arrayIndex] = {
            ...existingBeat,
            letter: newLetter as Letter,
          } as StepData;

          // Update word and sequence together
          const word = stepsWithLetter
            .map((step) => step.letter ?? "")
            .join("")
            .toUpperCase();

          createModuleState.sequenceState.setCurrentSequence({
            ...currentSeq,
            steps: stepsWithLetter,
            word,
          });
        }
      }
    }
  } catch (error) {
    logger.error(`Failed to derive letter for beat ${stepNumber}:`, error);
  }
}

/**
 * Recalculate the letter for a beat based on its current motion configuration
 * This is called after changes that may affect the letter (e.g., rotation direction change)
 */
export async function recalculateLetterForBeat(
  stepNumber: number,
  createModuleState: ICreateModuleState,
  motionQueryHandler: IMotionQueryHandler | null
): Promise<void> {
  if (!motionQueryHandler) {
    return;
  }

  const stepData = getStepDataFromState(stepNumber, createModuleState);

  if (!stepData) {
    return;
  }

  const blueMotion = stepData.motions?.[MotionColor.BLUE];
  const redMotion = stepData.motions?.[MotionColor.RED];

  if (!blueMotion || !redMotion) {
    return;
  }

  try {
    const gridMode = _deriveGridMode(blueMotion, redMotion);

    const newLetter = (await motionQueryHandler.findLetterByMotionConfiguration(
      blueMotion,
      redMotion,
      gridMode
    )) as Letter | null;

    if (newLetter) {
      if (newLetter !== stepData.letter) {
        logger.log(
          `Letter changed: "${stepData.letter}" → "${newLetter}" for beat ${stepNumber}`
        );

        if (stepNumber === START_POSITION_BEAT_NUMBER) {
          // Use createStartPositionData for start positions
          const updatedStartPosition = createStartPositionData({
            ...stepData,
            letter: newLetter,
          });
          createModuleState.sequenceState.setStartPosition(updatedStartPosition);
        } else {
          // Use StepData for regular steps
          const updatedStepData: StepData = {
            ...stepData,
            letter: newLetter,
            stepNumber: stepData.stepNumber ?? stepNumber,
          } as StepData;
          const arrayIndex = stepNumber - 1;
          createModuleState.sequenceState.updateStep(
            arrayIndex,
            updatedStepData
          );
        }

        updateSequenceWord(createModuleState);
      } else {
        logger.log(
          `Letter unchanged: "${stepData.letter}" for beat ${stepNumber}`
        );
      }
    } else {
      logger.warn(
        `Could not find letter for beat ${stepNumber} motion configuration (gridMode: ${gridMode})`
      );
    }
  } catch (error) {
    logger.error(`Failed to recalculate letter for beat ${stepNumber}:`, error);
  }
}

// ============================================================================
// MOTION TYPE DERIVATION
// ============================================================================

// CW hand orbital pairs: startLocation → endLocation traces a clockwise arc
const CW_PAIRS: [string, string][] = [
  ["s", "w"], ["w", "n"], ["n", "e"], ["e", "s"],
  ["ne", "se"], ["se", "sw"], ["sw", "nw"], ["nw", "ne"],
];

// CCW hand orbital pairs
const CCW_PAIRS: [string, string][] = [
  ["w", "s"], ["n", "w"], ["e", "n"], ["s", "e"],
  ["ne", "nw"], ["nw", "sw"], ["sw", "se"], ["se", "ne"],
];

/**
 * Derive the hand's orbital direction from start/end grid locations.
 * Returns "cw", "ccw", or null (for dash/static hand paths).
 */
function deriveHandOrbitalDirection(
  startLocation: string,
  endLocation: string
): RotationDirection | null {
  const s = startLocation.toLowerCase();
  const e = endLocation.toLowerCase();

  if (CW_PAIRS.some(([a, b]) => a === s && b === e))
    return RotationDirection.CLOCKWISE;
  if (CCW_PAIRS.some(([a, b]) => a === s && b === e))
    return RotationDirection.COUNTER_CLOCKWISE;

  return null;
}

/**
 * Derive motion type from the relationship between rotation direction and
 * hand orbital direction.
 *
 * For shifts (PRO/ANTI):
 *   PRO  = prop spins the same direction as the hand orbits
 *   ANTI = prop spins opposite to the hand orbit
 *
 * For non-shifts (DASH/STATIC/FLOAT): motion type is unchanged.
 */
function deriveMotionType(
  motion: MotionData,
  newRotationDirection: RotationDirection
): MotionType {
  // Only shifts (PRO/ANTI) have their motion type determined by rotation
  if (
    motion.motionType !== MotionType.PRO &&
    motion.motionType !== MotionType.ANTI
  ) {
    return motion.motionType;
  }

  const handDirection = deriveHandOrbitalDirection(
    motion.startLocation,
    motion.endLocation
  );

  // If hand path isn't a shift arc (dash/static trajectory), keep as-is
  if (!handDirection) {
    return motion.motionType;
  }

  // PRO = rotation matches hand orbit, ANTI = opposite
  return newRotationDirection === handDirection
    ? MotionType.PRO
    : MotionType.ANTI;
}
