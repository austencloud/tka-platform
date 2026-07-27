/**
 * Compatibility entry point for callers that need a repeated word alongside
 * the orientation-closed steps.
 *
 * The closure calculation and step emission both live in
 * execution/orientation-cycle.ts.
 */

import type { SequenceStep } from "../../core/types/sequence-engine-types.js";
import {
  closeOrientationCycle,
  type OrientationCycleCount,
} from "../execution/orientation-cycle.js";

export interface OrientationCycleExtensionResult {
  steps: SequenceStep[];
  cycleCount: OrientationCycleCount;
  word: string;
}

export function extendForOrientationCycle(
  steps: SequenceStep[],
  word: string
): OrientationCycleExtensionResult {
  const result = closeOrientationCycle(steps);

  return {
    steps: result.steps,
    cycleCount: result.orientationCycleCount,
    word: word.repeat(result.orientationCycleCount),
  };
}
