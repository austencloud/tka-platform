/**
 * Continuity Constraint
 *
 * Maximizes or enforces continuity in rotation direction between consecutive beats.
 * Continuity means the rotation direction doesn't change (no reversal).
 *
 * Modes:
 * - "maximize": Soft constraint - prefer continuous transitions
 * - "enforce": Hard constraint - require all transitions to be continuous
 * - "allow": No preference (neutral constraint)
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  PictographData,
} from "../types.js";

export type ContinuityMode = "maximize" | "enforce" | "allow";

function isReversal(prev: string, current: string): boolean {
  // Static or no rotation doesn't count as reversal
  if (
    prev === "no_rot" ||
    prev === "noRotation" ||
    current === "no_rot" ||
    current === "noRotation"
  ) {
    return false;
  }

  // Opposite directions = reversal
  return (
    (prev === "cw" && current === "ccw") || (prev === "ccw" && current === "cw")
  );
}

/**
 * Returns 1 if continuous, 0 if reversal, 0.5 if one is static.
 */
function calculateContinuityScore(
  prev: PictographData,
  current: PictographData
): { leftScore: number; rightScore: number } {
  const leftReversal = isReversal(
    prev.leftMotion.rotationDirection,
    current.leftMotion.rotationDirection
  );
  const rightReversal = isReversal(
    prev.rightMotion.rotationDirection,
    current.rightMotion.rotationDirection
  );

  // Check for static motions (neutral - not continuous, not reversal)
  const leftStatic =
    prev.leftMotion.motionType === "static" ||
    current.leftMotion.motionType === "static";
  const rightStatic =
    prev.rightMotion.motionType === "static" ||
    current.rightMotion.motionType === "static";

  return {
    leftScore: leftStatic ? 0.5 : leftReversal ? 0 : 1,
    rightScore: rightStatic ? 0.5 : rightReversal ? 0 : 1,
  };
}

export class ContinuityConstraint implements IVariationConstraint {
  readonly type = ConstraintType.CONTINUITY;
  readonly mode: ConstraintMode;
  readonly description: string;

  private readonly continuityMode: ContinuityMode;

  constructor(continuityMode: ContinuityMode = "maximize") {
    this.continuityMode = continuityMode;
    this.mode = continuityMode === "enforce" ? "hard" : "soft";

    switch (continuityMode) {
      case "maximize":
        this.description = "Maximize flow continuity (minimize reversals)";
        break;
      case "enforce":
        this.description = "Require continuous motion (no reversals)";
        break;
      case "allow":
        this.description = "No continuity preference";
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
    if (this.continuityMode === "allow") {
      return {
        score: 0.5,
        satisfied: true,
        reason: "Continuity not enforced",
      };
    }

    const previousStep =
      context.previousSteps[context.previousSteps.length - 1];
    if (!previousStep) {
      return {
        score: 1,
        satisfied: true,
        reason: "No previous step",
      };
    }

    const { leftScore, rightScore } = calculateContinuityScore(
      previousStep,
      context.candidate
    );

    // Average of both hands
    const avgScore = (leftScore + rightScore) / 2;

    // For "enforce" mode, require perfect continuity (both hands score 1)
    const satisfied =
      this.continuityMode !== "enforce" ||
      (leftScore === 1 && rightScore === 1);

    // Build reason string
    let reason: string;
    if (avgScore === 1) {
      reason = "Continuous (no reversals)";
    } else if (avgScore === 0) {
      reason = "Both hands reversed";
    } else if (leftScore < 1 && rightScore === 1) {
      reason = "Left hand reversal";
    } else if (rightScore < 1 && leftScore === 1) {
      reason = "Right hand reversal";
    } else {
      reason = "Partial continuity";
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
    // Continuity depends on the previous step, so all candidates are potentially valid
    return true;
  }
}
