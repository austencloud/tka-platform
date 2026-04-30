/**
 * Rotated Swapped LOOP Executor
 *
 * Combines SWAPPED (blue<->red) with ROTATED (rotate locations by handpath).
 * Supports both halved (period 2) and quartered (period 4).
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep, MotionData } from "../../core/types/sequence-engine-types.js";
import { Period } from "../loop-types.js";
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
  getHandRotationDirection,
  getLocationMapForHandRotation,
} from "../position-maps/circular-position-maps.js";
import { gridPositionDeriver } from "../../core/positions/GridPositionDeriver.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class RotatedSwappedExecutor implements ILOOPExecutor {
  executeLOOP(sequence: SequenceStep[], period: Period): SequenceStep[] {
    this.validateSequence(sequence, period);

    const startPosition = sequence.shift();
    if (!startPosition) throw new Error("Sequence must have a start position");

    const sequenceLength = sequence.length;
    const entriesToAdd =
      period === Period.QUARTERED ? sequenceLength * 3 : sequenceLength;

    let lastStep = sequence[sequence.length - 1]!;
    let nextStepNumber = (lastStep.stepNumber ?? lastStep.stepNumber) + 1;
    const finalIntendedLength = sequenceLength + entriesToAdd;

    for (let i = 0; i < entriesToAdd; i++) {
      const matchingStep = this.getMatchingStep(sequence, nextStepNumber, finalIntendedLength, period);
      const newStep = this.createStep(matchingStep, lastStep, nextStepNumber);
      const finalStep = updateStepOrientations(newStep, lastStep);
      sequence.push(finalStep);
      lastStep = finalStep;
      nextStepNumber++;
    }

    sequence.unshift(startPosition);
    return sequence;
  }

  private validateSequence(sequence: SequenceStep[], period: Period): void {
    if (sequence.length < 2) throw new Error("Sequence must have at least 2 steps");
    const startPos = sequence[0]!.startPosition;
    const endPos = sequence[sequence.length - 1]!.endPosition;
    if (!startPos || !endPos) throw new Error("Sequence steps must have valid positions");
    const key = `${startPos},${endPos}`;
    const validationSet = period === Period.QUARTERED ? QUARTERED_LOOPS : HALVED_LOOPS;
    if (!validationSet.has(key)) {
      throw new Error(`Invalid position pair for rotated-swapped ${period} LOOP: ${startPos} -> ${endPos}`);
    }
  }

  private getMatchingStep(sequence: SequenceStep[], stepNumber: number, finalLength: number, period: Period): SequenceStep {
    const sliceLength = period === Period.QUARTERED
      ? Math.floor(finalLength / 4)
      : Math.floor(finalLength / 2);
    const matchingStepNumber = stepNumber > sliceLength ? stepNumber - sliceLength : stepNumber;
    const idx = matchingStepNumber - 1;
    if (idx < 0 || idx >= sequence.length) throw new Error(`Invalid index: ${idx}`);
    return sequence[idx]!;
  }

  private createStep(matchingStep: SequenceStep, previousStep: SequenceStep, stepNumber: number): SequenceStep {
    // Rotation uses OPPOSITE color's handpath (due to swap)
    const blueHandRotDir = getHandRotationDirection(
      matchingStep.motions.red.startLocation, matchingStep.motions.red.endLocation
    );
    const redHandRotDir = getHandRotationDirection(
      matchingStep.motions.blue.startLocation, matchingStep.motions.blue.endLocation
    );

    const blueLocationMap = getLocationMapForHandRotation(blueHandRotDir);
    const redLocationMap = getLocationMapForHandRotation(redHandRotDir);

    const newBlueEndLoc = blueLocationMap[previousStep.motions.blue.endLocation] || previousStep.motions.blue.endLocation;
    const newRedEndLoc = redLocationMap[previousStep.motions.red.endLocation] || previousStep.motions.red.endLocation;

    const newEndPosition = gridPositionDeriver.getGridPositionFromLocations(newBlueEndLoc, newRedEndLoc);

    return {
      ...matchingStep,
      stepNumber,
      startPosition: (previousStep.endPosition) as SequenceStep["startPosition"],
      endPosition: (newEndPosition) as SequenceStep["endPosition"],
      // SWAP: Blue follows Red's pattern, Red follows Blue's pattern
      motions: {
        blue: this.createMotion(previousStep.motions.blue, matchingStep.motions.red),
        red: this.createMotion(previousStep.motions.red, matchingStep.motions.blue),
      },
    };
  }

  private createMotion(previousMotion: MotionData, matchingMotion: MotionData): MotionData {
    const startLocation = previousMotion.endLocation;
    const handRotDir = getHandRotationDirection(matchingMotion.startLocation, matchingMotion.endLocation);
    const locationMap = getLocationMapForHandRotation(handRotDir);
    const endLocation =
      matchingMotion.motionType === "static"
        ? startLocation
        : (locationMap[startLocation] || startLocation);

    return {
      ...matchingMotion,
      startLocation: startLocation as MotionData["startLocation"],
      endLocation: endLocation as MotionData["endLocation"],
      rotationDirection: (matchingMotion.rotationDirection) as MotionData["rotationDirection"],
    };
  }
}

export const rotatedSwappedExecutor = new RotatedSwappedExecutor();
