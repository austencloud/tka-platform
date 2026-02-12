/**
 * Orientation Propagator - Adapter over canonical orientation logic
 *
 * Delegates orientation calculation to render/core/calculations/orientation.ts
 * (the single source of truth). Retains propagation logic that chains
 * orientations through a sequence.
 */

import {
  calculateEndOrientation as calculateEndOrientationCore,
} from "@tka/render-core";
import type {
  IOrientationPropagator,
  IOrientationCalculator,
} from "../contracts/IOrientationPropagator.js";
import type {
  SequenceStep,
  SequenceResult,
  Orientation,
} from "../../domain/models/SequenceEngineTypes.js";

/**
 * Standalone orientation calculator that delegates to the canonical implementation.
 */
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
 * Each beat's start orientation = previous beat's end orientation.
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

      const motion = color === "blue" ? step.blueMotion : step.redMotion;
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
        blueMotion: color === "blue" ? updatedMotion : step.blueMotion,
        redMotion: color === "red" ? updatedMotion : step.redMotion,
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

    const blueStartOrientation = (startPosition.blueMotion.endOrientation || "in") as Orientation;
    updatedSteps = this.propagateForColor(updatedSteps, "blue", blueStartOrientation);

    const redStartOrientation = (startPosition.redMotion.endOrientation || "in") as Orientation;
    updatedSteps = this.propagateForColor(updatedSteps, "red", redStartOrientation);

    return {
      ...result,
      steps: updatedSteps,
    };
  }
}
