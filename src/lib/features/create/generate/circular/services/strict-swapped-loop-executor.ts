/**
 * Strict Swapped LOOP Executor
 *
 * Supports both halved (period 2) and quartered (period 4) swapped LOOPs.
 *
 * The swap transformation exchanges blue and red hand roles. Applied once
 * (period 2), this produces a sequence where the second half mirrors the
 * first with hands reversed. Applied with per-pass orientation advancement
 * at L3+, it can close at period 4 via the same mechanism documented in
 * StrictMirroredLOOPExecutor.
 *
 * Period 4 structure:
 *   Q1 (beats 1..N)     - partial
 *   Q2 (beats N+1..2N)  - blue/red swapped version of Q1
 *   Q3 (beats 2N+1..3N) - copy of Q1 at advanced orientation
 *   Q4 (beats 3N+1..4N) - swapped version of Q3
 */

import {
  MotionColor,
  MotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  updateStartOrientations,
  updateEndOrientations,
} from "$lib/shared/pictograph/prop/services/orientation-calculator";
import {
  SWAPPED_POSITION_MAP,
  SWAPPED_LOOP_VALIDATION_SET,
} from "../domain/constants/strict-loop-position-maps";
import { Period } from "../domain/models/circular-models";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";

export class StrictSwappedLOOPExecutor {
  constructor() {}

  executeLOOP(sequence: StepData[], period: Period): StepData[] {
    this._validateSequence(sequence);

    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    const partialLength = sequence.length;
    const periodCount = period === Period.QUARTERED ? 4 : 2;
    const totalLength = partialLength * periodCount;
    const beatsToGenerate = totalLength - partialLength;

    let lastStep = sequence[sequence.length - 1]!;
    const firstGeneratedStepNumber = lastStep.stepNumber + 1;

    for (let offset = 0; offset < beatsToGenerate; offset++) {
      const stepNumber = firstGeneratedStepNumber + offset;
      const quarterIdx = Math.floor((stepNumber - 1) / partialLength);
      const sourceStepNumber = ((stepNumber - 1) % partialLength) + 1;
      const applySwap = quarterIdx % 2 === 1;

      const sourceStep = sequence[sourceStepNumber - 1]!;

      const newStep = applySwap
        ? this._createSwappedEntry(sourceStep, lastStep, stepNumber)
        : this._createCopiedEntry(sourceStep, lastStep, stepNumber);

      sequence.push(newStep);
      lastStep = newStep;
    }

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

    if (!SWAPPED_LOOP_VALIDATION_SET.has(key)) {
      const expectedEnd = SWAPPED_POSITION_MAP[startPos as GridPosition];
      throw new Error(
        `Invalid position pair for swapped LOOP: ${startPos} → ${endPos}. ` +
          `For a swapped LOOP from ${startPos}, the sequence must end at ${expectedEnd}.`
      );
    }
  }

  private _createSwappedEntry(
    sourceStep: StepData,
    previousStep: StepData,
    stepNumber: number
  ): StepData {
    const sourceBlue = sourceStep.motions[MotionColor.BLUE];
    const sourceRed = sourceStep.motions[MotionColor.RED];

    if (!sourceBlue || !sourceRed) {
      throw new Error("Source beat is missing required motion data");
    }

    const blueMotion = this._createSwappedMotion(
      MotionColor.BLUE,
      previousStep,
      sourceRed
    );
    const redMotion = this._createSwappedMotion(
      MotionColor.RED,
      previousStep,
      sourceBlue
    );

    const actualStartPosition =
      getGridPositionFromLocations(
        blueMotion.startLocation,
        redMotion.startLocation
      );
    const actualEndPosition =
      getGridPositionFromLocations(
        blueMotion.endLocation,
        redMotion.endLocation
      );

    const newStep: StepData = {
      ...sourceStep,
      id: `step-${stepNumber}`,
      stepNumber,
      startPosition: actualStartPosition,
      endPosition: actualEndPosition,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
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

  private _createSwappedMotion(
    color: MotionColor,
    previousStep: StepData,
    matchingMotion: MotionData
  ): MotionData {
    const previousMotion = previousStep.motions[color];

    if (!previousMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    const startLocation = previousMotion.endLocation;
    const endLocation =
      matchingMotion.motionType === MotionType.STATIC
        ? startLocation
        : matchingMotion.endLocation;

    return {
      ...matchingMotion,
      color,
      startLocation,
      endLocation,
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const strictSwappedLOOPExecutor = new StrictSwappedLOOPExecutor();
