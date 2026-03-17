/**
 * Strict Flipped LOOP Executor
 *
 * Flips positions and locations horizontally (north/south swap).
 * Flips prop rotation directions (CW <-> CCW).
 * Always halved (no quartering support).
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep, MotionData } from "../../core/types/sequence-engine-types.js";
import type { SliceSize } from "../loop-types.js";
import {
  HORIZONTAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_LOCATION_MAP,
  FLIPPED_LOOP_VALIDATION_SET,
} from "../position-maps/strict-loop-position-maps.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class StrictFlippedExecutor implements ILOOPExecutor {
  executeLOOP(sequence: SequenceStep[], _sliceSize: SliceSize): SequenceStep[] {
    this.validateSequence(sequence);

    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    const sequenceLength = sequence.length;
    const entriesToAdd = sequenceLength;

    let lastStep = sequence[sequence.length - 1]!;
    const nextStepNumber = (lastStep.stepNumber ?? lastStep.beatIndex) + 1;

    for (let i = 2; i < sequenceLength + 2; i++) {
      const finalIntendedLength = sequenceLength + entriesToAdd;
      const stepNumber = nextStepNumber + i - 2;

      const matchingStep = this.getPreviousMatchingBeat(
        sequence,
        stepNumber,
        finalIntendedLength
      );

      const newStep = this.createFlippedStep(matchingStep, lastStep, stepNumber);
      const finalStep = updateStepOrientations(newStep, lastStep);

      sequence.push(finalStep);
      lastStep = finalStep;
    }

    sequence.unshift(startPosition);
    return sequence;
  }

  private validateSequence(sequence: SequenceStep[]): void {
    if (sequence.length < 2) {
      throw new Error("Sequence must have at least 2 steps (start position + 1 beat)");
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

  private getPreviousMatchingBeat(
    sequence: SequenceStep[],
    stepNumber: number,
    finalLength: number
  ): SequenceStep {
    const halfLength = Math.floor(finalLength / 2);
    const matchingStepNumber = stepNumber - halfLength;
    const arrayIndex = matchingStepNumber - 1;

    if (arrayIndex < 0 || arrayIndex >= sequence.length) {
      throw new Error(
        `Invalid index mapping: stepNumber ${stepNumber} -> arrayIndex ${arrayIndex}`
      );
    }

    return sequence[arrayIndex]!;
  }

  private createFlippedStep(
    matchingStep: SequenceStep,
    previousStep: SequenceStep,
    stepNumber: number
  ): SequenceStep {
    const flippedEndPosition =
      HORIZONTAL_MIRROR_POSITION_MAP[matchingStep.endPosition] || matchingStep.endPosition;

    return {
      ...matchingStep,
      stepNumber,
      beatIndex: stepNumber,
      startPosition: previousStep.endPosition,
      endPosition: flippedEndPosition,
      blueMotion: this.createFlippedMotion(
        matchingStep.blueMotion,
        previousStep.blueMotion
      ),
      redMotion: this.createFlippedMotion(
        matchingStep.redMotion,
        previousStep.redMotion
      ),
    };
  }

  private createFlippedMotion(
    matchingMotion: MotionData,
    previousMotion: MotionData
  ): MotionData {
    const flippedEndLocation =
      HORIZONTAL_MIRROR_LOCATION_MAP[matchingMotion.endLocation] ||
      matchingMotion.endLocation;

    const flippedRotDir = flipRotationDirection(matchingMotion.rotationDirection);

    return {
      ...matchingMotion,
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
