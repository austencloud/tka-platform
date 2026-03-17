/**
 * Strict Inverted LOOP Executor
 *
 * Uses inverted letters (opposite motion types: A<->B, D<->E, etc.)
 * Flips motion types (PRO <-> ANTI) and prop rotation directions (CW <-> CCW).
 * End position must equal start position (sequence returns to start).
 * Always halved (no quartering support).
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep, MotionData } from "../../core/types/sequence-engine-types.js";
import type { SliceSize } from "../loop-types.js";
import {
  INVERTED_LOOP_VALIDATION_SET,
  getInvertedLetter,
} from "../position-maps/strict-loop-position-maps.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class StrictInvertedExecutor implements ILOOPExecutor {
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

      const newStep = this.createInvertedStep(matchingStep, lastStep, stepNumber);
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
    if (!INVERTED_LOOP_VALIDATION_SET.has(key)) {
      throw new Error(
        `Invalid position pair for inverted LOOP: ${startPos} -> ${endPos}. ` +
          `For an inverted LOOP, the sequence must end at the same position it started (${startPos}).`
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

  private createInvertedStep(
    matchingStep: SequenceStep,
    previousStep: SequenceStep,
    stepNumber: number
  ): SequenceStep {
    const invertedLetter = getInvertedLetter(matchingStep.letter);

    return {
      ...matchingStep,
      stepNumber,
      beatIndex: stepNumber,
      letter: invertedLetter,
      startPosition: previousStep.endPosition,
      endPosition: matchingStep.endPosition, // Same as matching beat
      blueMotion: this.createInvertedMotion(
        matchingStep.blueMotion,
        previousStep.blueMotion
      ),
      redMotion: this.createInvertedMotion(
        matchingStep.redMotion,
        previousStep.redMotion
      ),
    };
  }

  private createInvertedMotion(
    matchingMotion: MotionData,
    previousMotion: MotionData
  ): MotionData {
    return {
      ...matchingMotion,
      motionType: invertMotionType(matchingMotion.motionType),
      startLocation: previousMotion.endLocation,
      endLocation: matchingMotion.endLocation, // Same as matching beat
      rotationDirection: flipRotationDirection(matchingMotion.rotationDirection),
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
