/**
 * Hand Path Constraint
 *
 * Controls hand path continuity - whether hands maintain consistent
 * circular direction around the grid between beats.
 *
 * Hand path is determined by start→end grid locations:
 * - Clockwise: s→w, w→n, n→e, e→s (and intercardinals)
 * - Counter-clockwise: w→s, n→w, e→n, s→e (and intercardinals)
 * - Dash: opposite points (s↔n, w↔e)
 * - Static: same location (n→n, etc.)
 *
 * Hand path reversals (cw↔ccw) are independent from prop reversals.
 * Dash and static are directionally neutral - not counted as reversals.
 */

import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  ConstraintMotionData,
} from "./types";
import { ConstraintType, type ConstraintMode } from "./constraint-types";

/**
 * Hand path direction enum
 */
export enum HandPath {
  CLOCKWISE = "cw",
  COUNTER_CLOCKWISE = "ccw",
  DASH = "dash",
  STATIC = "static",
  HASH_IN = "hashIn",
  HASH_OUT = "hashOut",
}

/**
 * Hand path constraint modes
 */
export type HandPathConstraintMode = "maximize" | "enforce" | "allow" | "every";

// Clockwise movement pairs: start_end
const CLOCKWISE_PAIRS = new Set([
  "s_w", "w_n", "n_e", "e_s",           // Cardinal
  "ne_se", "se_sw", "sw_nw", "nw_ne",   // Intercardinal
  // Cross pairs (cardinal to intercardinal, clockwise)
  "n_ne", "ne_e", "e_se", "se_s",
  "s_sw", "sw_w", "w_nw", "nw_n",
]);

// Counter-clockwise movement pairs: start_end
const CCW_PAIRS = new Set([
  "w_s", "n_w", "e_n", "s_e",           // Cardinal
  "ne_nw", "nw_sw", "sw_se", "se_ne",   // Intercardinal
  // Cross pairs (cardinal to intercardinal, counter-clockwise)
  "n_nw", "nw_w", "w_sw", "sw_s",
  "s_se", "se_e", "e_ne", "ne_n",
]);

// Dash pairs (opposite locations)
const DASH_PAIRS = new Set([
  "s_n", "n_s", "w_e", "e_w",           // Cardinal opposites
  "ne_sw", "sw_ne", "se_nw", "nw_se",   // Intercardinal opposites
]);

/**
 * Determine hand path direction from start and end locations
 */
// Center → perimeter (hash-out)
const HASH_OUT_PAIRS = new Set([
  "c_n", "c_e", "c_s", "c_w",
  "c_ne", "c_se", "c_sw", "c_nw",
]);

// Perimeter → center (hash-in)
const HASH_IN_PAIRS = new Set([
  "n_c", "e_c", "s_c", "w_c",
  "ne_c", "se_c", "sw_c", "nw_c",
]);

function getHandPathDirection(startLocation: string, endLocation: string): HandPath {
  // Static: same location
  if (startLocation === endLocation) {
    return HandPath.STATIC;
  }

  const key = `${startLocation}_${endLocation}`;

  if (CLOCKWISE_PAIRS.has(key)) {
    return HandPath.CLOCKWISE;
  }

  if (CCW_PAIRS.has(key)) {
    return HandPath.COUNTER_CLOCKWISE;
  }

  if (DASH_PAIRS.has(key)) {
    return HandPath.DASH;
  }

  if (HASH_OUT_PAIRS.has(key)) {
    return HandPath.HASH_OUT;
  }

  if (HASH_IN_PAIRS.has(key)) {
    return HandPath.HASH_IN;
  }

  // Fallback for unknown pairs - treat as static
  return HandPath.STATIC;
}

/**
 * Check if a hand path reversal occurred between two paths.
 * Only cw↔ccw transitions count as reversals.
 * Dash and static are directionally neutral.
 */
function isHandPathReversal(prevPath: HandPath, currentPath: HandPath): boolean {
  // Dash, static, and hash are directionally neutral - no reversal
  if (isNeutralHandPath(prevPath) || isNeutralHandPath(currentPath)) {
    return false;
  }

  // Only cw↔ccw is a reversal
  return prevPath !== currentPath;
}

function isNeutralHandPath(path: HandPath): boolean {
  return (
    path === HandPath.DASH ||
    path === HandPath.STATIC ||
    path === HandPath.HASH_IN ||
    path === HandPath.HASH_OUT
  );
}

/**
 * Hand Path Constraint Implementation
 *
 * Evaluates hand path continuity between consecutive beats.
 */
export class HandPathConstraint implements IVariationConstraint {
  readonly type = ConstraintType.HAND_PATH;
  readonly mode: ConstraintMode;
  readonly description: string;

  private handPathMode: HandPathConstraintMode;

  constructor(handPathMode: HandPathConstraintMode = "maximize") {
    this.handPathMode = handPathMode;

    // "enforce" and "every" are hard constraints
    this.mode = handPathMode === "enforce" || handPathMode === "every"
      ? "hard"
      : "soft";

    // Human-readable description
    switch (handPathMode) {
      case "maximize":
        this.description = "Prefer continuous hand paths (minimize direction changes)";
        break;
      case "enforce":
        this.description = "Require continuous hand paths (no direction changes allowed)";
        break;
      case "allow":
        this.description = "Allow any hand path changes";
        break;
      case "every":
        this.description = "Prefer hand path changes on every beat";
        break;
    }
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    const { previousSteps, candidate } = context;

    // First step: no previous to compare - always satisfied
    if (previousSteps.length === 0) {
      return {
        score: 1,
        satisfied: true,
        reason: "First step - no previous hand path to compare",
      };
    }

    // Get previous step
    const previousStep = previousSteps[previousSteps.length - 1];
    if (!previousStep) {
      return {
        score: 1,
        satisfied: true,
        reason: "No previous step data",
      };
    }

    // Calculate hand paths for both hands
    const prevLeftPath = this.getHandPath(previousStep.leftMotion);
    const currLeftPath = this.getHandPath(candidate.leftMotion);
    const prevRightPath = this.getHandPath(previousStep.rightMotion);
    const currRightPath = this.getHandPath(candidate.rightMotion);

    // Check for reversals
    const leftReversal = isHandPathReversal(prevLeftPath, currLeftPath);
    const rightReversal = isHandPathReversal(prevRightPath, currRightPath);

    // Score based on mode
    return this.scoreReversals(leftReversal, rightReversal, prevLeftPath, currLeftPath, prevRightPath, currRightPath);
  }

  /**
   * Extract hand path from motion data
   */
  private getHandPath(motion: ConstraintMotionData): HandPath {
    if (!motion?.startLocation || !motion.endLocation) {
      return HandPath.STATIC;
    }
    return getHandPathDirection(motion.startLocation, motion.endLocation);
  }

  /**
   * Score based on reversal detection and mode
   */
  private scoreReversals(
    leftReversal: boolean,
    rightReversal: boolean,
    prevLeftPath: HandPath,
    currLeftPath: HandPath,
    prevRightPath: HandPath,
    currRightPath: HandPath
  ): ConstraintScore {
    const bothReversed = leftReversal && rightReversal;
    const oneReversed = leftReversal || rightReversal;
    const noneReversed = !leftReversal && !rightReversal;

    switch (this.handPathMode) {
      case "maximize": {
        // Prefer no reversals, but allow them
        // Score: 1 = no reversals, 0.5 = one hand, 0 = both hands
        let score: number;
        if (noneReversed) {
          score = 1;
        } else if (bothReversed) {
          score = 0;
        } else {
          score = 0.5;
        }
        return {
          score,
          satisfied: true, // Soft constraint - always "satisfied"
          reason: this.buildReason(leftReversal, rightReversal, prevLeftPath, currLeftPath, prevRightPath, currRightPath),
        };
      }

      case "enforce": {
        // Require no reversals (hard constraint)
        return {
          score: noneReversed ? 1 : 0,
          satisfied: noneReversed,
          reason: noneReversed
            ? "Hand paths continuous"
            : this.buildReason(leftReversal, rightReversal, prevLeftPath, currLeftPath, prevRightPath, currRightPath),
        };
      }

      case "allow": {
        // No preference
        return {
          score: 0.5,
          satisfied: true,
          reason: "Hand path changes allowed",
        };
      }

      case "every": {
        // Prefer reversals on every beat (inverted scoring)
        let score: number;
        if (bothReversed) {
          score = 1;
        } else if (oneReversed) {
          score = 0.75;
        } else {
          score = 0;
        }
        return {
          score,
          satisfied: oneReversed, // Hard constraint - need at least one reversal
          reason: oneReversed
            ? "Hand path changed as required"
            : "No hand path change (reversal required)",
        };
      }

      default:
        return { score: 0.5, satisfied: true, reason: "Unknown mode" };
    }
  }

  /**
   * Build human-readable reason string
   */
  private buildReason(
    leftReversal: boolean,
    rightReversal: boolean,
    prevLeftPath: HandPath,
    currLeftPath: HandPath,
    prevRightPath: HandPath,
    currRightPath: HandPath
  ): string {
    const parts: string[] = [];

    if (leftReversal) {
      parts.push(`blue ${prevLeftPath}→${currLeftPath}`);
    }
    if (rightReversal) {
      parts.push(`red ${prevRightPath}→${currRightPath}`);
    }

    if (parts.length === 0) {
      return "Hand paths continuous";
    }

    return `Hand path change: ${parts.join(", ")}`;
  }

  /**
   * Quick check - always returns true since we need context
   */
  couldSatisfy(): boolean {
    return true;
  }
}
