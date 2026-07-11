/**
 * Strict Flipped LOOP Executor
 *
 * Supports both halved (period 2) and quartered (period 4) flipped LOOPs.
 *
 * Period 2 (halved):
 *   Q1 (beats 1..N)     - partial
 *   Q2 (beats N+1..2N)  - horizontal flip (N↔S) of Q1
 *
 * Period 4 (quartered):
 *   Q1, Q2 as above, plus
 *   Q3 (beats 2N+1..3N) - copy of Q1 with new start orientation
 *   Q4 (beats 3N+1..4N) - horizontal flip of Q3
 *
 * See StrictMirroredLOOPExecutor for a full explanation of the period-4
 * mechanism.
 */

import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  RotationDirection,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type {
  GridPosition,
  GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  updateStartOrientations,
  updateEndOrientations,
} from "$lib/shared/pictograph/prop/services/orientation-calculator";
import {
  HORIZONTAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_LOCATION_MAP,
  FLIPPED_LOOP_VALIDATION_SET,
} from "../domain/constants/strict-loop-position-maps";
import { Period } from "../domain/models/circular-models";
import { buildStrictQuarters } from "./loop-quarter-guard";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

export class StrictFlippedLOOPExecutor {
  constructor() {}

  executeLOOP(sequence: StepData[], period: Period): StepData[] {
    this._validateSequence(sequence);

    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    const partialLength = sequence.length;
    const requestedPeriod = period === Period.QUARTERED ? 4 : 2;

    // Odd quarters flip, even quarters copy; stop at period 2 when orientation
    // already closes (see loop-quarter-guard.ts / the YΦΔ×4 defect).
    buildStrictQuarters(
      sequence,
      partialLength,
      requestedPeriod,
      (s, p, n) => this._createFlippedEntry(s, p, n),
      (s, p, n) => this._createCopiedEntry(s, p, n),
    );

    sequence.unshift(startPosition);
    return sequence;
  }

  private _validateSequence(sequence: StepData[]): void {
    if (sequence.length < 2) {
      throw new Error(
        "Sequence must have at least 2 steps (start position + 1 beat)"
      );
    }

    const startPos = sequence[0]!.startPosition;
    const endPos = sequence[sequence.length - 1]!.endPosition;

    if (!startPos || !endPos) {
      throw new Error("Sequence steps must have valid start and end positions");
    }

    const key = `${startPos},${endPos}`;

    if (!FLIPPED_LOOP_VALIDATION_SET.has(key)) {
      const expectedEnd =
        HORIZONTAL_MIRROR_POSITION_MAP[startPos as GridPosition];
      throw new Error(
        `Invalid position pair for flipped LOOP: ${startPos} → ${endPos}. ` +
          `For a flipped LOOP from ${startPos}, the sequence must end at ${expectedEnd}.`
      );
    }
  }

  private _createFlippedEntry(
    sourceStep: StepData,
    previousStep: StepData,
    stepNumber: number
  ): StepData {
    const newEndPosition = this._getFlippedPosition(sourceStep);

    const newStep: StepData = {
      ...sourceStep,
      id: `step-${stepNumber}`,
      stepNumber,
      startPosition: previousStep.endPosition ?? null,
      endPosition: newEndPosition,
      motions: {
        [MotionColor.BLUE]: this._createFlippedMotion(
          MotionColor.BLUE,
          previousStep,
          sourceStep
        ),
        [MotionColor.RED]: this._createFlippedMotion(
          MotionColor.RED,
          previousStep,
          sourceStep
        ),
      },
    };

    const stepWithStartOri = updateStartOrientations(
      newStep,
      previousStep
    );
    return updateEndOrientations(stepWithStartOri);
  }

  private _createCopiedEntry(
    sourceStep: StepData,
    previousStep: StepData,
    stepNumber: number
  ): StepData {
    const sourceBlue = sourceStep.motions[MotionColor.BLUE];
    const sourceRed = sourceStep.motions[MotionColor.RED];
    if (!sourceBlue || !sourceRed) {
      throw new Error(
        `Source step ${sourceStep.stepNumber} is missing motion data`
      );
    }

    const newStep: StepData = {
      ...sourceStep,
      id: `step-${stepNumber}`,
      stepNumber,
      startPosition: previousStep.endPosition ?? null,
      endPosition: sourceStep.endPosition,
      motions: {
        [MotionColor.BLUE]: {
          ...sourceBlue,
          startLocation:
            previousStep.motions[MotionColor.BLUE]?.endLocation ??
            sourceBlue.startLocation,
        },
        [MotionColor.RED]: {
          ...sourceRed,
          startLocation:
            previousStep.motions[MotionColor.RED]?.endLocation ??
            sourceRed.startLocation,
        },
      },
    };

    const stepWithStartOri = updateStartOrientations(
      newStep,
      previousStep
    );
    return updateEndOrientations(stepWithStartOri);
  }

  private _getFlippedPosition(sourceStep: StepData): GridPosition | null {
    const endPos = sourceStep.endPosition;
    if (!endPos) {
      throw new Error("Source step must have an end position");
    }
    return HORIZONTAL_MIRROR_POSITION_MAP[endPos as GridPosition];
  }

  private _createFlippedMotion(
    color: MotionColor,
    previousStep: StepData,
    sourceStep: StepData
  ): MotionData {
    const previousMotion = previousStep.motions[color];
    const sourceMotion = sourceStep.motions[color];

    if (!previousMotion || !sourceMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    return {
      ...sourceMotion,
      startLocation: previousMotion.endLocation,
      endLocation: this._getFlippedLocation(
        sourceMotion.endLocation as GridLocation
      ),
      rotationDirection: this._getFlippedPropRotDir(
        sourceMotion.rotationDirection
      ),
    };
  }

  private _getFlippedLocation(location: GridLocation): GridLocation {
    return HORIZONTAL_MIRROR_LOCATION_MAP[location];
  }

  private _getFlippedPropRotDir(
    propRotDir: RotationDirection
  ): RotationDirection {
    if (propRotDir === RotationDirection.CLOCKWISE) {
      return RotationDirection.COUNTER_CLOCKWISE;
    } else if (propRotDir === RotationDirection.COUNTER_CLOCKWISE) {
      return RotationDirection.CLOCKWISE;
    }
    return propRotDir;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const strictFlippedLOOPExecutor = new StrictFlippedLOOPExecutor();
