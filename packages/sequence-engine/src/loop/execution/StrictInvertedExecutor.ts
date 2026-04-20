/**
 * Strict Inverted LOOP Executor (engine version)
 *
 * Supports halved (period 2) and quartered (period 4). Period 4 requires
 * SequenceBuilder to enforce per-hand turn parity via
 * allocateTurns({enforcePeriod4Parity}).
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type {
  SequenceStep,
  MotionData,
} from "../../core/types/sequence-engine-types.js";
import { SliceSize } from "../loop-types.js";
import {
  INVERTED_LOOP_VALIDATION_SET,
  getInvertedLetter,
} from "../position-maps/strict-loop-position-maps.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class StrictInvertedExecutor implements ILOOPExecutor {
  executeLOOP(sequence: SequenceStep[], sliceSize: SliceSize): SequenceStep[] {
    this.validateSequence(sequence);

    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    const partialLength = sequence.length;
    const period = sliceSize === SliceSize.QUARTERED ? 4 : 2;
    const totalLength = partialLength * period;
    const beatsToGenerate = totalLength - partialLength;

    let lastStep = sequence[sequence.length - 1]!;
    const firstGeneratedStepNumber =
      (lastStep.stepNumber ?? lastStep.beatIndex) + 1;

    for (let offset = 0; offset < beatsToGenerate; offset++) {
      const stepNumber = firstGeneratedStepNumber + offset;
      const quarterIdx = Math.floor((stepNumber - 1) / partialLength);
      const sourceStepNumber = ((stepNumber - 1) % partialLength) + 1;
      const applyInversion = quarterIdx % 2 === 1;

      const sourceStep = sequence[sourceStepNumber - 1]!;

      const newStep = applyInversion
        ? this.createInvertedStep(sourceStep, lastStep, stepNumber)
        : this.createCopiedStep(sourceStep, lastStep, stepNumber);
      const finalStep = updateStepOrientations(newStep, lastStep);

      sequence.push(finalStep);
      lastStep = finalStep;
    }

    sequence.unshift(startPosition);
    return sequence;
  }

  private validateSequence(sequence: SequenceStep[]): void {
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
        `Invalid position pair for inverted LOOP: ${startPos} -> ${endPos}. ` +
          `For an inverted LOOP, the sequence must end at the same position it started (${startPos}).`
      );
    }
  }

  private createInvertedStep(
    sourceStep: SequenceStep,
    previousStep: SequenceStep,
    stepNumber: number
  ): SequenceStep {
    const invertedLetter = getInvertedLetter(sourceStep.letter);

    return {
      ...sourceStep,
      stepNumber,
      beatIndex: stepNumber,
      letter: invertedLetter,
      startPosition: previousStep.endPosition,
      endPosition: sourceStep.endPosition,
      blueMotion: this.createInvertedMotion(
        sourceStep.blueMotion,
        previousStep.blueMotion
      ),
      redMotion: this.createInvertedMotion(
        sourceStep.redMotion,
        previousStep.redMotion
      ),
    };
  }

  private createCopiedStep(
    sourceStep: SequenceStep,
    previousStep: SequenceStep,
    stepNumber: number
  ): SequenceStep {
    return {
      ...sourceStep,
      stepNumber,
      beatIndex: stepNumber,
      startPosition: previousStep.endPosition,
      endPosition: sourceStep.endPosition,
      blueMotion: {
        ...sourceStep.blueMotion,
        startLocation: previousStep.blueMotion.endLocation,
      },
      redMotion: {
        ...sourceStep.redMotion,
        startLocation: previousStep.redMotion.endLocation,
      },
    };
  }

  private createInvertedMotion(
    sourceMotion: MotionData,
    previousMotion: MotionData
  ): MotionData {
    return {
      ...sourceMotion,
      motionType: invertMotionType(sourceMotion.motionType),
      startLocation: previousMotion.endLocation,
      endLocation: sourceMotion.endLocation,
      rotationDirection: flipRotationDirection(sourceMotion.rotationDirection),
    };
  }
}

function invertMotionType(motionType: string): string {
  if (motionType === "pro") return "anti";
  if (motionType === "anti") return "pro";
  return motionType;
}

function flipRotationDirection(dir: string): string {
  if (dir === "cw") return "ccw";
  if (dir === "ccw") return "cw";
  return dir;
}

export const strictInvertedExecutor = new StrictInvertedExecutor();
