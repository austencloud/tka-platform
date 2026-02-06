/**
 * VTG Timing Constraint
 *
 * Enforces VTG (Vulcan Tech Gospel) compatibility by requiring each hand
 * to maintain consistent motion type and rotation direction across all
 * beats of a cycle.
 *
 * VTG assumes rotational inertia: once a hand is spinning pro/clockwise,
 * it stays pro/clockwise throughout the entire pattern. TKA has full
 * per-step granularity, so this constraint restricts to the VTG subset.
 *
 * Blue and red hands CAN differ from each other — the constraint only
 * enforces that each hand is internally consistent.
 *
 * Turn counts (1:1, 3:1, 5:1, etc.) are applied uniformly post-generation,
 * not during the constraint evaluation. This constraint ensures the
 * structural pattern is VTG-describable.
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  PictographData,
  MotionData,
} from "../types.js";

/**
 * Snapshot of one hand's motion signature from the first beat.
 */
interface HandSignature {
  motionType: string;
  rotationDirection: string;
}

/**
 * Extract the motion signature relevant for VTG consistency.
 * Static motions are excluded from rotation direction checks.
 */
function getSignature(motion: MotionData): HandSignature {
  return {
    motionType: motion.motionType,
    rotationDirection: motion.rotationDirection,
  };
}

/**
 * Check if a hand's current motion matches its reference signature.
 */
function handMatches(
  reference: HandSignature,
  current: MotionData
): { matches: boolean; reason: string } {
  // Motion type must match (pro stays pro, anti stays anti)
  if (current.motionType !== reference.motionType) {
    return {
      matches: false,
      reason: `motion type changed from ${reference.motionType} to ${current.motionType}`,
    };
  }

  // For non-static motions, rotation direction must match
  if (
    reference.motionType !== "static" &&
    current.rotationDirection !== reference.rotationDirection
  ) {
    return {
      matches: false,
      reason: `rotation changed from ${reference.rotationDirection} to ${current.rotationDirection}`,
    };
  }

  return { matches: true, reason: "consistent" };
}

export class VtgTimingConstraint implements IVariationConstraint {
  readonly type = ConstraintType.VTG_TIMING;
  readonly mode: ConstraintMode;
  readonly description: string;

  constructor(mode: ConstraintMode = "hard") {
    this.mode = mode;
    this.description =
      mode === "hard"
        ? "Require VTG-compatible motion consistency (each hand maintains its motion type and rotation direction)"
        : "Prefer VTG-compatible motion consistency";
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    // First step establishes the reference — always satisfied
    if (context.previousSteps.length === 0) {
      return {
        score: 1,
        satisfied: true,
        reason: "First step (establishes VTG reference)",
      };
    }

    // Get the reference from the first step
    const firstStep = context.previousSteps[0]!;
    const blueRef = getSignature(firstStep.blueMotion);
    const redRef = getSignature(firstStep.redMotion);

    // Check candidate against reference
    const blueCheck = handMatches(blueRef, context.candidate.blueMotion);
    const redCheck = handMatches(redRef, context.candidate.redMotion);

    const bothMatch = blueCheck.matches && redCheck.matches;

    if (bothMatch) {
      return {
        score: 1,
        satisfied: true,
        reason: "VTG-consistent (both hands match reference)",
      };
    }

    // Build failure reason
    const reasons: string[] = [];
    if (!blueCheck.matches) reasons.push(`Blue: ${blueCheck.reason}`);
    if (!redCheck.matches) reasons.push(`Red: ${redCheck.reason}`);

    // Score: 0.5 if one hand matches, 0 if neither
    const score = blueCheck.matches || redCheck.matches ? 0.5 : 0;

    return {
      score,
      satisfied: false,
      reason: `VTG violation: ${reasons.join("; ")}`,
    };
  }

  couldSatisfy(_candidate: PictographData): boolean {
    // Can't determine without knowing the first step's reference
    return true;
  }
}

// ---------------------------------------------------------------------------
// Convenience factories
// ---------------------------------------------------------------------------

/** Hard constraint: require VTG-compatible motion consistency */
export function enforceVtgTiming(): VtgTimingConstraint {
  return new VtgTimingConstraint("hard");
}

/** Soft constraint: prefer VTG-compatible motion consistency */
export function preferVtgTiming(): VtgTimingConstraint {
  return new VtgTimingConstraint("soft");
}
