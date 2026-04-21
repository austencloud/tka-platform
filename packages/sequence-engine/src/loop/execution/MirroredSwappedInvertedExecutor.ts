/**
 * Mirrored Swapped Inverted LOOP Executor
 *
 * Combines MIRRORED + SWAPPED + INVERTED in a single transformation pass.
 * - Colors are swapped (Blue does Red's pattern, vice versa)
 * - Letters are flipped (A <-> B)
 * - Motion types are flipped (PRO <-> ANTI)
 * - Locations are mirrored vertically
 * - Rotation directions stay THE SAME (all three flips together preserve rotation)
 *
 * Always halved. End position must return to start.
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep, MotionData } from "../../core/types/sequence-engine-types.js";
import type { SliceSize } from "../loop-types.js";
import {
  INVERTED_LOOP_VALIDATION_SET,
  VERTICAL_MIRROR_POSITION_MAP,
  getInvertedLetter,
} from "../position-maps/strict-loop-position-maps.js";
import {
  getHandRotationDirection,
  getLocationMapForHandRotation,
  mirrorHandRotationDirection,
} from "../position-maps/circular-position-maps.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class MirroredSwappedInvertedExecutor implements ILOOPExecutor {
  executeLOOP(sequence: SequenceStep[], _sliceSize: SliceSize): SequenceStep[] {
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
      throw new Error(`Invalid position pair for mirrored-swapped-inverted LOOP: ${startPos} -> ${endPos}`);
    }
  }

  private getMatchingBeat(sequence: SequenceStep[], stepNumber: number, finalLength: number): SequenceStep {
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
      // SWAP: Blue follows Red's pattern, Red follows Blue's pattern
      motions: {
        blue: this.createMotion(previousStep.motions.blue, matchingStep.motions.red),
        red: this.createMotion(previousStep.motions.red, matchingStep.motions.blue),
      },
    };
  }

  private createMotion(previousMotion: MotionData, matchingMotion: MotionData): MotionData {
    const startLocation = previousMotion.endLocation;
    const invertedMotionType = invertMotionType(matchingMotion.motionType);

    // Derive end location from the seed's hand path direction, applied to
    // the new start location. Mirror flips hand direction (CW↔CCW), and
    // inversion also flips hand direction — they cancel out, so we preserve
    // the original seed direction. Without this correction, the double-flip
    // was being applied only once (mirror only), producing opposite-point
    // arc motions (e.g., pro e→w) that are physically impossible.
    let endLocation: string;
    if (matchingMotion.startLocation === matchingMotion.endLocation) {
      endLocation = startLocation;
    } else {
      const seedHandDir = getHandRotationDirection(
        matchingMotion.startLocation,
        matchingMotion.endLocation,
      );
      // Mirror + Invert both flip hand direction → they cancel → preserve original
      const locationMap = getLocationMapForHandRotation(seedHandDir);
      endLocation = locationMap[startLocation] || startLocation;
    }

    // Rotation direction stays the SAME (SWAP + INVERTED + MIRRORED together preserve rotation)
    return {
      ...matchingMotion,
      motionType: (invertedMotionType) as MotionData["motionType"],
      startLocation: startLocation as MotionData["startLocation"],
      endLocation: endLocation as MotionData["endLocation"],
      rotationDirection: (matchingMotion.rotationDirection) as MotionData["rotationDirection"],
    };
  }
}

function invertMotionType(t: string): string {
  if (t === "pro") return "anti";
  if (t === "anti") return "pro";
  return t;
}

export const mirroredSwappedInvertedExecutor = new MirroredSwappedInvertedExecutor();
