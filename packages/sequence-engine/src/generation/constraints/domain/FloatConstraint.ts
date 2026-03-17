/**
 * Float Constraint
 *
 * Float is a special motion state where the prop "floats" — it has momentum
 * but no active input from the spinner. Float handling is primarily a
 * post-processing concern (converting a regular motion into its float
 * equivalent after turn allocation decides a hand gets float).
 *
 * This constraint validates that candidates are compatible with float
 * assignments. Full implementation requires turn allocation integration
 * (Chunk 4 of the engine plan).
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IConstraint,
  ConstraintContext,
  ConstraintScore,
} from "../types.js";

export class FloatConstraint implements IConstraint {
  readonly type = ConstraintType.FLOAT;
  readonly mode: ConstraintMode = "hard";
  readonly description = "Validates float motion compatibility";

  evaluate(_context: ConstraintContext): ConstraintScore {
    // Float handling is primarily done during turn allocation and post-processing.
    // This constraint ensures candidates are compatible with float assignments.
    // Full implementation requires turn allocation integration (Chunk 4).
    return {
      score: 1,
      satisfied: true,
      reason: "Float check deferred to post-processing",
    };
  }
}
