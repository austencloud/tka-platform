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
import type { BeatData } from "../../../domain/models/BeatData";
import type { StartPositionData } from "../../../domain/models/StartPositionData";
import { createStartPositionData } from "../../../domain/factories/createStartPositionData";
import type { ICreateModuleState } from "../../../types/create-module-types";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IGridModeDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { IReversalDetector } from "../../../services/contracts/IReversalDetector";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { resolve } from "$lib/shared/inversify/di";
import { TYPES } from "$lib/shared/inversify/types";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import {
  getBeatDataFromState,
  START_POSITION_BEAT_NUMBER,
  updateSequenceWord,
} from "./beat-data-helpers";
import { calculatePropagatedBeats } from "./OrientationHandler";

const logger = createComponentLogger("RotationDirectionHandler");

/**
 * Update rotation direction for a specific prop color in a beat
 */
export function updateRotationDirection(
  beatNumber: number,
  color: string,
  rotationDirection: string,
  createModuleState: ICreateModuleState,
  motionQueryHandler: IMotionQueryHandler | null,
  gridModeDeriver: IGridModeDeriver | null
): void {
  const beatData = getBeatDataFromState(beatNumber, createModuleState);

  if (!beatData?.motions) {
    logger.warn("Cannot update rotation direction - no beat data available");
    return;
  }

  const colorKey = color as MotionColor;
  const currentMotion: MotionData | undefined = beatData.motions[colorKey];
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

  // CRITICAL: Flip motion type when rotation direction changes (legacy behavior)
  // PRO ↔ ANTI flip is what causes the pictograph's letter to potentially change
  let newMotionType = currentMotion.motionType;
  if (currentMotion.motionType === MotionType.PRO) {
    newMotionType = MotionType.ANTI;
    logger.log(`Flipping motion type: PRO → ANTI`);
  } else if (currentMotion.motionType === MotionType.ANTI) {
    newMotionType = MotionType.PRO;
    logger.log(`Flipping motion type: ANTI → PRO`);
  }
  // Note: DASH, STATIC, FLOAT don't flip

  // Recalculate endOrientation based on new rotation direction and motion type
  const orientationCalculator = resolve<IOrientationCalculator>(
    TYPES.IOrientationCalculator
  );
  const tempMotionData = createMotionData({
    ...currentMotion,
    rotationDirection: newRotationDirection,
    motionType: newMotionType,
  });
  const newEndOrientation = orientationCalculator.calculateEndOrientation(
    tempMotionData,
    colorKey
  );

  // Create updated beat data
  const updatedBeatData = {
    ...beatData,
    motions: {
      ...beatData.motions,
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

  if (beatNumber === START_POSITION_BEAT_NUMBER) {
    // Create updated start position with new motions
    updatedStartPosition = startPosition
      ? createStartPositionData({
          ...startPosition,
          motions: updatedBeatData.motions,
        })
      : null;
    logger.log(
      `Updated start position ${color}: rotation=${newRotationDirection}, motionType=${newMotionType}, endOri=${newEndOrientation}`
    );

    const propagatedBeats = calculatePropagatedBeats(
      beatNumber,
      color,
      currentSequence,
      updatedStartPosition
    );

    updatedSequence = {
      ...currentSequence,
      beats: propagatedBeats,
    };

    // Update start position first
    createModuleState.sequenceState.setStartPosition(updatedStartPosition);
  } else {
    const arrayIndex = beatNumber - 1;
    const updatedBeats = [...currentSequence.beats];
    updatedBeats[arrayIndex] = updatedBeatData;

    logger.log(
      `Updated beat ${beatNumber} ${color}: rotation=${newRotationDirection}, motionType=${newMotionType}, endOri=${newEndOrientation}`
    );

    const propagatedBeats = calculatePropagatedBeats(
      beatNumber,
      color,
      { ...currentSequence, beats: updatedBeats },
      startPosition
    );

    updatedSequence = {
      ...currentSequence,
      beats: propagatedBeats,
    };
  }

  // CRITICAL: Derive the new letter BEFORE setting the sequence
  // The PRO ↔ ANTI flip may change the pictograph's letter
  if (motionQueryHandler && gridModeDeriver) {
    const beatToCheck =
      beatNumber === START_POSITION_BEAT_NUMBER
        ? updatedStartPosition
        : updatedSequence.beats[beatNumber - 1];

    if (beatToCheck) {
      recalculateLetterAsync(
        beatNumber,
        beatToCheck,
        createModuleState,
        motionQueryHandler,
        gridModeDeriver
      );
    }
  }

  // Process reversals to update reversal indicators after rotation direction change
  try {
    const reversalService = resolve<IReversalDetector>(TYPES.IReversalDetector);
    updatedSequence = reversalService.processReversals(updatedSequence);
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
  beatNumber: number,
  beatToCheck: BeatData | StartPositionData,
  createModuleState: ICreateModuleState,
  motionQueryHandler: IMotionQueryHandler,
  gridModeDeriver: IGridModeDeriver
): Promise<void> {
  const blueMotion = beatToCheck.motions?.[MotionColor.BLUE];
  const redMotion = beatToCheck.motions?.[MotionColor.RED];

  if (!blueMotion || !redMotion) return;

  try {
    const gridMode = gridModeDeriver.deriveGridMode(blueMotion, redMotion);
    const newLetter = await motionQueryHandler.findLetterByMotionConfiguration(
      blueMotion,
      redMotion,
      gridMode
    );

    if (newLetter && newLetter !== beatToCheck.letter) {
      logger.log(
        `📝 Letter changed: "${beatToCheck.letter}" → "${newLetter}" for beat ${beatNumber}`
      );

      // Update the beat with the new letter
      if (beatNumber === START_POSITION_BEAT_NUMBER) {
        const updatedStart = createStartPositionData({
          ...beatToCheck,
          letter: newLetter as Letter,
        });
        createModuleState.sequenceState.setStartPosition(updatedStart);
      } else {
        const arrayIndex = beatNumber - 1;
        const currentSeq = createModuleState.sequenceState.currentSequence;
        if (currentSeq) {
          const beatsWithLetter = [...currentSeq.beats];
          const existingBeat = beatsWithLetter[arrayIndex];
          beatsWithLetter[arrayIndex] = {
            ...existingBeat,
            letter: newLetter as Letter,
          } as BeatData;

          // Update word and sequence together
          const word = beatsWithLetter
            .map((beat) => beat.letter ?? "")
            .join("")
            .toUpperCase();

          createModuleState.sequenceState.setCurrentSequence({
            ...currentSeq,
            beats: beatsWithLetter,
            word,
          });
        }
      }
    }
  } catch (error) {
    logger.error(`Failed to derive letter for beat ${beatNumber}:`, error);
  }
}

/**
 * Recalculate the letter for a beat based on its current motion configuration
 * This is called after changes that may affect the letter (e.g., rotation direction change)
 */
export async function recalculateLetterForBeat(
  beatNumber: number,
  createModuleState: ICreateModuleState,
  motionQueryHandler: IMotionQueryHandler | null,
  gridModeDeriver: IGridModeDeriver | null
): Promise<void> {
  if (!motionQueryHandler || !gridModeDeriver) {
    return;
  }

  const beatData = getBeatDataFromState(beatNumber, createModuleState);

  if (!beatData) {
    return;
  }

  const blueMotion = beatData.motions?.[MotionColor.BLUE];
  const redMotion = beatData.motions?.[MotionColor.RED];

  if (!blueMotion || !redMotion) {
    return;
  }

  try {
    const gridMode = gridModeDeriver.deriveGridMode(blueMotion, redMotion);

    const newLetter = (await motionQueryHandler.findLetterByMotionConfiguration(
      blueMotion,
      redMotion,
      gridMode
    )) as Letter | null;

    if (newLetter) {
      if (newLetter !== beatData.letter) {
        logger.log(
          `Letter changed: "${beatData.letter}" → "${newLetter}" for beat ${beatNumber}`
        );

        if (beatNumber === START_POSITION_BEAT_NUMBER) {
          // Use createStartPositionData for start positions
          const updatedStartPosition = createStartPositionData({
            ...beatData,
            letter: newLetter,
          });
          createModuleState.sequenceState.setStartPosition(updatedStartPosition);
        } else {
          // Use BeatData for regular beats
          const updatedBeatData: BeatData = {
            ...beatData,
            letter: newLetter,
            beatNumber: beatData.beatNumber ?? beatNumber,
          } as BeatData;
          const arrayIndex = beatNumber - 1;
          createModuleState.sequenceState.updateBeat(
            arrayIndex,
            updatedBeatData
          );
        }

        updateSequenceWord(createModuleState);
      } else {
        logger.log(
          `Letter unchanged: "${beatData.letter}" for beat ${beatNumber}`
        );
      }
    } else {
      logger.warn(
        `Could not find letter for beat ${beatNumber} motion configuration (gridMode: ${gridMode})`
      );
    }
  } catch (error) {
    logger.error(`Failed to recalculate letter for beat ${beatNumber}:`, error);
  }
}
