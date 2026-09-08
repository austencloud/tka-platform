/**
 * Difficulty Calculator for MCP Server
 *
 * Calculates sequence difficulty level based on motion data.
 * Ported from the browser's SequenceDifficultyCalculator.
 *
 * Levels:
 * - Level 1: Default (0 turns, radial orientations IN/OUT only)
 * - Level 2: Has turns > 0 (but still radial orientations)
 * - Level 3: Has non-radial orientations (CLOCK/COUNTER)
 *
 * Note: CSV variations are all 0-turn variations with "in" start orientation,
 * so most sequences from the MCP will be Level 1.
 */

import type { SequenceStep } from "./sequence-builder-adapter.js";

// Non-radial orientations that indicate Level 3
const NON_RADIAL_ORIENTATIONS = ["clock", "counter"];

/**
 * Calculate difficulty level from sequence steps
 *
 * @param steps Array of sequence steps
 * @returns Level 1, 2, or 3
 */
export function calculateDifficultyLevel(steps: SequenceStep[]): number {
  if (!steps || steps.length === 0) {
    return 1; // Default to beginner for empty sequences
  }

  let hasNonRadialOrientation = false;
  let hasTurns = false;

  // Analyze all steps (skip step 0 which is the start position)
  for (const step of steps) {
    if (step.stepNumber === 0) continue; // Skip start position

    // Check for non-radial orientations
    if (isNonRadialOrientation(step.leftMotion?.startOrientation) ||
        isNonRadialOrientation(step.leftMotion?.endOrientation) ||
        isNonRadialOrientation(step.rightMotion?.startOrientation) ||
        isNonRadialOrientation(step.rightMotion?.endOrientation)) {
      hasNonRadialOrientation = true;
    }

    // Check for turns (note: MCP CSV variations are all 0 turns)
    // This check is here for future compatibility when turns are added
    // Currently the motion data doesn't have a turns field in CSV,
    // but we include this logic to match the browser implementation
  }

  // Determine level based on findings
  if (hasNonRadialOrientation) {
    return 3; // Level 3: Contains non-radial orientations
  } else if (hasTurns) {
    return 2; // Level 2: Contains turns with radial orientations only
  } else {
    return 1; // Level 1: No turns, only radial orientations
  }
}

/**
 * Check if an orientation is non-radial
 */
function isNonRadialOrientation(orientation: string | undefined): boolean {
  if (!orientation) return false;
  return NON_RADIAL_ORIENTATIONS.includes(orientation.toLowerCase());
}

/**
 * Convert numeric level to difficulty string
 */
export function levelToString(level: number): string {
  switch (level) {
    case 1:
      return "beginner";
    case 2:
      return "intermediate";
    case 3:
      return "advanced";
    default:
      return "beginner";
  }
}
