/**
 * Rotated Inverted LOOP Executor
 *
 * Combines ROTATED (rotate locations by handpath) with INVERTED (flip letters, motion types, rotation).
 * Supports both halved and quartered slice sizes.
 * Colors are NOT swapped.
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep, MotionData } from "../../core/types/sequence-engine-types.js";
import { SliceSize } from "../loop-types.js";
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
  getHandRotationDirection,
  getLocationMapForHandRotation,
} from "../position-maps/circular-position-maps.js";
import { gridPositionDeriver } from "../../core/positions/GridPositionDeriver.js";
import { getInvertedLetter } from "../position-maps/strict-loop-position-maps.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class RotatedInvertedExecutor implements ILOOPExecutor {
  executeLOOP(sequence: SequenceStep[], sliceSize: SliceSize): SequenceStep[] {
    this.validateSequence(sequence, sliceSize);

    const startPosition = sequence.shift();
    if (!startPosition) throw new Error("Sequence must have a start position");

    const sequenceLength = sequence.length;
    const entriesToAdd =
      sliceSize === SliceSize.QUARTERED ? sequenceLength * 3 : sequenceLength;

    let lastStep = sequence[sequence.length - 1]!;
    let nextStepNumber = (lastStep.stepNumber ?? lastStep.stepNumber) + 1;
    const finalIntendedLength = sequenceLength + entriesToAdd;

    for (let i = 0; i < entriesToAdd; i++) {
      const matchingStep = this.getMatchingBeat(sequence, nextStepNumber, finalIntendedLength, sliceSize);
      const newStep = this.createStep(matchingStep, lastStep, nextStepNumber);
      const finalStep = updateStepOrientations(newStep, lastStep);
      sequence.push(finalStep);
      lastStep = finalStep;
      nextStepNumber++;
    }

    sequence.unshift(startPosition);
    return sequence;
  }

  private validateSequence(sequence: SequenceStep[], sliceSize: SliceSize): void {
    if (sequence.length < 2) throw new Error("Sequence must have at least 2 steps");
    const startPos = sequence[0]!.startPosition;
    const endPos = sequence[sequence.length - 1]!.endPosition;
    if (!startPos || !endPos) throw new Error("Sequence steps must have valid positions");
    const key = `${startPos},${endPos}`;
    const validationSet = sliceSize === SliceSize.QUARTERED ? QUARTERED_LOOPS : HALVED_LOOPS;
    if (!validationSet.has(key)) {
      throw new Error(`Invalid position pair for rotated-inverted ${sliceSize} LOOP: ${startPos} -> ${endPos}`);
    }
  }

  private getMatchingBeat(sequence: SequenceStep[], stepNumber: number, finalLength: number, sliceSize: SliceSize): SequenceStep {
    const sliceLength = sliceSize === SliceSize.QUARTERED
      ? Math.floor(finalLength / 4)
      : Math.floor(finalLength / 2);
    const matchingStepNumber = stepNumber > sliceLength ? stepNumber - sliceLength : stepNumber;
    const idx = matchingStepNumber - 1;
    if (idx < 0 || idx >= sequence.length) throw new Error(`Invalid index: ${idx}`);
    return sequence[idx]!;
  }

  private createStep(matchingStep: SequenceStep, previousStep: SequenceStep, stepNumber: number): SequenceStep {
    const invertedLetter = getInvertedLetter(matchingStep.letter ?? "");

    // Same color (no swap) - get rotation from same color's handpath
    const blueHandRotDir = getHandRotationDirection(
      matchingStep.motions.blue.startLocation, matchingStep.motions.blue.endLocation
    );
    const redHandRotDir = getHandRotationDirection(
      matchingStep.motions.red.startLocation, matchingStep.motions.red.endLocation
    );

    const blueLocationMap = getLocationMapForHandRotation(blueHandRotDir);
    const redLocationMap = getLocationMapForHandRotation(redHandRotDir);

    const newBlueEndLoc = blueLocationMap[previousStep.motions.blue.endLocation] || previousStep.motions.blue.endLocation;
    const newRedEndLoc = redLocationMap[previousStep.motions.red.endLocation] || previousStep.motions.red.endLocation;

    const newEndPosition = gridPositionDeriver.getGridPositionFromLocations(newBlueEndLoc, newRedEndLoc);

    return {
      ...matchingStep,
      stepNumber,
      letter: (invertedLetter) as SequenceStep["letter"],
      startPosition: (previousStep.endPosition) as SequenceStep["startPosition"],
      endPosition: (newEndPosition) as SequenceStep["endPosition"],
      motions: {
        blue: this.createMotion(matchingStep.motions.blue, previousStep.motions.blue, newBlueEndLoc),
        red: this.createMotion(matchingStep.motions.red, previousStep.motions.red, newRedEndLoc),
      },
    };
  }

  private createMotion(matchingMotion: MotionData, previousMotion: MotionData, rotatedEndLoc: string): MotionData {
    return {
      ...matchingMotion,
      motionType: (invertMotionType(matchingMotion.motionType)) as MotionData["motionType"],
      startLocation: (previousMotion.endLocation) as MotionData["startLocation"],
      endLocation: (rotatedEndLoc) as MotionData["endLocation"],
      rotationDirection: (flipRotDir(matchingMotion.rotationDirection)) as MotionData["rotationDirection"],
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

export const rotatedInvertedExecutor = new RotatedInvertedExecutor();
