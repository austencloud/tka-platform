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
    const stepsToGenerate = totalLength - partialLength;

    let lastStep = sequence[sequence.length - 1]!;
    const firstGeneratedStepNumber =
      (lastStep.stepNumber ?? lastStep.stepNumber) + 1;

    for (let offset = 0; offset < stepsToGenerate; offset++) {
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
      HORIZONTAL_MIRROR_POSITION_MAP[sourceStep.endPosition ?? ""] ||
      sourceStep.endPosition;

    return {
      ...sourceStep,
      stepNumber,
      startPosition: (previousStep.endPosition) as SequenceStep["startPosition"],
      endPosition: (flippedEndPosition) as SequenceStep["endPosition"],
      motions: {
        blue: this.createFlippedMotion(
        sourceStep.motions.blue,
        previousStep.motions.blue
      ),
        red: this.createFlippedMotion(
        sourceStep.motions.red,
        previousStep.motions.red
      ),
      },
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
      startPosition: (previousStep.endPosition) as SequenceStep["startPosition"],
      endPosition: (sourceStep.endPosition) as SequenceStep["endPosition"],
      motions: {
        blue: {
        ...sourceStep.motions.blue,
        startLocation: (previousStep.motions.blue.endLocation) as MotionData["startLocation"],
      },
        red: {
        ...sourceStep.motions.red,
        startLocation: (previousStep.motions.red.endLocation) as MotionData["startLocation"],
      },
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
      startLocation: (previousMotion.endLocation) as MotionData["startLocation"],
      endLocation: (flippedEndLocation) as MotionData["endLocation"],
      rotationDirection: (flippedRotDir) as MotionData["rotationDirection"],
    };
  }
}

function flipRotationDirection(dir: string): string {
  if (dir === "cw") return "ccw";
  if (dir === "ccw") return "cw";
  return dir;
}

export const strictFlippedExecutor = new StrictFlippedExecutor();
