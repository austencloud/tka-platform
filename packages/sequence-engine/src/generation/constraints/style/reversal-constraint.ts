/**
 * Reversal Constraint
 *
 * Controls the frequency of direction reversals in a sequence.
 *
 * Modes:
 * - "every": Reversal every step (maximum breaks)
 * - "minimize": As few reversals as possible (same as maximize continuity)
 * - "count": Specific number of reversals
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  PictographData,
} from "../types.js";

export type ReversalMode = "every" | "minimize" | "count";

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
  readonly mode: ConstraintMode = "soft"; // Always soft - reversals are a preference
  readonly description: string;

  private readonly reversalMode: ReversalMode;
  private readonly targetCount?: number;

  constructor(reversalMode: ReversalMode, targetCount?: number) {
    this.reversalMode = reversalMode;
    this.targetCount = targetCount;

    switch (reversalMode) {
      case "every":
        this.description = "Maximize prop reversals (as many as the word allows)";
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
    // First step has no previous - neutral
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

    // Check for reversals in this transition
    const leftReversal = isReversal(
      previousStep.leftMotion.rotationDirection,
      context.candidate.leftMotion.rotationDirection
    );
    const rightReversal = isReversal(
      previousStep.rightMotion.rotationDirection,
      context.candidate.rightMotion.rotationDirection
    );

    // Check if motions are static (can't reverse)
    const leftStatic =
      previousStep.leftMotion.motionType === "static" ||
      context.candidate.leftMotion.motionType === "static";
    const rightStatic =
      previousStep.rightMotion.motionType === "static" ||
      context.candidate.rightMotion.motionType === "static";

    const hasReversal = leftReversal || rightReversal;
    const bothReversed = leftReversal && rightReversal;
    const bothStatic = leftStatic && rightStatic;

    let score: number;
    let reason: string;

    switch (this.reversalMode) {
      case "every":
        // Want reversals - score higher if there are reversals
        if (bothStatic) {
          score = 0.5;
          reason = "Static motion (no rotation to reverse)";
        } else if (bothReversed) {
          score = 1;
          reason = "Both hands reversed";
        } else if (hasReversal) {
          score = 0.75;
          reason = leftReversal ? "Left hand reversed" : "Right hand reversed";
        } else {
          score = 0;
          reason = "No reversal (want reversal every step)";
        }
        break;

      case "minimize":
        // Don't want reversals - score higher if no reversals
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
        // This mode is better evaluated at sequence level
        // For now, treat each step neutrally
        score = 0.5;
        reason = "Count mode (evaluated at sequence level)";
        break;

      default:
        score = 0.5;
        reason = "Unknown reversal mode";
    }

    return {
      score,
      satisfied: true, // Soft constraint - always "satisfied"
      reason,
    };
  }

  couldSatisfy(_candidate: PictographData): boolean {
    // Reversals depend on previous step - all candidates are potentially valid
    return true;
  }
}
