/**
 * Swapped Inverted LOOP Executor
 *
 * Combines SWAPPED (blue<->red) with INVERTED (flip letters, motion types, rotation).
 * End position must equal start position.
 * Always halved.
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep, MotionData } from "../../core/types/sequence-engine-types.js";
import type { SliceSize } from "../loop-types.js";
import {
  INVERTED_LOOP_VALIDATION_SET,
  SWAPPED_POSITION_MAP,
  getInvertedLetter,
} from "../position-maps/strict-loop-position-maps.js";
import {
  getHandRotationDirection,
  getLocationMapForHandRotation,
  mirrorHandRotationDirection,
} from "../position-maps/circular-position-maps.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class SwappedInvertedExecutor implements ILOOPExecutor {
  executeLOOP(sequence: SequenceStep[], _sliceSize: SliceSize): SequenceStep[] {
    this.validateSequence(sequence);

    const startPosition = sequence.shift();
    if (!startPosition) throw new Error("Sequence must have a start position");

    const sequenceLength = sequence.length;
    const entriesToAdd = sequenceLength;

    let lastStep = sequence[sequence.length - 1]!;
    const nextStepNumber = (lastStep.stepNumber ?? lastStep.beatIndex) + 1;

    for (let i = 2; i < sequenceLength + 2; i++) {
      const finalIntendedLength = sequenceLength + entriesToAdd;
      const stepNumber = nextStepNumber + i - 2;
      const matchingStep = this.getMatchingBeat(sequence, stepNumber, finalIntendedLength);

      const newStep = this.createStep(matchingStep, lastStep, stepNumber);
      const finalStep = updateStepOrientations(newStep, lastStep);
      sequence.push(finalStep);
      lastStep = finalStep;
    }

    sequence.unshift(startPosition);
    return sequence;
  }

  private validateSequence(sequence: SequenceStep[]): void {
    if (sequence.length < 2) throw new Error("Sequence must have at least 2 steps");
    const startPos = sequence[0]!.startPosition;
    const endPos = sequence[sequence.length - 1]!.endPosition;
    if (!startPos || !endPos) throw new Error("Sequence steps must have valid positions");
    const key = `${startPos},${endPos}`;
    if (!INVERTED_LOOP_VALIDATION_SET.has(key)) {
      throw new Error(`Invalid position pair for swapped-inverted LOOP: ${startPos} -> ${endPos}`);
    }
  }

  private getMatchingBeat(sequence: SequenceStep[], stepNumber: number, finalLength: number): SequenceStep {
    const halfLength = Math.floor(finalLength / 2);
    const idx = stepNumber - halfLength - 1;
    if (idx < 0 || idx >= sequence.length) throw new Error(`Invalid index: ${idx}`);
    return sequence[idx]!;
  }

  private createStep(matchingStep: SequenceStep, previousStep: SequenceStep, stepNumber: number): SequenceStep {
    const invertedLetter = getInvertedLetter(matchingStep.letter);
    const swappedEndPosition = SWAPPED_POSITION_MAP[matchingStep.endPosition] || matchingStep.endPosition;

    return {
      ...matchingStep,
      stepNumber,
      beatIndex: stepNumber,
      letter: invertedLetter,
      startPosition: previousStep.endPosition,
      endPosition: swappedEndPosition,
      // SWAP: Blue gets Red's pattern (inverted), Red gets Blue's pattern (inverted)
      blueMotion: this.createMotion(previousStep.blueMotion, matchingStep.redMotion),
      redMotion: this.createMotion(previousStep.redMotion, matchingStep.blueMotion),
    };
  }

  private createMotion(previousMotion: MotionData, matchingMotion: MotionData): MotionData {
    const startLocation = previousMotion.endLocation;
    const invertedMotionType = invertMotionType(matchingMotion.motionType);
    const invertedRotDir = flipRotDir(matchingMotion.rotationDirection);

    // Derive end location from the seed's hand path direction, applied to
    // the new start location. Inversion flips rotation direction, which also
    // flips the hand's travel direction around the grid. Without this,
    // the swapped motion's end location comes from the other hand's geometry
    // and can land at an opposite grid point (e.g. pro e→w), which is
    // physically impossible for arc motions.
    let endLocation: string;
    if (matchingMotion.startLocation === matchingMotion.endLocation) {
      endLocation = startLocation;
    } else {
      const seedHandDir = getHandRotationDirection(
        matchingMotion.startLocation,
        matchingMotion.endLocation,
      );
      // Inversion flips the hand path direction (CW↔CCW)
      const invertedDir = mirrorHandRotationDirection(seedHandDir);
      const locationMap = getLocationMapForHandRotation(invertedDir);
      endLocation = locationMap[startLocation] || startLocation;
    }

    return {
      ...matchingMotion,
      motionType: invertedMotionType,
      startLocation,
      endLocation,
      rotationDirection: invertedRotDir,
    };
  }
}

function invertMotionType(t: string): string {
  if (t === "pro") return "anti";
  if (t === "anti") return "pro";
  return t;
}

function flipRotDir(d: string): string {
  if (d === "cw") return "ccw";
  if (d === "ccw") return "cw";
  return d;
}

export const swappedInvertedExecutor = new SwappedInvertedExecutor();
