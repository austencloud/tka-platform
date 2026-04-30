/**
 * Mirrored Inverted LOOP Executor
 *
 * Combines MIRRORED (mirror locations E<->W) with INVERTED (flip motion types PRO<->ANTI).
 * Rotation direction stays THE SAME (both transformations flip rotation, so they cancel out).
 * Always halved.
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep, MotionData } from "../../core/types/sequence-engine-types.js";
import type { Period } from "../loop-types.js";
import {
  MIRRORED_INVERTED_VALIDATION_SET,
  VERTICAL_MIRROR_POSITION_MAP,
  getInvertedLetter,
} from "../position-maps/strict-loop-position-maps.js";
import {
  getHandRotationDirection,
  getLocationMapForHandRotation,
  mirrorHandRotationDirection,
} from "../position-maps/circular-position-maps.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class MirroredInvertedExecutor implements ILOOPExecutor {
  executeLOOP(sequence: SequenceStep[], _period: Period): SequenceStep[] {
    this.validateSequence(sequence);

    const startPosition = sequence.shift();
    if (!startPosition) throw new Error("Sequence must have a start position");

    const sequenceLength = sequence.length;
    const entriesToAdd = sequenceLength;

    let lastStep = sequence[sequence.length - 1]!;
    const nextStepNumber = (lastStep.stepNumber ?? lastStep.stepNumber) + 1;

    for (let i = 2; i < sequenceLength + 2; i++) {
      const finalIntendedLength = sequenceLength + entriesToAdd;
      const stepNumber = nextStepNumber + i - 2;
      const matchingStep = this.getMatchingStep(sequence, stepNumber, finalIntendedLength);

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
    if (!MIRRORED_INVERTED_VALIDATION_SET.has(key)) {
      throw new Error(`Invalid position pair for mirrored-inverted LOOP: ${startPos} -> ${endPos}`);
    }
  }

  private getMatchingStep(sequence: SequenceStep[], stepNumber: number, finalLength: number): SequenceStep {
    const halfLength = Math.floor(finalLength / 2);
    const idx = stepNumber - halfLength - 1;
    if (idx < 0 || idx >= sequence.length) throw new Error(`Invalid index: ${idx}`);
    return sequence[idx]!;
  }

  private createStep(matchingStep: SequenceStep, previousStep: SequenceStep, stepNumber: number): SequenceStep {
    const invertedLetter = getInvertedLetter(matchingStep.letter ?? "");
    const mirroredEndPosition =
      VERTICAL_MIRROR_POSITION_MAP[matchingStep.endPosition ?? ""] || matchingStep.endPosition;

    return {
      ...matchingStep,
      stepNumber,
      letter: (invertedLetter) as SequenceStep["letter"],
      startPosition: (previousStep.endPosition) as SequenceStep["startPosition"],
      endPosition: (mirroredEndPosition) as SequenceStep["endPosition"],
      motions: {
        blue: this.createMotion(matchingStep.motions.blue, previousStep.motions.blue),
        red: this.createMotion(matchingStep.motions.red, previousStep.motions.red),
      },
    };
  }

  private createMotion(matchingMotion: MotionData, previousMotion: MotionData): MotionData {
    const startLocation = previousMotion.endLocation;
    const invertedMotionType = invertMotionType(matchingMotion.motionType);
    // Rotation direction stays the SAME (mirror flip + invert flip = cancel)
    const rotationDirection = matchingMotion.rotationDirection;

    // Calculate end location by preserving the MIRRORED hand path direction
    // from the seed step, applied to the current start location.
    // Previously this used a direct mirror of the seed's endLocation, which
    // decoupled the end from the start and could produce opposite-point
    // arc motions (e.g., pro e→w) — physically impossible in TKA.
    let endLocation: string;
    if (matchingMotion.startLocation === matchingMotion.endLocation) {
      // Static: end = start
      endLocation = startLocation;
    } else {
      const seedHandDir = getHandRotationDirection(
        matchingMotion.startLocation,
        matchingMotion.endLocation,
      );
      const mirroredDir = mirrorHandRotationDirection(seedHandDir);
      const locationMap = getLocationMapForHandRotation(mirroredDir);
      endLocation = locationMap[startLocation] || startLocation;
    }

    return {
      ...matchingMotion,
      motionType: (invertedMotionType) as MotionData["motionType"],
      startLocation: startLocation as MotionData["startLocation"],
      endLocation: endLocation as MotionData["endLocation"],
      rotationDirection: rotationDirection as MotionData["rotationDirection"],
    };
  }
}

function invertMotionType(t: string): string {
  if (t === "pro") return "anti";
  if (t === "anti") return "pro";
  return t;
}

export const mirroredInvertedExecutor = new MirroredInvertedExecutor();
