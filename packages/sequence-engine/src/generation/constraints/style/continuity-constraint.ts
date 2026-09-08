/**
 * Continuity Constraint
 *
 * Maximizes or enforces continuity in rotation direction between consecutive steps.
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
    (prev === "cw" && current === "ccw") ||
    (prev === "ccw" && current === "cw")
  );
}

/**
 * through previous steps. Returns null if none found.
 */
function findLastDirection(
  steps: PictographData[],
  hand: "left" | "right",
): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (!step) continue;
    const dir = (hand === "left"
      ? step.leftMotion.rotationDirection
      : step.rightMotion.rotationDirection) as string | undefined;
    if (dir && dir !== "noRotation" && dir !== "no_rot") {
      return dir;
    }
  }
  return null;
}

/**
 * the last real direction in previousSteps.
 *
 * Instead of only comparing adjacent steps (which gives 0-turn statics a
 * free pass), we look back through ALL previous steps to find the last
 * direction that was actually set. This way a reversal hidden behind one
 * or more noRotation steps is still penalized.
 */
function scoreHandContinuity(
  previousSteps: PictographData[],
  candidateDir: string,
  hand: "left" | "right",
): number {
  const hasNoDir = !candidateDir || candidateDir === "noRotation" || candidateDir === "no_rot";
  if (hasNoDir) return 0.5; // Candidate has no direction — neutral

  const lastDir = findLastDirection(previousSteps, hand);
  if (!lastDir) return 0.5; // No previous direction — neutral

  return isReversal(lastDir, candidateDir) ? 0 : 1;
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

    // Look back through ALL previous steps to find the last real direction,
    // not just the immediately preceding step. This prevents 0-turn statics
    // (noRotation) from hiding reversals.
    const leftScore = scoreHandContinuity(
      context.previousSteps,
      context.candidate.leftMotion.rotationDirection,
      "left",
    );
    const rightScore = scoreHandContinuity(
      context.previousSteps,
      context.candidate.rightMotion.rotationDirection,
      "right",
    );

    // Average of both hands
    const avgScore = (leftScore + rightScore) / 2;

    // For "enforce" mode, block actual reversals (score 0) but allow
    // static transitions (score 0.5) — static isn't a reversal, it's neutral.
    const satisfied =
      this.continuityMode !== "enforce" ||
      (leftScore > 0 && rightScore > 0);

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
