/**
 * Motion Type Constraint
 *
 * Filters or prefers specific motion types for one or both hands.
 *
 * Supported motion types: pro, anti, static, dash, float
 *
 * Examples:
 * - "all pro motions" - require both hands to be pro
 * - "left pro only" - require left hand to be pro
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

export type HandTarget = "left" | "right" | "both";

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

    const leftMotion = candidate.leftMotion.motionType;
    const rightMotion = candidate.rightMotion.motionType;

    let leftMatch = false;
    let rightMatch = false;

    // Check for match based on mode
    if (mode === "exclude") {
      leftMatch = leftMotion !== motionType;
      rightMatch = rightMotion !== motionType;
    } else {
      leftMatch = leftMotion === motionType;
      rightMatch = rightMotion === motionType;
    }

    // Calculate score based on target hand
    let score: number;
    let satisfied: boolean;
    let reason: string;

    switch (hand) {
      case "left":
        score = leftMatch ? 1 : 0;
        satisfied = leftMatch;
        reason = leftMatch
          ? `Left hand is ${mode === "exclude" ? "not " : ""}${motionType}`
          : `Left hand is ${leftMotion} (expected ${mode === "exclude" ? "not " : ""}${motionType})`;
        break;

      case "right":
        score = rightMatch ? 1 : 0;
        satisfied = rightMatch;
        reason = rightMatch
          ? `Right hand is ${mode === "exclude" ? "not " : ""}${motionType}`
          : `Right hand is ${rightMotion} (expected ${mode === "exclude" ? "not " : ""}${motionType})`;
        break;

      case "both":
      default:
        score = (leftMatch && rightMatch) ? 1 : (leftMatch || rightMatch) ? 0.5 : 0;
        satisfied = leftMatch && rightMatch;
        if (leftMatch && rightMatch) {
          reason = `Both hands are ${mode === "exclude" ? "not " : ""}${motionType}`;
        } else if (leftMatch) {
          reason = `Only left hand is ${mode === "exclude" ? "not " : ""}${motionType}`;
        } else if (rightMatch) {
          reason = `Only right hand is ${mode === "exclude" ? "not " : ""}${motionType}`;
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

    const leftMotion = candidate.leftMotion.motionType;
    const rightMotion = candidate.rightMotion.motionType;

    let leftOk: boolean;
    let rightOk: boolean;

    if (mode === "exclude") {
      leftOk = leftMotion !== motionType;
      rightOk = rightMotion !== motionType;
    } else {
      leftOk = leftMotion === motionType;
      rightOk = rightMotion === motionType;
    }

    switch (hand) {
      case "left":
        return leftOk;
      case "right":
        return rightOk;
      case "both":
      default:
        return leftOk && rightOk;
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
