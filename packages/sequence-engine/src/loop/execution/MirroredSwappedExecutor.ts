/**
 * Mirrored Swapped LOOP Executor
 *
 * Combines SWAPPED (blue does red's pattern, red does blue's) with
 * MIRRORED (mirror locations vertically E<->W, flip rotation CW<->CCW).
 * Always halved.
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep, MotionData } from "../../core/types/sequence-engine-types.js";
import type { Period } from "../loop-types.js";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  SWAPPED_POSITION_MAP,
  MIRRORED_SWAPPED_VALIDATION_SET,
} from "../position-maps/strict-loop-position-maps.js";
import {
  getHandRotationDirection,
  getLocationMapForHandRotation,
  mirrorHandRotationDirection,
} from "../position-maps/circular-position-maps.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class MirroredSwappedExecutor implements ILOOPExecutor {
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
    if (!MIRRORED_SWAPPED_VALIDATION_SET.has(key)) {
      throw new Error(`Invalid position pair for mirrored-swapped LOOP: ${startPos} -> ${endPos}`);
    }
  }

  private getMatchingStep(sequence: SequenceStep[], stepNumber: number, finalLength: number): SequenceStep {
    const halfLength = Math.floor(finalLength / 2);
    const idx = stepNumber - halfLength - 1;
    if (idx < 0 || idx >= sequence.length) throw new Error(`Invalid index: ${idx}`);
    return sequence[idx]!;
  }

  private createStep(matchingStep: SequenceStep, previousStep: SequenceStep, stepNumber: number): SequenceStep {
    // Mirror then swap the end position
    const mirroredPos = VERTICAL_MIRROR_POSITION_MAP[matchingStep.endPosition ?? ""] || matchingStep.endPosition;
    const mirroredSwappedEndPosition = SWAPPED_POSITION_MAP[mirroredPos ?? ""] || mirroredPos;

    return {
      ...matchingStep,
      stepNumber,
      startPosition: (previousStep.endPosition) as SequenceStep["startPosition"],
      endPosition: (mirroredSwappedEndPosition) as SequenceStep["endPosition"],
      // SWAP: Blue does what Red did (mirrored), Red does what Blue did (mirrored)
      motions: {
        blue: this.createMotion(previousStep.motions.blue, matchingStep.motions.red),
        red: this.createMotion(previousStep.motions.red, matchingStep.motions.blue),
      },
    };
  }

  private createMotion(previousMotion: MotionData, matchingMotion: MotionData): MotionData {
    const startLocation = previousMotion.endLocation;
    const mirroredRotDir = flipRotDir(matchingMotion.rotationDirection);

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
      startLocation: startLocation as MotionData["startLocation"],
      endLocation: endLocation as MotionData["endLocation"],
      rotationDirection: (mirroredRotDir) as MotionData["rotationDirection"],
    };
  }
}

function flipRotDir(dir: string): string {
  if (dir === "cw") return "ccw";
  if (dir === "ccw") return "cw";
  return dir;
}

export const mirroredSwappedExecutor = new MirroredSwappedExecutor();
