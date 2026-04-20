/**
 * Strict Flipped LOOP Executor (engine version)
 *
 * Supports halved (period 2) and quartered (period 4). Period 4 needs the
 * partial's per-hand wheel-quarter total ≡ 1 or 3 (mod 4) — enforced by
 * SequenceBuilder via allocateTurns({enforcePeriod4Parity}).
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type {
  SequenceStep,
  MotionData,
} from "../../core/types/sequence-engine-types.js";
import { SliceSize } from "../loop-types.js";
import {
  HORIZONTAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_LOCATION_MAP,
  FLIPPED_LOOP_VALIDATION_SET,
} from "../position-maps/strict-loop-position-maps.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class StrictFlippedExecutor implements ILOOPExecutor {
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
      const applyFlip = quarterIdx % 2 === 1;

      const sourceStep = sequence[sourceStepNumber - 1]!;

      const newStep = applyFlip
        ? this.createFlippedStep(sourceStep, lastStep, stepNumber)
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
    if (!FLIPPED_LOOP_VALIDATION_SET.has(key)) {
      const expectedEnd = HORIZONTAL_MIRROR_POSITION_MAP[startPos];
      throw new Error(
        `Invalid position pair for flipped LOOP: ${startPos} -> ${endPos}. ` +
          `For a flipped LOOP from ${startPos}, the sequence must end at ${expectedEnd}.`
      );
    }
  }

  private createFlippedStep(
    sourceStep: SequenceStep,
    previousStep: SequenceStep,
    stepNumber: number
  ): SequenceStep {
    const flippedEndPosition =
      HORIZONTAL_MIRROR_POSITION_MAP[sourceStep.endPosition] ||
      sourceStep.endPosition;

    return {
      ...sourceStep,
      stepNumber,
      beatIndex: stepNumber,
      startPosition: previousStep.endPosition,
      endPosition: flippedEndPosition,
      blueMotion: this.createFlippedMotion(
        sourceStep.blueMotion,
        previousStep.blueMotion
      ),
      redMotion: this.createFlippedMotion(
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

  private createFlippedMotion(
    sourceMotion: MotionData,
    previousMotion: MotionData
  ): MotionData {
    const flippedEndLocation =
      HORIZONTAL_MIRROR_LOCATION_MAP[sourceMotion.endLocation] ||
      sourceMotion.endLocation;

    const flippedRotDir = flipRotationDirection(sourceMotion.rotationDirection);

    return {
      ...sourceMotion,
      startLocation: previousMotion.endLocation,
      endLocation: flippedEndLocation,
      rotationDirection: flippedRotDir,
    };
  }
}

function flipRotationDirection(dir: string): string {
  if (dir === "cw") return "ccw";
  if (dir === "ccw") return "cw";
  return dir;
}

export const strictFlippedExecutor = new StrictFlippedExecutor();
