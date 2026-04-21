/**
 * Strict Mirrored LOOP Executor (engine version)
 *
 * Supports both halved (period 2) and quartered (period 4) mirrored LOOPs.
 *
 * Period 2: Q1 (partial) + Q2 (V-mirror of Q1). Positions return to start,
 *   orientations return to start when per-pass wheel delta ≡ 0 mod 4.
 *
 * Period 4: Q1 + Q2 + Q3 (copy of Q1 at advanced orientation) + Q4 (V-mirror
 *   of Q3). Requires the partial's per-hand turn total ≡ 1 or 3 mod 4, which
 *   the SequenceBuilder enforces via allocateTurns({enforcePeriod4Parity}).
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type {
  SequenceStep,
  MotionData,
} from "../../core/types/sequence-engine-types.js";
import { SliceSize } from "../loop-types.js";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  MIRRORED_LOOP_VALIDATION_SET,
} from "../position-maps/strict-loop-position-maps.js";
import {
  getHandRotationDirection,
  getLocationMapForHandRotation,
  mirrorHandRotationDirection,
} from "../position-maps/circular-position-maps.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export class StrictMirroredExecutor implements ILOOPExecutor {
  executeLOOP(sequence: SequenceStep[], sliceSize: SliceSize): SequenceStep[] {
    this.validateSequence(sequence);

    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    const partialLength = sequence.length;
    const period = sliceSize === SliceSize.QUARTERED ? 4 : 2;
    const totalLength = partialLength * period;
    const beatsToGenerate = totalLength - partialLength;

    let lastStep = sequence[sequence.length - 1]!;
    const firstGeneratedStepNumber =
      (lastStep.stepNumber ?? lastStep.stepNumber) + 1;

    for (let offset = 0; offset < beatsToGenerate; offset++) {
      const stepNumber = firstGeneratedStepNumber + offset;

      // Q1 = partial (already in sequence). Q2 = mirror(Q1). Q3 = copy(Q1)
      // at new orientation. Q4 = mirror(Q3). Odd quarters mirror, even copy.
      const quarterIdx = Math.floor((stepNumber - 1) / partialLength);
      const sourceStepNumber = ((stepNumber - 1) % partialLength) + 1;
      const applyMirror = quarterIdx % 2 === 1;

      const sourceStep = sequence[sourceStepNumber - 1]!;

      const newStep = applyMirror
        ? this.createMirroredStep(sourceStep, lastStep, stepNumber)
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
    if (!MIRRORED_LOOP_VALIDATION_SET.has(key)) {
      const expectedEnd = VERTICAL_MIRROR_POSITION_MAP[startPos];
      throw new Error(
        `Invalid position pair for mirrored LOOP: ${startPos} -> ${endPos}. ` +
          `For a mirrored LOOP from ${startPos}, the sequence must end at ${expectedEnd}.`
      );
    }
  }

  private createMirroredStep(
    sourceStep: SequenceStep,
    previousStep: SequenceStep,
    stepNumber: number
  ): SequenceStep {
    const mirroredEndPosition =
      VERTICAL_MIRROR_POSITION_MAP[sourceStep.endPosition ?? ""] ||
      sourceStep.endPosition;

    return {
      ...sourceStep,
      stepNumber,
      startPosition: (previousStep.endPosition) as SequenceStep["startPosition"],
      endPosition: (mirroredEndPosition) as SequenceStep["endPosition"],
      motions: {
        blue: this.createMirroredMotion(
        sourceStep.motions.blue,
        previousStep.motions.blue
      ),
        red: this.createMirroredMotion(
        sourceStep.motions.red,
        previousStep.motions.red
      ),
      },
    };
  }

  /**
   * Copy a source beat verbatim (same motion pattern, same end position),
   * with the start locations re-anchored to the previous beat's end locations.
   * Orientations propagate via updateStepOrientations.
   *
   * Used for Q3 in period-4 output: the partial repeats at an advanced
   * orientation. Positions follow the same trajectory as Q1.
   */
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

  private createMirroredMotion(
    sourceMotion: MotionData,
    previousMotion: MotionData
  ): MotionData {
    const startLocation = previousMotion.endLocation;
    const mirroredRotDir = flipRotationDirection(sourceMotion.rotationDirection);

    let endLocation: string;
    if (sourceMotion.startLocation === sourceMotion.endLocation) {
      endLocation = startLocation;
    } else {
      const seedHandDir = getHandRotationDirection(
        sourceMotion.startLocation,
        sourceMotion.endLocation
      );
      const mirroredDir = mirrorHandRotationDirection(seedHandDir);
      const locationMap = getLocationMapForHandRotation(mirroredDir);
      endLocation = locationMap[startLocation] || startLocation;
    }

    return {
      ...sourceMotion,
      startLocation: startLocation as MotionData["startLocation"],
      endLocation: endLocation as MotionData["endLocation"],
      rotationDirection: (mirroredRotDir) as MotionData["rotationDirection"],
    };
  }
}

function flipRotationDirection(dir: string): string {
  if (dir === "cw") return "ccw";
  if (dir === "ccw") return "cw";
  return dir;
}

export const strictMirroredExecutor = new StrictMirroredExecutor();
