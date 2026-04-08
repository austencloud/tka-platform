/**
 * Strict Swapped LOOP Executor
 *
 * Swaps blue and red motion attributes. Blue does what Red did, Red does what Blue did.
 * Positions are transformed according to the swap map.
 * Always halved (no quartering support).
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep, MotionData } from "../../core/types/sequence-engine-types.js";
import type { SliceSize } from "../loop-types.js";
import {
  SWAPPED_POSITION_MAP,
  SWAPPED_LOOP_VALIDATION_SET,
} from "../position-maps/strict-loop-position-maps.js";
import {
  getHandRotationDirection,
  getLocationMapForHandRotation,
} from "../position-maps/circular-position-maps.js";
import { gridPositionDeriver } from "../../core/positions/GridPositionDeriver.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class StrictSwappedExecutor implements ILOOPExecutor {
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

      const newStep = this.createSwappedStep(matchingStep, lastStep, stepNumber);
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
    if (!SWAPPED_LOOP_VALIDATION_SET.has(key)) {
      const expectedEnd = SWAPPED_POSITION_MAP[startPos];
      throw new Error(
        `Invalid position pair for swapped LOOP: ${startPos} -> ${endPos}. ` +
          `For a swapped LOOP from ${startPos}, the sequence must end at ${expectedEnd}.`
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

  private createSwappedStep(
    matchingStep: SequenceStep,
    previousStep: SequenceStep,
    stepNumber: number
  ): SequenceStep {
    // Swap: Blue gets Red's pattern, Red gets Blue's pattern
    const blueMotion = this.createSwappedMotion(
      previousStep.blueMotion,
      matchingStep.redMotion // Use RED from matching beat for BLUE
    );
    const redMotion = this.createSwappedMotion(
      previousStep.redMotion,
      matchingStep.blueMotion // Use BLUE from matching beat for RED
    );

    // Derive actual grid positions from hand locations
    const actualStartPosition = gridPositionDeriver.getGridPositionFromLocations(
      blueMotion.startLocation,
      redMotion.startLocation
    );
    const actualEndPosition = gridPositionDeriver.getGridPositionFromLocations(
      blueMotion.endLocation,
      redMotion.endLocation
    );

    return {
      ...matchingStep,
      stepNumber,
      beatIndex: stepNumber,
      startPosition: actualStartPosition,
      endPosition: actualEndPosition,
      blueMotion,
      redMotion,
    };
  }

  private createSwappedMotion(
    previousMotion: MotionData,
    matchingMotion: MotionData // From the OPPOSITE color in the matching beat
  ): MotionData {
    const startLocation = previousMotion.endLocation;

    // Derive end location from the seed's hand path direction, applied to
    // the new start location. Previously this used matchingMotion.endLocation
    // directly, which decoupled the end from the start and could produce
    // physically impossible arcs (e.g. pro e→w) when the swapped motion
    // starts from a different location than the seed.
    let endLocation: string;
    if (matchingMotion.startLocation === matchingMotion.endLocation) {
      endLocation = startLocation;
    } else {
      const seedHandDir = getHandRotationDirection(
        matchingMotion.startLocation,
        matchingMotion.endLocation,
      );
      const locationMap = getLocationMapForHandRotation(seedHandDir);
      endLocation = locationMap[startLocation] || startLocation;
    }

    return {
      ...matchingMotion,
      startLocation,
      endLocation,
    };
  }
}

export const strictSwappedExecutor = new StrictSwappedExecutor();
