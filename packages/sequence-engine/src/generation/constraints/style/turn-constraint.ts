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
    const blueTurns = candidate.blueMotion.turns ?? 0;
    const redTurns = candidate.redMotion.turns ?? 0;

    const blueMatch = blueTurns === this.requiredTurns;
    const redMatch = redTurns === this.requiredTurns;
    const satisfied = blueMatch && redMatch;

    let reason: string;
    if (satisfied) {
      reason = `Both hands have ${this.requiredTurns} turn(s)`;
    } else if (!blueMatch && !redMatch) {
      reason = `Blue has ${blueTurns}, red has ${redTurns} (need ${this.requiredTurns})`;
    } else {
      const failing = blueMatch ? "red" : "blue";
      const actual = blueMatch ? redTurns : blueTurns;
      reason = `${failing} has ${actual} turn(s) (need ${this.requiredTurns})`;
    }

    return { score: satisfied ? 1 : 0, satisfied, reason };
  }

  private checkMatch(candidate: PictographData): boolean {
    const blueTurns = candidate.blueMotion.turns ?? 0;
    const redTurns = candidate.redMotion.turns ?? 0;
    return blueTurns === this.requiredTurns && redTurns === this.requiredTurns;
  }
}
