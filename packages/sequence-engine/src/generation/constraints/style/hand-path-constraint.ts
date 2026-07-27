/**
 * Hand Path Reversal Constraint
 *
 * Tracks and constrains hand path direction changes between consecutive steps.
 * Hand path direction is derived from startLocation → endLocation and represents
 * how the hand travels around the grid (clockwise, counter-clockwise, dash, or static).
 *
 * This is DISTINCT from prop rotation direction:
 * - Hand path = how the hand moves around the grid
 * - Prop rotation = which way the prop spins
 *
 * A hand path reversal is generally less disruptive than a prop reversal because
 * the prop spin can remain consistent even when the hand changes direction
 * (by switching between pro and anti motion types).
 *
 * Example:
 * - Step 1: Left hand S→W (clockwise path), pro cw = prop spins cw
 * - Step 2: Left hand W→S (counter-clockwise path), anti cw = prop STILL spins cw
 * = Hand path reversed, but prop spin stayed consistent (softer disruption)
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  PictographData,
} from "../types.js";

// Hand path direction enum (matches orientation-calculator.ts)
export enum HandPath {
  CLOCKWISE = "cw",
  COUNTER_CLOCKWISE = "ccw",
  DASH = "dash",
  STATIC = "static",
  HASH_IN = "hashIn",
  HASH_OUT = "hashOut",
}

// Hand path lookup tables (same as orientation-calculator.ts)
const CLOCKWISE_PAIRS = [
  ["s", "w"], ["w", "n"], ["n", "e"], ["e", "s"],
  ["ne", "se"], ["se", "sw"], ["sw", "nw"], ["nw", "ne"],
];

const COUNTER_CLOCKWISE_PAIRS = [
  ["w", "s"], ["n", "w"], ["e", "n"], ["s", "e"],
  ["ne", "nw"], ["nw", "sw"], ["sw", "se"], ["se", "ne"],
];

const DASH_PAIRS = [
  ["s", "n"], ["w", "e"], ["n", "s"], ["e", "w"],
  ["ne", "sw"], ["se", "nw"], ["sw", "ne"], ["nw", "se"],
];

const STATIC_PAIRS = [
  ["n", "n"], ["e", "e"], ["s", "s"], ["w", "w"],
  ["ne", "ne"], ["se", "se"], ["sw", "sw"], ["nw", "nw"],
  ["c", "c"],
];

// Center → perimeter (hash-out)
const HASH_OUT_PAIRS = [
  ["c", "n"], ["c", "e"], ["c", "s"], ["c", "w"],
  ["c", "ne"], ["c", "se"], ["c", "sw"], ["c", "nw"],
];

// Perimeter → center (hash-in)
const HASH_IN_PAIRS = [
  ["n", "c"], ["e", "c"], ["s", "c"], ["w", "c"],
  ["ne", "c"], ["se", "c"], ["sw", "c"], ["nw", "c"],
];

// Build lookup map
const handpathMap = new Map<string, HandPath>();

CLOCKWISE_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, HandPath.CLOCKWISE);
});

COUNTER_CLOCKWISE_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, HandPath.COUNTER_CLOCKWISE);
});

DASH_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, HandPath.DASH);
});

STATIC_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, HandPath.STATIC);
});

HASH_OUT_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, HandPath.HASH_OUT);
});

HASH_IN_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, HandPath.HASH_IN);
});

export function getHandpathDirection(startLocation: string | undefined, endLocation: string | undefined): HandPath {
  if (!startLocation || !endLocation) {
    return HandPath.STATIC;
  }
  const key = `${startLocation.toLowerCase()}_${endLocation.toLowerCase()}`;
  return handpathMap.get(key) || HandPath.STATIC;
}

/**
 * Check if two hand paths represent a reversal.
 * Only cw ↔ ccw counts as a reversal.
 * Dash and static are neutral (not considered reversals).
 */
function isNeutralHandPath(path: HandPath): boolean {
  return (
    path === HandPath.STATIC ||
    path === HandPath.DASH ||
    path === HandPath.HASH_IN ||
    path === HandPath.HASH_OUT
  );
}

function isHandPathReversal(prev: HandPath, current: HandPath): boolean {
  // Static, dash, and hash are directionally neutral
  if (isNeutralHandPath(prev) || isNeutralHandPath(current)) return false;

  // Opposite circular directions = reversal
  return (
    (prev === HandPath.CLOCKWISE && current === HandPath.COUNTER_CLOCKWISE) ||
    (prev === HandPath.COUNTER_CLOCKWISE && current === HandPath.CLOCKWISE)
  );
}

/**
 *
 * Scoring:
 * - cw → cw or ccw → ccw = 1 (continuous)
 * - cw ↔ ccw = 0 (reversal)
 * - Anything involving dash or static = 1 (continuous - dash/static don't reverse direction)
 *
 * Dash is NOT a reversal because the hand passes straight through rather than
 * changing its circular direction. cw → dash → cw is perfectly continuous.
 */
function calculateHandPathScore(
  prev: PictographData,
  current: PictographData
): { blueScore: number; redScore: number; blueReversal: boolean; redReversal: boolean } {
  // Get hand paths for blue hand
  const prevBlueHandPath = getHandpathDirection(
    prev.blueMotion.startLocation,
    prev.blueMotion.endLocation
  );
  const currentBlueHandPath = getHandpathDirection(
    current.blueMotion.startLocation,
    current.blueMotion.endLocation
  );

  // Get hand paths for red hand
  const prevRedHandPath = getHandpathDirection(
    prev.redMotion.startLocation,
    prev.redMotion.endLocation
  );
  const currentRedHandPath = getHandpathDirection(
    current.redMotion.startLocation,
    current.redMotion.endLocation
  );

  const blueReversal = isHandPathReversal(prevBlueHandPath, currentBlueHandPath);
  const redReversal = isHandPathReversal(prevRedHandPath, currentRedHandPath);

  // Only cw ↔ ccw is a reversal (score 0)
  // Everything else (including dash/static transitions) is continuous (score 1)
  return {
    blueScore: blueReversal ? 0 : 1,
    redScore: redReversal ? 0 : 1,
    blueReversal,
    redReversal,
  };
}

export type HandPathMode = "maximize" | "enforce" | "allow" | "every";

export class HandPathReversalConstraint implements IVariationConstraint {
  readonly type = ConstraintType.HAND_PATH;
  readonly mode: ConstraintMode;
  readonly description: string;

  private readonly handPathMode: HandPathMode;

  constructor(handPathMode: HandPathMode = "maximize") {
    this.handPathMode = handPathMode;

    // "enforce" is hard mode (must have no hand path reversals)
    // "every" is hard mode (must have hand path reversal every step)
    this.mode = handPathMode === "enforce" || handPathMode === "every" ? "hard" : "soft";

    switch (handPathMode) {
      case "maximize":
        this.description = "Maximize hand path continuity (minimize handpath reversals)";
        break;
      case "enforce":
        this.description = "Require continuous hand paths (no handpath reversals)";
        break;
      case "allow":
        this.description = "No hand path preference";
        break;
      case "every":
        this.description = "Hand path reversal every step";
        break;
    }
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    // First step has no previous - always satisfied
    if (context.previousSteps.length === 0) {
      return {
        score: 1,
        satisfied: true,
        reason: "First step (no previous)",
      };
    }

    // Allow mode - always satisfied with neutral score
    if (this.handPathMode === "allow") {
      return {
        score: 0.5,
        satisfied: true,
        reason: "Hand path continuity not enforced",
      };
    }

    const previousStep = context.previousSteps[context.previousSteps.length - 1];
    if (!previousStep) {
      return {
        score: 1,
        satisfied: true,
        reason: "No previous step",
      };
    }

    const { blueScore, redScore, blueReversal, redReversal } = calculateHandPathScore(
      previousStep,
      context.candidate
    );

    // For "every" mode, we WANT reversals (invert scoring)
    if (this.handPathMode === "every") {
      const invertedBlue = blueScore === 0 ? 1 : blueScore === 1 ? 0 : 0.5;
      const invertedRed = redScore === 0 ? 1 : redScore === 1 ? 0 : 0.5;
      const avgScore = (invertedBlue + invertedRed) / 2;

      // Satisfied if at least one hand reversed
      const satisfied = blueReversal || redReversal;

      let reason: string;
      if (blueReversal && redReversal) {
        reason = "Both hands reversed path (ideal)";
      } else if (blueReversal) {
        reason = "Blue hand path reversal";
      } else if (redReversal) {
        reason = "Red hand path reversal";
      } else {
        reason = "No hand path reversals (wanted reversal)";
      }

      return { score: avgScore, satisfied, reason };
    }

    // Normal mode: maximize/enforce continuity
    const avgScore = (blueScore + redScore) / 2;

    // For "enforce" mode, require perfect continuity (both hands score 1 or 0.5 for neutral)
    const satisfied =
      this.handPathMode !== "enforce" ||
      (blueScore >= 0.5 && redScore >= 0.5 && !blueReversal && !redReversal);

    // Build reason string
    let reason: string;
    if (!blueReversal && !redReversal) {
      reason = "Continuous hand paths (no reversals)";
    } else if (blueReversal && redReversal) {
      reason = "Both hands reversed path";
    } else if (blueReversal) {
      reason = "Blue hand path reversal";
    } else {
      reason = "Red hand path reversal";
    }

    return {
      score: avgScore,
      satisfied,
      reason,
    };
  }

  /**
   * Quick check - always returns true since we can't know without context.
   */
  couldSatisfy(_candidate: PictographData): boolean {
    // Hand path continuity depends on the previous step
    return true;
  }
}

/**
 * Convenience factories
 */
export function maximizeHandPathContinuity(): HandPathReversalConstraint {
  return new HandPathReversalConstraint("maximize");
}

export function enforceHandPathContinuity(): HandPathReversalConstraint {
  return new HandPathReversalConstraint("enforce");
}

export function handReversalEveryStep(): HandPathReversalConstraint {
  return new HandPathReversalConstraint("every");
}
