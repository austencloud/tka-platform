/**
 * Orientation Propagation for MCP Server
 *
 * Thin wrapper around the shared OrientationPropagator implementation.
 * Maintains backward compatibility with existing MCP code.
 */

import { calculateEndOrientation as mcpCalculateEndOrientation, Orientation as McpOrientation } from "./orientation-calculator.js";
import type { SequenceStep, SequenceResult } from "./sequence-builder-adapter.js";

/**
 * Propagate orientations for a single color through all steps.
 * Each step's start orientation = previous step's end orientation.
 *
 * @param steps - The sequence steps (including start position at index 0)
 * @param color - Which motion color to propagate ("blue" or "red")
 * @param initialOrientation - The starting orientation (from step 0's end orientation)
 * @returns Updated steps with correct orientations
 */
export function propagateOrientationsForColor(
  steps: SequenceStep[],
  color: "blue" | "red",
  initialOrientation: McpOrientation
): SequenceStep[] {
  const updatedSteps = [...steps];
  let previousEndOrientation = initialOrientation;

  // Start from step 1 (skip the start position at step 0)
  for (let i = 1; i < updatedSteps.length; i++) {
    const step = updatedSteps[i];
    if (!step) continue;

    const motion = color === "blue" ? step.blueMotion : step.redMotion;
    if (!motion) continue;

    // Calculate new end orientation based on this step's motion
    const newEndOrientation = mcpCalculateEndOrientation({
      motionType: motion.motionType,
      turns: 0, // CSV variations are all 0 turns
      rotationDirection: motion.rotationDirection || "cw",
      startLocation: motion.startLocation,
      endLocation: motion.endLocation,
      startOrientation: previousEndOrientation,
    });

    // Update this step with correct orientations
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
 * Uses the start position (step 0) orientations as the baseline.
 *
 * @param result - The sequence result to fix orientations on
 * @returns Updated sequence result with corrected orientations
 */
export function recalculateAllOrientations(result: SequenceResult): SequenceResult {
  if (!result.isValid || result.steps.length === 0) {
    return result;
  }

  // Get the start position (step 0)
  const startPosition = result.steps[0];
  if (!startPosition) {
    return result;
  }

  let updatedSteps = [...result.steps];

  // Recalculate orientations for blue prop
  // Start with the end orientation of the start position
  const blueStartOrientation = (startPosition.blueMotion.endOrientation || "in") as McpOrientation;
  updatedSteps = propagateOrientationsForColor(updatedSteps, "blue", blueStartOrientation);

  // Recalculate orientations for red prop
  const redStartOrientation = (startPosition.redMotion.endOrientation || "in") as McpOrientation;
  updatedSteps = propagateOrientationsForColor(updatedSteps, "red", redStartOrientation);

  return {
    ...result,
    steps: updatedSteps,
  };
}

/**
 * Recalculate orientations with explicit overrides for the start position.
 * Updates step 0's orientations and re-propagates through the entire sequence.
 */
export function recalculateOrientationsWithOverrides(
  steps: SequenceStep[],
  blueStartOrientation?: string,
  redStartOrientation?: string,
): SequenceStep[] {
  if (steps.length === 0) return steps;

  let updatedSteps = [...steps];
  const sp = updatedSteps[0];
  if (!sp) return updatedSteps;

  // Override step 0 (start position) orientations
  if (blueStartOrientation) {
    const blueOri = blueStartOrientation as McpOrientation;
    updatedSteps[0] = {
      ...sp,
      blueMotion: { ...sp.blueMotion, startOrientation: blueOri, endOrientation: blueOri },
    };
  }
  if (redStartOrientation) {
    const updatedSp = updatedSteps[0]!;
    updatedSteps[0] = {
      ...updatedSp,
      redMotion: { ...updatedSp.redMotion, startOrientation: redStartOrientation as McpOrientation, endOrientation: redStartOrientation as McpOrientation },
    };
  }

  // Re-propagate from the (possibly overridden) step 0
  const finalSp = updatedSteps[0]!;
  const blueOri = (finalSp.blueMotion.endOrientation || "in") as McpOrientation;
  updatedSteps = propagateOrientationsForColor(updatedSteps, "blue", blueOri);

  const redOri = (finalSp.redMotion.endOrientation || "in") as McpOrientation;
  updatedSteps = propagateOrientationsForColor(updatedSteps, "red", redOri);

  return updatedSteps;
}

// Re-export the shared calculator for direct use
export { calculateEndOrientation } from "./orientation-calculator.js";
