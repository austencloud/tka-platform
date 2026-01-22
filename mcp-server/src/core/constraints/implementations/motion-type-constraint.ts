/**
 * Motion Type Constraint
 *
 * Filters or prefers specific motion types for one or both hands.
 *
 * Supported motion types: pro, anti, static, dash, float
 *
 * Examples:
 * - "all pro motions" - require both hands to be pro
 * - "blue pro only" - require blue hand to be pro
 * - "no dash" - exclude dash motions
 * - "prefer anti" - soft preference for anti motions
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  PictographData,
} from "../types.js";

export type MotionTypeMode =
  | "require" // Hard: must be this type
  | "prefer" // Soft: score higher if this type
  | "exclude"; // Hard: must NOT be this type

export type HandTarget = "blue" | "red" | "both";

export interface MotionTypeConstraintOptions {
  /** The motion type to target */
  motionType: string;

  /** Which hand(s) this applies to */
  hand: HandTarget;

  /** How to apply the constraint */
  mode: MotionTypeMode;
}

export class MotionTypeConstraint implements IVariationConstraint {
  readonly type = ConstraintType.MOTION_TYPE;
  readonly mode: ConstraintMode;
  readonly description: string;

  private readonly options: MotionTypeConstraintOptions;

  constructor(options: MotionTypeConstraintOptions) {
    this.options = options;

    // Determine hard vs soft
    this.mode = options.mode === "prefer" ? "soft" : "hard";

    // Build description
    const handStr =
      options.hand === "both" ? "both hands" : `${options.hand} hand`;
    switch (options.mode) {
      case "require":
        this.description = `Require ${options.motionType} motion for ${handStr}`;
        break;
      case "prefer":
        this.description = `Prefer ${options.motionType} motion for ${handStr}`;
        break;
      case "exclude":
        this.description = `Exclude ${options.motionType} motion from ${handStr}`;
        break;
    }
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    return this.evaluateVariation(context.candidate);
  }

  /**
   * Quick check for hard constraints.
   */
  couldSatisfy(candidate: PictographData): boolean {
    if (this.mode === "soft") {
      return true; // Soft constraints don't filter
    }

    return this.checkSatisfaction(candidate);
  }

  /**
   * Internal evaluation logic.
   */
  private evaluateVariation(candidate: PictographData): ConstraintScore {
    const { motionType, hand, mode } = this.options;

    const blueMotion = candidate.blueMotion.motionType;
    const redMotion = candidate.redMotion.motionType;

    let blueMatch = false;
    let redMatch = false;

    // Check for match based on mode
    if (mode === "exclude") {
      blueMatch = blueMotion !== motionType;
      redMatch = redMotion !== motionType;
    } else {
      blueMatch = blueMotion === motionType;
      redMatch = redMotion === motionType;
    }

    // Calculate score based on target hand
    let score: number;
    let satisfied: boolean;
    let reason: string;

    switch (hand) {
      case "blue":
        score = blueMatch ? 1 : 0;
        satisfied = blueMatch;
        reason = blueMatch
          ? `Blue hand is ${mode === "exclude" ? "not " : ""}${motionType}`
          : `Blue hand is ${blueMotion} (expected ${mode === "exclude" ? "not " : ""}${motionType})`;
        break;

      case "red":
        score = redMatch ? 1 : 0;
        satisfied = redMatch;
        reason = redMatch
          ? `Red hand is ${mode === "exclude" ? "not " : ""}${motionType}`
          : `Red hand is ${redMotion} (expected ${mode === "exclude" ? "not " : ""}${motionType})`;
        break;

      case "both":
      default:
        score = (blueMatch && redMatch) ? 1 : (blueMatch || redMatch) ? 0.5 : 0;
        satisfied = blueMatch && redMatch;
        if (blueMatch && redMatch) {
          reason = `Both hands are ${mode === "exclude" ? "not " : ""}${motionType}`;
        } else if (blueMatch) {
          reason = `Only blue hand is ${mode === "exclude" ? "not " : ""}${motionType}`;
        } else if (redMatch) {
          reason = `Only red hand is ${mode === "exclude" ? "not " : ""}${motionType}`;
        } else {
          reason = `Neither hand is ${mode === "exclude" ? "not " : ""}${motionType}`;
        }
        break;
    }

    // For "prefer" mode, adjust score to be less penalizing
    if (mode === "prefer" && score < 1) {
      score = 0.5 + score * 0.5; // Range: 0.5 to 1.0
    }

    return { score, satisfied, reason };
  }

  private checkSatisfaction(candidate: PictographData): boolean {
    const { motionType, hand, mode } = this.options;

    const blueMotion = candidate.blueMotion.motionType;
    const redMotion = candidate.redMotion.motionType;

    let blueOk: boolean;
    let redOk: boolean;

    if (mode === "exclude") {
      blueOk = blueMotion !== motionType;
      redOk = redMotion !== motionType;
    } else {
      blueOk = blueMotion === motionType;
      redOk = redMotion === motionType;
    }

    switch (hand) {
      case "blue":
        return blueOk;
      case "red":
        return redOk;
      case "both":
      default:
        return blueOk && redOk;
    }
  }
}

/**
 * Convenience factory functions
 */
export function allProMotions(): MotionTypeConstraint {
  return new MotionTypeConstraint({
    motionType: "pro",
    hand: "both",
    mode: "require",
  });
}

export function allAntiMotions(): MotionTypeConstraint {
  return new MotionTypeConstraint({
    motionType: "anti",
    hand: "both",
    mode: "require",
  });
}

export function noDashMotions(): MotionTypeConstraint {
  return new MotionTypeConstraint({
    motionType: "dash",
    hand: "both",
    mode: "exclude",
  });
}

export function noStaticMotions(): MotionTypeConstraint {
  return new MotionTypeConstraint({
    motionType: "static",
    hand: "both",
    mode: "exclude",
  });
}

export function preferProMotions(): MotionTypeConstraint {
  return new MotionTypeConstraint({
    motionType: "pro",
    hand: "both",
    mode: "prefer",
  });
}

export function preferAntiMotions(): MotionTypeConstraint {
  return new MotionTypeConstraint({
    motionType: "anti",
    hand: "both",
    mode: "prefer",
  });
}
