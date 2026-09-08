/**
 * Rotation Direction Constraint
 *
 * Filters or prefers specific rotation directions (cw/ccw) for one or both hands.
 *
 * Examples:
 * - "left clockwise" - require left hand to rotate clockwise
 * - "all counter-clockwise" - require both hands CCW
 * - "prefer cw" - soft preference for clockwise
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  PictographData,
} from "../types.js";

export type RotationDirectionMode = "require" | "prefer";
export type RotationDirection = "cw" | "ccw";
export type HandTarget = "left" | "right" | "both";

export interface RotationDirectionConstraintOptions {
  /** The rotation direction to target */
  direction: RotationDirection;

  /** Which hand(s) this applies to */
  hand: HandTarget;

  /** How to apply the constraint */
  mode: RotationDirectionMode;
}

export class RotationDirectionConstraint implements IVariationConstraint {
  readonly type = ConstraintType.ROTATION_DIRECTION;
  readonly mode: ConstraintMode;
  readonly description: string;

  private readonly options: RotationDirectionConstraintOptions;

  constructor(options: RotationDirectionConstraintOptions) {
    this.options = options;
    this.mode = options.mode === "prefer" ? "soft" : "hard";

    const handStr =
      options.hand === "both" ? "both hands" : `${options.hand} hand`;
    const dirStr =
      options.direction === "cw" ? "clockwise" : "counter-clockwise";

    this.description =
      options.mode === "require"
        ? `Require ${dirStr} rotation for ${handStr}`
        : `Prefer ${dirStr} rotation for ${handStr}`;
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    return this.evaluateVariation(context.candidate);
  }

  couldSatisfy(candidate: PictographData): boolean {
    if (this.mode === "soft") {
      return true;
    }
    return this.checkSatisfaction(candidate);
  }

  private evaluateVariation(candidate: PictographData): ConstraintScore {
    const { direction, hand, mode } = this.options;

    const leftDir = candidate.leftMotion.rotationDirection;
    const rightDir = candidate.rightMotion.rotationDirection;

    // Static motions have no rotation - treat as neutral
    const leftStatic =
      candidate.leftMotion.motionType === "static" ||
      leftDir === "no_rot" ||
      leftDir === "noRotation";
    const rightStatic =
      candidate.rightMotion.motionType === "static" ||
      rightDir === "no_rot" ||
      rightDir === "noRotation";

    // Check for match
    const leftMatch = leftStatic ? true : leftDir === direction;
    const rightMatch = rightStatic ? true : rightDir === direction;

    let score: number;
    let satisfied: boolean;
    let reason: string;

    switch (hand) {
      case "left":
        if (leftStatic) {
          score = 0.5;
          satisfied = true;
          reason = "Left hand is static (no rotation)";
        } else {
          score = leftMatch ? 1 : 0;
          satisfied = leftMatch;
          reason = leftMatch
            ? `Left hand is ${direction}`
            : `Left hand is ${leftDir} (expected ${direction})`;
        }
        break;

      case "right":
        if (rightStatic) {
          score = 0.5;
          satisfied = true;
          reason = "Right hand is static (no rotation)";
        } else {
          score = rightMatch ? 1 : 0;
          satisfied = rightMatch;
          reason = rightMatch
            ? `Right hand is ${direction}`
            : `Right hand is ${rightDir} (expected ${direction})`;
        }
        break;

      case "both":
      default:
        if (leftStatic && rightStatic) {
          score = 0.5;
          satisfied = true;
          reason = "Both hands are static";
        } else if (leftMatch && rightMatch) {
          score = 1;
          satisfied = true;
          reason = `Both hands are ${direction}`;
        } else if (leftMatch || rightMatch) {
          score = 0.5;
          satisfied = false;
          reason = leftMatch
            ? `Only left hand is ${direction}`
            : `Only right hand is ${direction}`;
        } else {
          score = 0;
          satisfied = false;
          reason = `Neither hand is ${direction}`;
        }
        break;
    }

    // For prefer mode, soften the penalty
    if (mode === "prefer" && score < 1) {
      score = 0.5 + score * 0.5;
    }

    return { score, satisfied, reason };
  }

  private checkSatisfaction(candidate: PictographData): boolean {
    const { direction, hand } = this.options;

    const leftDir = candidate.leftMotion.rotationDirection;
    const rightDir = candidate.rightMotion.rotationDirection;

    const leftStatic =
      candidate.leftMotion.motionType === "static" ||
      leftDir === "no_rot" ||
      leftDir === "noRotation";
    const rightStatic =
      candidate.rightMotion.motionType === "static" ||
      rightDir === "no_rot" ||
      rightDir === "noRotation";

    const leftOk = leftStatic || leftDir === direction;
    const rightOk = rightStatic || rightDir === direction;

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
 * Convenience factories
 */
export function leftClockwise(): RotationDirectionConstraint {
  return new RotationDirectionConstraint({
    direction: "cw",
    hand: "left",
    mode: "require",
  });
}

export function leftCounterClockwise(): RotationDirectionConstraint {
  return new RotationDirectionConstraint({
    direction: "ccw",
    hand: "left",
    mode: "require",
  });
}

export function rightClockwise(): RotationDirectionConstraint {
  return new RotationDirectionConstraint({
    direction: "cw",
    hand: "right",
    mode: "require",
  });
}

export function rightCounterClockwise(): RotationDirectionConstraint {
  return new RotationDirectionConstraint({
    direction: "ccw",
    hand: "right",
    mode: "require",
  });
}

export function allClockwise(): RotationDirectionConstraint {
  return new RotationDirectionConstraint({
    direction: "cw",
    hand: "both",
    mode: "require",
  });
}

export function allCounterClockwise(): RotationDirectionConstraint {
  return new RotationDirectionConstraint({
    direction: "ccw",
    hand: "both",
    mode: "require",
  });
}
