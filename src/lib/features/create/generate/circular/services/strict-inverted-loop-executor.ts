/**
 * Strict Inverted LOOP Executor
 *
 * Supports both halved (period 2) and quartered (period 4) inverted LOOPs.
 *
 * Inverted is the pro↔anti and CW↔CCW flip. Positions stay the same (start
 * and end positions equal). Period 2 applies one inversion; period 4 applies
 * two inversions with orientation evolving between, matching the structure
 * in StrictMirroredLOOPExecutor.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import {
  MotionType,
  MotionColor,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  updateStartOrientations,
  updateEndOrientations,
} from "$lib/shared/pictograph/prop/services/orientation-calculator";
import {
  INVERTED_LOOP_VALIDATION_SET,
  getInvertedLetter,
} from "../domain/constants/strict-loop-position-maps";
import { Period } from "../domain/models/circular-models";

export class StrictInvertedLOOPExecutor {
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
      const applyInversion = quarterIdx % 2 === 1;

      const sourceStep = sequence[sourceStepNumber - 1]!;

      const newStep = applyInversion
        ? this._createInvertedEntry(sourceStep, lastStep, stepNumber)
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

    if (!INVERTED_LOOP_VALIDATION_SET.has(key)) {
      throw new Error(
        `Invalid position pair for inverted LOOP: ${startPos} → ${endPos}. ` +
          `For an inverted LOOP, the sequence must end at the same position it started (${startPos}).`
      );
    }
  }

  private _createInvertedEntry(
    sourceStep: StepData,
    previousStep: StepData,
    stepNumber: number
  ): StepData {
    const invertedLetter = this._getInvertedLetter(sourceStep);

    const newStep: StepData = {
      ...sourceStep,
      id: `step-${stepNumber}`,
      stepNumber,
      letter: invertedLetter,
      startPosition: previousStep.endPosition ?? null,
      endPosition: sourceStep.endPosition ?? null,
      motions: {
        [MotionColor.BLUE]: this._createInvertedMotion(
          MotionColor.BLUE,
          previousStep,
          sourceStep
        ),
        [MotionColor.RED]: this._createInvertedMotion(
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

  private _getInvertedLetter(sourceStep: StepData): Letter {
    const letter = sourceStep.letter;
    if (!letter) {
      throw new Error("Source step must have a letter");
    }
    return getInvertedLetter(letter as string) as Letter;
  }

  private _createInvertedMotion(
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
      motionType: this._getInvertedMotionType(
        sourceMotion.motionType as MotionType
      ),
      startLocation: previousMotion.endLocation,
      endLocation: sourceMotion.endLocation,
      rotationDirection: this._getInvertedPropRotDir(
        sourceMotion.rotationDirection as RotationDirection
      ),
    };
  }

  private _getInvertedMotionType(motionType: MotionType): MotionType {
    if (motionType === MotionType.PRO) return MotionType.ANTI;
    if (motionType === MotionType.ANTI) return MotionType.PRO;
    return motionType;
  }

  private _getInvertedPropRotDir(
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
export const strictInvertedLOOPExecutor = new StrictInvertedLOOPExecutor();
