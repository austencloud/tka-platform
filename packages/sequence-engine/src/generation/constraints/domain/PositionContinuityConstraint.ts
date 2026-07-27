/**
 * Position Continuity Constraint
 *
 * Sequences must be physically continuous — each step's start position
 * must match the previous step's end position. You can't teleport your
 * hands between steps. This is the most fundamental hard constraint
 * in sequence generation.
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IConstraint,
  ConstraintContext,
  ConstraintScore,
} from "../types.js";

export class PositionContinuityConstraint implements IConstraint {
  readonly type = ConstraintType.POSITION_CONTINUITY;
  readonly mode: ConstraintMode = "hard";
  readonly description =
    "Ensures position continuity between consecutive steps";

  evaluate(context: ConstraintContext): ConstraintScore {
    if (context.previousSteps.length === 0) {
      return {
        score: 1,
        satisfied: true,
        reason: "First step - no continuity required",
      };
    }

    const lastStep = context.previousSteps[context.previousSteps.length - 1]!;
    const prevEnd = lastStep.endPosition;
    const candidateStart = context.candidate.startPosition;

    if (prevEnd === candidateStart) {
      return {
        score: 1,
        satisfied: true,
        reason: "Position continuity maintained",
      };
    }

    return {
      score: 0,
      satisfied: false,
      reason: `Position break: previous ended at ${prevEnd}, candidate starts at ${candidateStart}`,
    };
  }
}
