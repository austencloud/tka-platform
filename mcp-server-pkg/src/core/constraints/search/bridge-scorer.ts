/**
 * Bridge Letter Scoring
 *
 * Scores bridge letter options against constraints so that
 * bridge selection favors constraint-satisfying letters.
 *
 * Scoring is based on actual motion data from pictographs,
 * not hardcoded letter lists. This is more accurate and
 * automatically handles variations.
 *
 * Supports per-hand constraints (e.g., "blue hand lots of dashes,
 * red hand minimize dashes") by scoring each hand's motion independently.
 */

import type { ConstraintSet, IVariationConstraint, PictographData } from "../types.js";
import type { HandTarget } from "../implementations/per-hand-dash-constraint.js";

function countDashMotions(pictograph: PictographData): number {
  let count = 0;
  if (pictograph.blueMotion.motionType === "dash") count++;
  if (pictograph.redMotion.motionType === "dash") count++;
  return count;
}

function countShiftMotions(pictograph: PictographData): number {
  let count = 0;
  const blueType = pictograph.blueMotion.motionType;
  const redType = pictograph.redMotion.motionType;
  if (blueType === "pro" || blueType === "anti") count++;
  if (redType === "pro" || redType === "anti") count++;
  return count;
}

/**
 * - 2 dashes = 1.0
 * - 1 dash = 0.75
 * - 0 dashes = 0.25
 */
export function getDashScoreFromPictograph(pictograph: PictographData): number {
  const dashCount = countDashMotions(pictograph);
  if (dashCount === 2) return 1.0;
  if (dashCount === 1) return 0.75;
  return 0.25;
}

/**
 * (Inverse of dash - for "minimize dashes" constraint)
 * - 2 shifts, 0 dashes = 1.0
 * - 1 shift, 0 dashes = 0.9
 * - 0 shifts, 0 dashes (static) = 0.75
 * - 1 dash = 0.5
 * - 2 dashes = 0.25
 */
export function getShiftScoreFromPictograph(pictograph: PictographData): number {
  const dashCount = countDashMotions(pictograph);
  const shiftCount = countShiftMotions(pictograph);

  if (dashCount === 0) {
    if (shiftCount === 2) return 1.0;
    if (shiftCount === 1) return 0.9;
    return 0.75; // Static
  }
  if (dashCount === 1) return 0.5;
  return 0.25; // Both dashes
}

/**
 * Used for per-hand constraints like "blue hand maximize dashes".
 */
export function getPerHandDashScore(
  pictograph: PictographData,
  hand: HandTarget,
  mode: "maximize" | "minimize"
): number {
  const motion = hand === "blue" ? pictograph.blueMotion : pictograph.redMotion;
  const isDash = motion.motionType === "dash";
  const isShift = motion.motionType === "pro" || motion.motionType === "anti";

  if (mode === "maximize") {
    // Prefer: dash > shift > static
    if (isDash) return 1.0;
    if (isShift) return 0.4;
    return 0.2; // Static
  } else {
    // Prefer: shift > static > dash
    if (isShift) return 1.0;
    if (!isDash) return 0.8; // Static
    return 0.2; // Dash
  }
}

/**
 * Returns average of both hand scores.
 */
export function getCombinedPerHandDashScore(
  pictograph: PictographData,
  blueMode: "maximize" | "minimize" | null,
  redMode: "maximize" | "minimize" | null
): number {
  const scores: number[] = [];

  if (blueMode) {
    scores.push(getPerHandDashScore(pictograph, "blue", blueMode));
  }
  if (redMode) {
    scores.push(getPerHandDashScore(pictograph, "red", redMode));
  }

  if (scores.length === 0) return 0.5;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Falls back to checking letter name patterns if no pictograph provided.
 */
export function isDashLetter(letter: string, pictographs?: PictographData[]): boolean {
  if (pictographs) {
    const variations = pictographs.filter(p => p.letter === letter);
    return variations.some(p => countDashMotions(p) > 0);
  }
  // Fallback: check if letter name suggests dash (Type 3/4/5 patterns)
  return letter.endsWith("-") || ["Φ", "Ψ", "Λ"].includes(letter);
}

/**
 * Returns the score of the first variation (most variations of the same
 * letter have the same motion types).
 */
export function getDashScore(letter: string, pictographs?: PictographData[]): number {
  if (pictographs) {
    const variation = pictographs.find(p => p.letter === letter);
    if (variation) {
      return getDashScoreFromPictograph(variation);
    }
  }
  // Fallback: use letter name patterns
  if (["Φ-", "Ψ-", "Λ-"].includes(letter)) return 1.0;
  if (letter.endsWith("-") || ["Φ", "Ψ", "Λ"].includes(letter)) return 0.75;
  return 0.25;
}

/**
 * Score and rank bridge letter options based on constraints.
 * @param bridgeOptions - Array of valid bridge letters
 * @param constraintSet - Constraints to score against
 * @param allPictographs - All pictograph data (for detailed scoring)
 * @returns Sorted array of { letter, score } with highest scores first
 */
export function scoreBridgeOptions(
  bridgeOptions: string[],
  constraintSet: ConstraintSet,
  allPictographs?: PictographData[]
): Array<{ letter: string; score: number }> {
  if (bridgeOptions.length === 0) {
    return [];
  }

  // Check for per-hand constraints first (higher priority)
  const perHandConstraints = checkForPerHandDashConstraints(constraintSet);
  const hasPerHandConstraints = perHandConstraints.blue !== null || perHandConstraints.red !== null;

  const hasDashPreference = !hasPerHandConstraints && checkForDashPreference(constraintSet);
  const hasDashAvoidance = !hasPerHandConstraints && checkForDashAvoidance(constraintSet);

  const scored = bridgeOptions.map((letter) => {
    let score = 0.5; // Base score

    // Find a pictograph variation for this letter to score against actual motion data
    const variation = allPictographs?.find((p) => p.letter === letter);

    if (hasPerHandConstraints && variation) {
      // Score based on per-hand constraints
      score = getCombinedPerHandDashScore(
        variation,
        perHandConstraints.blue,
        perHandConstraints.red
      );
    } else if (hasDashPreference) {
      // Score based on actual motion data when available
      if (variation) {
        score = getDashScoreFromPictograph(variation);
      } else {
        // Fallback to letter-name heuristics
        score = getDashScore(letter);
      }
    } else if (hasDashAvoidance) {
      // Score based on actual motion data - prefer shifts over dashes
      if (variation) {
        score = getShiftScoreFromPictograph(variation);
      } else {
        // Fallback: invert dash score
        const dashScore = getDashScore(letter);
        score = 1.25 - dashScore;
      }
    } else if (variation) {
      // No specific dash constraint, but we have pictograph data
      // Use general constraint scoring
      score = scoreAgainstConstraints(variation, constraintSet);
    }

    return { letter, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * Select the best bridge letter based on constraints.
 * @param bridgeOptions - Array of valid bridge letters
 * @param constraintSet - Constraints to optimize for
 * @param allPictographs - Optional pictograph data for detailed scoring
 * @returns The best bridge letter, or the first option if no constraints
 */
export function selectBestBridge(
  bridgeOptions: string[],
  constraintSet: ConstraintSet,
  allPictographs?: PictographData[]
): string | null {
  if (bridgeOptions.length === 0) {
    return null;
  }

  // If no constraints, return first option (existing behavior)
  if (constraintSet.hard.length === 0 && constraintSet.soft.length === 0) {
    return bridgeOptions[0] ?? null;
  }

  const scored = scoreBridgeOptions(bridgeOptions, constraintSet, allPictographs);
  return scored[0]?.letter ?? bridgeOptions[0] ?? null;
}

/**
 * Returns an object with the mode for each hand (or null if no constraint).
 */
function checkForPerHandDashConstraints(constraintSet: ConstraintSet): {
  blue: "maximize" | "minimize" | null;
  red: "maximize" | "minimize" | null;
} {
  const result: { blue: "maximize" | "minimize" | null; red: "maximize" | "minimize" | null } = {
    blue: null,
    red: null,
  };

  const allConstraints = [...constraintSet.hard, ...constraintSet.soft];

  for (const constraint of allConstraints) {
    const desc = constraint.description?.toLowerCase() ?? "";

    // Check for blue hand constraint
    if (desc.includes("blue") && desc.includes("hand")) {
      if (desc.includes("maximize") || desc.includes("dash")) {
        if (!desc.includes("minimize") && !desc.includes("no dash")) {
          result.blue = "maximize";
        }
      }
      if (desc.includes("minimize") || desc.includes("no dash")) {
        result.blue = "minimize";
      }
    }

    // Check for red hand constraint
    if (desc.includes("red") && desc.includes("hand")) {
      if (desc.includes("maximize") || desc.includes("dash")) {
        if (!desc.includes("minimize") && !desc.includes("no dash")) {
          result.red = "maximize";
        }
      }
      if (desc.includes("minimize") || desc.includes("no dash")) {
        result.red = "minimize";
      }
    }
  }

  return result;
}

function checkForDashPreference(constraintSet: ConstraintSet): boolean {
  const allConstraints = [...constraintSet.hard, ...constraintSet.soft];

  for (const constraint of allConstraints) {
    // Check for DashPreferenceConstraint by description
    if (constraint.description?.toLowerCase().includes("dash")) {
      // Check it's a preference (maximize/prefer/require), not avoidance
      if (
        constraint.description.toLowerCase().includes("maximize") ||
        constraint.description.toLowerCase().includes("prefer dash") ||
        constraint.description.toLowerCase().includes("require")
      ) {
        return true;
      }
    }
  }

  return false;
}

function checkForDashAvoidance(constraintSet: ConstraintSet): boolean {
  const allConstraints = [...constraintSet.hard, ...constraintSet.soft];

  for (const constraint of allConstraints) {
    // Check for DashAvoidanceConstraint by description
    if (constraint.description?.toLowerCase().includes("dash")) {
      // Check it's avoidance (minimize/avoid/no)
      if (
        constraint.description.toLowerCase().includes("minimize") ||
        constraint.description.toLowerCase().includes("avoid") ||
        constraint.description.toLowerCase().includes("no dash") ||
        constraint.description.toLowerCase().includes("prefer shift")
      ) {
        return true;
      }
    }
  }

  return false;
}

function scoreAgainstConstraints(
  variation: PictographData,
  constraintSet: ConstraintSet
): number {
  const allConstraints = [...constraintSet.hard, ...constraintSet.soft];

  if (allConstraints.length === 0) {
    return 0.5;
  }

  let totalScore = 0;
  let count = 0;

  for (const constraint of allConstraints) {
    // Check if constraint is a variation constraint
    if ("evaluate" in constraint && typeof constraint.evaluate === "function") {
      const variationConstraint = constraint as IVariationConstraint;
      try {
        const result = variationConstraint.evaluate({
          candidate: variation,
          previousSteps: [],
          stepIndex: 0,
          totalSteps: 1,
          letter: variation.letter,
        });
        totalScore += result.score;
        count++;
      } catch {
        // Constraint doesn't apply to this context
      }
    }
  }

  return count > 0 ? totalScore / count : 0.5;
}

/**
 * Generate optimal bridge selections for a sequence based on constraints.
 * @param bridgeInfos - Array of bridge info from findAllBridgeOptions
 * @param constraintSet - Constraints to optimize for
 * @param allPictographs - Pictograph data for detailed scoring
 * @returns Map of transition index to best bridge option index
 */
export function generateOptimalBridgeSelections(
  bridgeInfos: Array<{
    transitionIndex: number;
    availableOptions: string[];
  }>,
  constraintSet: ConstraintSet,
  allPictographs?: PictographData[]
): Record<number, number> {
  const selections: Record<number, number> = {};

  for (const info of bridgeInfos) {
    const scored = scoreBridgeOptions(
      info.availableOptions,
      constraintSet,
      allPictographs
    );

    if (scored.length > 0) {
      // Find the index of the best-scoring option in the original array
      const bestLetter = scored[0]?.letter;
      if (bestLetter) {
        const bestIndex = info.availableOptions.indexOf(bestLetter);
        if (bestIndex >= 0) {
          selections[info.transitionIndex] = bestIndex;
        }
      }
    }
  }

  return selections;
}
