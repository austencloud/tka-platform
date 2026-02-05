/**
 * Orientation Propagation for MCP Server
 *
 * Thin wrapper that re-exports from the canonical orientation system.
 * All calculation logic lives in render/core/calculations/orientation.ts.
 */

import { calculateEndOrientation } from "$lib/shared/render/core/calculations/orientation.js";
import type { Orientation } from "$lib/shared/render/core/types.js";
import type { SequenceStep, SequenceResult } from "./sequence-builder.js";

/**
 * Propagate orientations for a single color through all steps.
 */
export function propagateOrientationsForColor(
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

    const newEndOrientation = calculateEndOrientation({
      motionType: motion.motionType,
      turns: 0,
      rotationDirection: motion.rotationDirection || "cw",
      startLocation: motion.startLocation,
      endLocation: motion.endLocation,
      startOrientation: previousEndOrientation,
    });

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

/**
 * Recalculate all prop orientations through the entire sequence.
 */
export function recalculateAllOrientations(result: SequenceResult): SequenceResult {
  if (!result.isValid || result.steps.length === 0) {
    return result;
  }

  const startPosition = result.steps[0];
  if (!startPosition) {
    return result;
  }

  let updatedSteps = [...result.steps];

  const blueStartOrientation = (startPosition.blueMotion.endOrientation || "in") as Orientation;
  updatedSteps = propagateOrientationsForColor(updatedSteps, "blue", blueStartOrientation);

  const redStartOrientation = (startPosition.redMotion.endOrientation || "in") as Orientation;
  updatedSteps = propagateOrientationsForColor(updatedSteps, "red", redStartOrientation);

  return {
    ...result,
    steps: updatedSteps,
  };
}

// Re-export for consumers that need the calculator directly
export { calculateEndOrientation } from "$lib/shared/render/core/calculations/orientation.js";
