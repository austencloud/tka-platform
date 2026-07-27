/**
 * Orientation Propagator
 *
 * Delegates orientation calculation to the engine's own inlined calculator.
 * Retains propagation logic that chains orientations through a sequence.
 */

import {
  calculateEndOrientation as calculateEndOrientationCore,
} from "./OrientationCalculator.js";
import type {
  IOrientationPropagator,
  IOrientationCalculator,
} from "./IOrientationPropagator.js";
import type {
  SequenceStep,
  SequenceResult,
  Orientation,
} from "../types/sequence-engine-types.js";

export class OrientationCalculator implements IOrientationCalculator {
  calculateEndOrientation(
    motionType: string,
    turns: number | "fl",
    rotationDirection: string,
    startLocation: string,
    endLocation: string,
    startOrientation: Orientation
  ): Orientation {
    return calculateEndOrientationCore({
      motionType,
      turns,
      rotationDirection,
      startLocation,
      endLocation,
      startOrientation,
    });
  }
}

/**
 * Propagates orientations through a sequence.
 * Each step's start orientation = previous step's end orientation.
 */
export class OrientationPropagator implements IOrientationPropagator {
  constructor(private readonly calculator: IOrientationCalculator) {}

  propagateForColor(
    steps: SequenceStep[],
    color: "blue" | "red",
    initialOrientation: Orientation
  ): SequenceStep[] {
    const updatedSteps = [...steps];
    let previousEndOrientation = initialOrientation;

    for (let i = 1; i < updatedSteps.length; i++) {
      const step = updatedSteps[i];
      if (!step) continue;

      const motion = color === "blue" ? step.motions.blue : step.motions.red;
      if (!motion) continue;

      const newEndOrientation = this.calculator.calculateEndOrientation(
        motion.motionType,
        motion.turns ?? 0,
        motion.rotationDirection || "cw",
        motion.startLocation,
        motion.endLocation,
        previousEndOrientation
      );

      const updatedMotion = {
        ...motion,
        startOrientation: previousEndOrientation,
        endOrientation: newEndOrientation,
      };

      updatedSteps[i] = {
        ...step,
        motions: {
          blue: color === "blue" ? updatedMotion : step.motions.blue,
          red: color === "red" ? updatedMotion : step.motions.red,
        },
      };

      previousEndOrientation = newEndOrientation;
    }

    return updatedSteps;
  }

  recalculateAll(result: SequenceResult): SequenceResult {
    if (!result.isValid || result.steps.length === 0) {
      return result;
    }

    const startPosition = result.steps[0];
    if (!startPosition) {
      return result;
    }

    let updatedSteps = [...result.steps];

    const blueStartOrientation = (startPosition.motions.blue.endOrientation || "in") as Orientation;
    updatedSteps = this.propagateForColor(updatedSteps, "blue", blueStartOrientation);

    const redStartOrientation = (startPosition.motions.red.endOrientation || "in") as Orientation;
    updatedSteps = this.propagateForColor(updatedSteps, "red", redStartOrientation);

    return {
      ...result,
      steps: updatedSteps,
    };
  }
}
