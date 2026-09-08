/**
 * Turn Constraint
 *
 * Filters variations by their turn value. Hard constraint — if you
 * ask for zero turns, you get zero turns. Required for the "isolation"
 * preset (pro shift at zero turns).
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  PictographData,
} from "../types.js";

export class TurnConstraint implements IVariationConstraint {
  readonly type = ConstraintType.TURN;
  readonly mode: ConstraintMode = "hard";
  readonly description: string;

  constructor(private readonly requiredTurns: number) {
    this.description = `Require ${requiredTurns} turn(s) for both hands`;
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    return this.evaluateVariation(context.candidate);
  }

  couldSatisfy(candidate: PictographData): boolean {
    return this.checkMatch(candidate);
  }

  private evaluateVariation(candidate: PictographData): ConstraintScore {
    const leftTurns = candidate.leftMotion.turns ?? 0;
    const rightTurns = candidate.rightMotion.turns ?? 0;

    const leftMatch = leftTurns === this.requiredTurns;
    const rightMatch = rightTurns === this.requiredTurns;
    const satisfied = leftMatch && rightMatch;

    let reason: string;
    if (satisfied) {
      reason = `Both hands have ${this.requiredTurns} turn(s)`;
    } else if (!leftMatch && !rightMatch) {
      reason = `Left has ${leftTurns}, right has ${rightTurns} (need ${this.requiredTurns})`;
    } else {
      const failing = leftMatch ? "right" : "left";
      const actual = leftMatch ? rightTurns : leftTurns;
      reason = `${failing} has ${actual} turn(s) (need ${this.requiredTurns})`;
    }

    return { score: satisfied ? 1 : 0, satisfied, reason };
  }

  private checkMatch(candidate: PictographData): boolean {
    const leftTurns = candidate.leftMotion.turns ?? 0;
    const rightTurns = candidate.rightMotion.turns ?? 0;
    return leftTurns === this.requiredTurns && rightTurns === this.requiredTurns;
  }
}
