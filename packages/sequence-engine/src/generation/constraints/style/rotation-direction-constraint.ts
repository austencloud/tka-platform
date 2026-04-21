/**
 * Rotation Direction Constraint
 *
 * Filters or prefers specific rotation directions (cw/ccw) for one or both hands.
 *
 * Examples:
 * - "blue clockwise" - require blue hand to rotate clockwise
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
export type HandTarget = "blue" | "red" | "both";

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
    const dirStr = options.direction === "cw" ? "clockwise" : "counter-clockwise";

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

    const blueDir = candidate.blueMotion.rotationDirection as string;
    const redDir = candidate.redMotion.rotationDirection as string;

    // Static motions have no rotation - treat as neutral
    const blueStatic =
      candidate.blueMotion.motionType === "static" ||
      blueDir === "no_rot" ||
      blueDir === "noRotation";
    const redStatic =
      candidate.redMotion.motionType === "static" ||
      redDir === "no_rot" ||
      redDir === "noRotation";

    // Check for match
    const blueMatch = blueStatic ? true : blueDir === direction;
    const redMatch = redStatic ? true : redDir === direction;

    let score: number;
    let satisfied: boolean;
    let reason: string;

    switch (hand) {
      case "blue":
        if (blueStatic) {
          score = 0.5;
          satisfied = true;
          reason = "Blue hand is static (no rotation)";
        } else {
          score = blueMatch ? 1 : 0;
          satisfied = blueMatch;
          reason = blueMatch
            ? `Blue hand is ${direction}`
            : `Blue hand is ${blueDir} (expected ${direction})`;
        }
        break;

      case "red":
        if (redStatic) {
          score = 0.5;
          satisfied = true;
          reason = "Red hand is static (no rotation)";
        } else {
          score = redMatch ? 1 : 0;
          satisfied = redMatch;
          reason = redMatch
            ? `Red hand is ${direction}`
            : `Red hand is ${redDir} (expected ${direction})`;
        }
        break;

      case "both":
      default:
        if (blueStatic && redStatic) {
          score = 0.5;
          satisfied = true;
          reason = "Both hands are static";
        } else if (blueMatch && redMatch) {
          score = 1;
          satisfied = true;
          reason = `Both hands are ${direction}`;
        } else if (blueMatch || redMatch) {
          score = 0.5;
          satisfied = false;
          reason = blueMatch
            ? `Only blue hand is ${direction}`
            : `Only red hand is ${direction}`;
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

    const blueDir = candidate.blueMotion.rotationDirection as string;
    const redDir = candidate.redMotion.rotationDirection as string;

    const blueStatic =
      candidate.blueMotion.motionType === "static" ||
      blueDir === "no_rot" ||
      blueDir === "noRotation";
    const redStatic =
      candidate.redMotion.motionType === "static" ||
      redDir === "no_rot" ||
      redDir === "noRotation";

    const blueOk = blueStatic || blueDir === direction;
    const redOk = redStatic || redDir === direction;

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
 * Convenience factories
 */
export function blueClockwise(): RotationDirectionConstraint {
  return new RotationDirectionConstraint({
    direction: "cw",
    hand: "blue",
    mode: "require",
  });
}

export function blueCounterClockwise(): RotationDirectionConstraint {
  return new RotationDirectionConstraint({
    direction: "ccw",
    hand: "blue",
    mode: "require",
  });
}

export function redClockwise(): RotationDirectionConstraint {
  return new RotationDirectionConstraint({
    direction: "cw",
    hand: "red",
    mode: "require",
  });
}

export function redCounterClockwise(): RotationDirectionConstraint {
  return new RotationDirectionConstraint({
    direction: "ccw",
    hand: "red",
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
