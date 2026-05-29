/**
 * Reversal Constraint
 *
 * Controls the frequency of direction reversals in a sequence.
 */

import { ConstraintType, type ConstraintMode } from "./constraint-types";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  ConstraintPictographData,
} from "./types";

export type ReversalMode = "every" | "minimize" | "count";

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

export class ReversalConstraint implements IVariationConstraint {
  readonly type = ConstraintType.REVERSAL;
  readonly mode: ConstraintMode = "soft";
  readonly description: string;

  private readonly reversalMode: ReversalMode;
  private readonly targetCount?: number;

  constructor(reversalMode: ReversalMode, targetCount?: number) {
    this.reversalMode = reversalMode;
    this.targetCount = targetCount;

    switch (reversalMode) {
      case "every":
        this.description = "Maximize prop reversals";
        break;
      case "minimize":
        this.description = "Minimize prop reversals";
        break;
      case "count":
        this.description = `Target ${targetCount} prop reversals`;
        break;
    }
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    if (context.previousSteps.length === 0) {
      return {
        score: 0.5,
        satisfied: true,
        reason: "First step (no previous)",
      };
    }

    const previousStep = context.previousSteps[context.previousSteps.length - 1];
    if (!previousStep) {
      return {
        score: 0.5,
        satisfied: true,
        reason: "No previous step",
      };
    }

    const blueReversal = isReversal(
      previousStep.blueMotion.rotationDirection,
      context.candidate.blueMotion.rotationDirection
    );
    const redReversal = isReversal(
      previousStep.redMotion.rotationDirection,
      context.candidate.redMotion.rotationDirection
    );

    const blueStatic =
      previousStep.blueMotion.motionType === "static" ||
      context.candidate.blueMotion.motionType === "static";
    const redStatic =
      previousStep.redMotion.motionType === "static" ||
      context.candidate.redMotion.motionType === "static";

    const hasReversal = blueReversal || redReversal;
    const bothReversed = blueReversal && redReversal;
    const bothStatic = blueStatic && redStatic;

    let score: number;
    let reason: string;

    switch (this.reversalMode) {
      case "every":
        if (bothStatic) {
          score = 0.5;
          reason = "Static motion (no rotation to reverse)";
        } else if (bothReversed) {
          score = 1;
          reason = "Both hands reversed";
        } else if (hasReversal) {
          score = 0.75;
          reason = blueReversal ? "Blue hand reversed" : "Red hand reversed";
        } else {
          score = 0;
          reason = "No reversal (want reversal every beat)";
        }
        break;

      case "minimize":
        if (bothStatic) {
          score = 0.5;
          reason = "Static motion";
        } else if (!hasReversal) {
          score = 1;
          reason = "No reversal (continuous)";
        } else if (!bothReversed) {
          score = 0.5;
          reason = "Partial reversal";
        } else {
          score = 0;
          reason = "Both hands reversed";
        }
        break;

      case "count":
        score = 0.5;
        reason = "Count mode (evaluated at sequence level)";
        break;

      default:
        score = 0.5;
        reason = "Unknown reversal mode";
    }

    return {
      score,
      satisfied: true,
      reason,
    };
  }

  couldSatisfy(_candidate: ConstraintPictographData): boolean {
    return true;
  }
}
