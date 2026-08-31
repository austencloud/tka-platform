/**
 * Per-Hand Dash Constraint
 *
 * Controls dash vs shift preference for a specific hand (blue/red).
 * Enables constraints like "blue hand lots of dashes, red hand minimize dashes"
 * or "left hand should dash, right hand should shift".
 *
 * In TKA terminology:
 * - Blue = performer's left hand
 * - Red = performer's right hand
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  PictographData,
} from "../types.js";

export type HandTarget = "blue" | "red";
export type HandDashMode = "maximize" | "minimize" | "require" | "forbid";

export class PerHandDashConstraint implements IVariationConstraint {
  readonly type = ConstraintType.MOTION_TYPE;
  readonly mode: ConstraintMode;
  readonly description: string;
  readonly hand: HandTarget;

  private readonly dashMode: HandDashMode;

  constructor(hand: HandTarget, dashMode: HandDashMode) {
    this.hand = hand;
    this.dashMode = dashMode;

    // "require" and "forbid" are hard mode
    this.mode = dashMode === "require" || dashMode === "forbid" ? "hard" : "soft";

    const handName = hand === "blue" ? "Blue (left)" : "Red (right)";

    switch (dashMode) {
      case "maximize":
        this.description = `${handName} hand: maximize dash motions`;
        break;
      case "minimize":
        this.description = `${handName} hand: minimize dash motions`;
        break;
      case "require":
        this.description = `${handName} hand: must dash`;
        break;
      case "forbid":
        this.description = `${handName} hand: no dashing`;
        break;
    }
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    const { candidate } = context;

    // Get the motion for the target hand
    const motion = this.hand === "blue" ? candidate.blueMotion : candidate.redMotion;
    const isDash = motion.motionType === "dash";
    const isShift = motion.motionType === "pro" || motion.motionType === "anti";
    const isStatic = motion.motionType === "static";

    let score: number;
    let satisfied: boolean;
    let reason: string;

    const handName = this.hand === "blue" ? "Blue" : "Red";

    switch (this.dashMode) {
      case "require":
        // Hard mode: this hand must dash
        satisfied = isDash;
        score = satisfied ? 1 : 0;
        reason = isDash
          ? `${handName} hand dashes`
          : `${handName} hand does not dash (required)`;
        break;

      case "forbid":
        // Hard mode: this hand must NOT dash
        satisfied = !isDash;
        score = satisfied ? 1 : 0;
        reason = !isDash
          ? `${handName} hand does not dash`
          : `${handName} hand dashes (forbidden)`;
        break;

      case "maximize":
        // Soft mode: prefer dash > shift > static for this hand
        if (isDash) {
          score = 1.0;
          reason = `${handName} hand dashes (ideal)`;
        } else if (isShift) {
          score = 0.4;
          reason = `${handName} hand shifts (prefer dash)`;
        } else {
          score = 0.2;
          reason = `${handName} hand static (prefer dash)`;
        }
        satisfied = true;
        break;

      case "minimize":
      default:
        // Soft mode: prefer shift > static > dash for this hand
        if (isShift) {
          score = 1.0;
          reason = `${handName} hand shifts (ideal)`;
        } else if (isStatic) {
          score = 0.8;
          reason = `${handName} hand static (acceptable)`;
        } else {
          score = 0.2;
          reason = `${handName} hand dashes (avoid)`;
        }
        satisfied = true;
        break;
    }

    return { score, satisfied, reason };
  }

  couldSatisfy(candidate: PictographData): boolean {
    if (this.mode === "soft") {
      return true;
    }

    const motion = this.hand === "blue" ? candidate.blueMotion : candidate.redMotion;
    const isDash = motion.motionType === "dash";

    if (this.dashMode === "require") {
      return isDash;
    }
    if (this.dashMode === "forbid") {
      return !isDash;
    }

    return true;
  }
}

/**
 * Convenience factories for per-hand dash constraints
 */

// Blue (left) hand factories
export function blueHandMaximizeDash(): PerHandDashConstraint {
  return new PerHandDashConstraint("blue", "maximize");
}

export function blueHandMinimizeDash(): PerHandDashConstraint {
  return new PerHandDashConstraint("blue", "minimize");
}

export function blueHandRequireDash(): PerHandDashConstraint {
  return new PerHandDashConstraint("blue", "require");
}

export function blueHandForbidDash(): PerHandDashConstraint {
  return new PerHandDashConstraint("blue", "forbid");
}

// Red (right) hand factories
export function redHandMaximizeDash(): PerHandDashConstraint {
  return new PerHandDashConstraint("red", "maximize");
}

export function redHandMinimizeDash(): PerHandDashConstraint {
  return new PerHandDashConstraint("red", "minimize");
}

export function redHandRequireDash(): PerHandDashConstraint {
  return new PerHandDashConstraint("red", "require");
}

export function redHandForbidDash(): PerHandDashConstraint {
  return new PerHandDashConstraint("red", "forbid");
}

/**
 * Generic factory with parameters
 */
export function perHandDash(hand: HandTarget, mode: HandDashMode): PerHandDashConstraint {
  return new PerHandDashConstraint(hand, mode);
}
