/**
 * Compatibility entry point for orientation-cycle analysis.
 *
 * The calculation lives in execution/orientation-cycle.ts so generation,
 * detection, and extension cannot disagree about how many repetitions close.
 */

export {
  analyzeOrientationCycle as detectOrientationCycle,
  type OrientationCycleAnalysis as OrientationCycleResult,
} from "../execution/orientation-cycle.js";
