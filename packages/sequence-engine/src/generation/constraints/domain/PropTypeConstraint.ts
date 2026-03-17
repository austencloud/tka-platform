/**
 * Prop Type Constraint
 *
 * Filters pictograph variations to match the user's selected prop type
 * (staff, fan, club, etc.). Some variations are only valid for certain props
 * because of physical constraints — a fan can do things a staff can't.
 *
 * Currently delegates filtering to the IVariationProvider level, since
 * PictographData doesn't carry a propType field yet.
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IConstraint,
  ConstraintContext,
  ConstraintScore,
} from "../types.js";

export class PropTypeConstraint implements IConstraint {
  readonly type = ConstraintType.PROP_TYPE;
  readonly mode: ConstraintMode = "hard";
  readonly description = "Filters variations to match selected prop type";

  evaluate(context: ConstraintContext): ConstraintScore {
    if (!context.propType) {
      return {
        score: 1,
        satisfied: true,
        reason: "No prop type filter active",
      };
    }

    // TODO: Extend PictographData with propType field when wiring consumers.
    // For now, prop type filtering happens at the IVariationProvider level,
    // which only returns variations compatible with the selected prop.
    return {
      score: 1,
      satisfied: true,
      reason: "Prop type check delegated to variation provider",
    };
  }
}
