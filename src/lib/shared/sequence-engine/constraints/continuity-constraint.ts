/**
 * Continuity Constraint
 *
 * Maximizes or enforces continuity in rotation direction between consecutive beats.
 * Continuity means the rotation direction doesn't change (no reversal).
 */

import { ConstraintType, type ConstraintMode } from "./constraint-types";
import { isReversal } from "./reversal-util";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  ConstraintPictographData,
} from "./types";

export type ContinuityMode = "maximize" | "enforce" | "allow";

/**
 * Calculate continuity score between two consecutive steps.
 */
function calculateContinuityScore(
  prev: ConstraintPictographData,
  current: ConstraintPictographData
): { leftScore: number; rightScore: number } {
  const leftReversal = isReversal(
    prev.leftMotion.rotationDirection,
    current.leftMotion.rotationDirection
  );
  const rightReversal = isReversal(
    prev.rightMotion.rotationDirection,
    current.rightMotion.rotationDirection
  );

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

    const previousStep = context.previousSteps[context.previousSteps.length - 1];
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

    const avgScore = (leftScore + rightScore) / 2;

    const satisfied =
      this.continuityMode !== "enforce" ||
      (leftScore === 1 && rightScore === 1);

    let reason: string;
    if (avgScore === 1) {
      reason = "Continuous (no reversals)";
    } else if (avgScore === 0) {
      reason = "Both hands reversed";
    } else if (leftScore < 1 && rightScore === 1) {
      reason = "Blue hand reversal";
    } else if (rightScore < 1 && leftScore === 1) {
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
