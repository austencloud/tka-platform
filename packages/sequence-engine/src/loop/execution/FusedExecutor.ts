import type {
  SequenceStep,
  MotionData,
} from "../../core/types/sequence-engine-types.js";
import {
  getInvertedLetter,
} from "../position-maps/strict-loop-position-maps.js";
import { translateHandPath } from "../position-maps/circular-position-maps.js";
import { gridPositionDeriver } from "../../core/positions/GridPositionDeriver.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export interface FusedTransformFlags {
  readonly mirror: boolean;
  readonly flip: boolean;
  readonly swap: boolean;
  readonly invert: boolean;
}

export class FusedExecutor {
  private readonly flipCount: number;
  private readonly spatialReflectionCount: number;

  constructor(private readonly flags: FusedTransformFlags) {
    let count = 0;
    if (flags.mirror) count++;
    if (flags.flip) count++;
    if (flags.invert) count++;
    this.flipCount = count;
    this.spatialReflectionCount =
      Number(flags.mirror) + Number(flags.flip);
  }

  execute(sequence: SequenceStep[], period: number): SequenceStep[] {
    const startPosition = sequence.shift();
    if (!startPosition) throw new Error("Sequence must have a start position");

    const partialLength = sequence.length;
    const stepsToGenerate = partialLength * (period - 1);

    let lastStep = sequence[sequence.length - 1]!;
    const firstStepNumber = (lastStep.stepNumber ?? 0) + 1;

    for (let offset = 0; offset < stepsToGenerate; offset++) {
      const stepNumber = firstStepNumber + offset;
      const quarterIdx = Math.floor((stepNumber - 1) / partialLength);
      const sourceIdx = (stepNumber - 1) % partialLength;
      const applyTransform = quarterIdx % 2 === 1;

      const sourceStep = sequence[sourceIdx]!;

      const newStep = applyTransform
        ? this.createTransformedStep(sourceStep, lastStep, stepNumber)
        : this.createCopiedStep(sourceStep, lastStep, stepNumber);
      const finalStep = updateStepOrientations(newStep, lastStep);
      sequence.push(finalStep);
      lastStep = finalStep;
    }

    sequence.unshift(startPosition);
    return sequence;
  }

  private createTransformedStep(
    sourceStep: SequenceStep,
    previousStep: SequenceStep,
    stepNumber: number
  ): SequenceStep {
    const blueSource = this.flags.swap
      ? sourceStep.motions.red
      : sourceStep.motions.blue;
    const redSource = this.flags.swap
      ? sourceStep.motions.blue
      : sourceStep.motions.red;

    const blueMotion = this.transformMotion(
      blueSource,
      previousStep.motions.blue
    );
    const redMotion = this.transformMotion(redSource, previousStep.motions.red);

    const endPosition = gridPositionDeriver.getGridPositionFromLocations(
      blueMotion.endLocation,
      redMotion.endLocation
    );

    const letter = this.flags.invert
      ? (getInvertedLetter(sourceStep.letter ?? "") as SequenceStep["letter"])
      : sourceStep.letter;

    return {
      ...sourceStep,
      stepNumber,
      letter,
      startPosition: previousStep.endPosition as SequenceStep["startPosition"],
      endPosition: endPosition as SequenceStep["endPosition"],
      motions: { blue: blueMotion, red: redMotion },
    };
  }

  private transformMotion(
    matchingMotion: MotionData,
    previousMotion: MotionData
  ): MotionData {
    const startLocation = previousMotion.endLocation;
    const endLocation = this.computeEndLocation(matchingMotion, startLocation);

    const flipRotDir = this.flipCount % 2 === 1;
    const rotationDirection = flipRotDir
      ? flipRotationDirection(matchingMotion.rotationDirection)
      : matchingMotion.rotationDirection;

    const motionType = this.flags.invert
      ? invertMotionType(matchingMotion.motionType)
      : matchingMotion.motionType;

    return {
      ...matchingMotion,
      startLocation: startLocation as MotionData["startLocation"],
      endLocation: endLocation as MotionData["endLocation"],
      rotationDirection: rotationDirection as MotionData["rotationDirection"],
      motionType: motionType as MotionData["motionType"],
    };
  }

  private computeEndLocation(
    matchingMotion: MotionData,
    startLocation: string
  ): string {
    if (matchingMotion.startLocation === matchingMotion.endLocation) {
      return startLocation;
    }

    return translateHandPath(
      matchingMotion.startLocation,
      matchingMotion.endLocation,
      startLocation,
      this.spatialReflectionCount % 2 === 1
    );
  }

  private createCopiedStep(
    sourceStep: SequenceStep,
    previousStep: SequenceStep,
    stepNumber: number
  ): SequenceStep {
    return {
      ...sourceStep,
      stepNumber,
      startPosition: previousStep.endPosition as SequenceStep["startPosition"],
      endPosition: sourceStep.endPosition as SequenceStep["endPosition"],
      motions: {
        blue: {
          ...sourceStep.motions.blue,
          startLocation: previousStep.motions.blue
            .endLocation as MotionData["startLocation"],
        },
        red: {
          ...sourceStep.motions.red,
          startLocation: previousStep.motions.red
            .endLocation as MotionData["startLocation"],
        },
      },
    };
  }
}

function flipRotationDirection(dir: string): string {
  if (dir === "cw") return "ccw";
  if (dir === "ccw") return "cw";
  return dir;
}

function invertMotionType(motionType: string): string {
  if (motionType === "pro") return "anti";
  if (motionType === "anti") return "pro";
  return motionType;
}
