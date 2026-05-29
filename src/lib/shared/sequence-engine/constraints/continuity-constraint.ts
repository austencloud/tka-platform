/**
 * Continuity Constraint
 *
 * Maximizes or enforces continuity in rotation direction between consecutive beats.
 * Continuity means the rotation direction doesn't change (no reversal).
 */

import { ConstraintType, type ConstraintMode } from "./constraint-types";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  ConstraintPictographData,
} from "./types";

export type ContinuityMode = "maximize" | "enforce" | "allow";

/**
 * Check if a rotation direction change represents a reversal.
 */
function isReversal(prev: string, current: string): boolean {
  if (
    prev === "no_rot" ||
    prev === "noRotation" ||
    current === "no_rot" ||
    current === "noRotation"
  ) {
    return false;
  }
  return (
    (prev === "cw" && current === "ccw") ||
    (prev === "ccw" && current === "cw")
  );
}

/**
 * Calculate continuity score between two consecutive steps.
 */
function calculateContinuityScore(
  prev: ConstraintPictographData,
  current: ConstraintPictographData
): { blueScore: number; redScore: number } {
  const blueReversal = isReversal(
    prev.blueMotion.rotationDirection,
    current.blueMotion.rotationDirection
  );
  const redReversal = isReversal(
    prev.redMotion.rotationDirection,
    current.redMotion.rotationDirection
  );

  const blueStatic =
    prev.blueMotion.motionType === "static" ||
    current.blueMotion.motionType === "static";
  const redStatic =
    prev.redMotion.motionType === "static" ||
    current.redMotion.motionType === "static";

  return {
    blueScore: blueStatic ? 0.5 : blueReversal ? 0 : 1,
    redScore: redStatic ? 0.5 : redReversal ? 0 : 1,
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

    const previousStep = context.previousSteps[context.previousSteps.length - 1];
    if (!previousStep) {
      return {
        score: 1,
        satisfied: true,
        reason: "No previous step",
      };
    }

    const { blueScore, redScore } = calculateContinuityScore(
      previousStep,
      context.candidate
    );

    const avgScore = (blueScore + redScore) / 2;

    const satisfied =
      this.continuityMode !== "enforce" ||
      (blueScore === 1 && redScore === 1);

    let reason: string;
    if (avgScore === 1) {
      reason = "Continuous (no reversals)";
    } else if (avgScore === 0) {
      reason = "Both hands reversed";
    } else if (blueScore < 1 && redScore === 1) {
      reason = "Blue hand reversal";
    } else if (redScore < 1 && blueScore === 1) {
      reason = "Red hand reversal";
    } else {
      reason = "Partial continuity";
    }

    return {
      score: avgScore,
      satisfied,
      reason,
    };
  }

  couldSatisfy(_candidate: ConstraintPictographData): boolean {
    return true;
  }
}
