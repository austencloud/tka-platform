/**
 * Dash Preference Constraint
 *
 * Prefers or requires dash motions over shift motions.
 * Used when user wants to "maximize dashes" or "use dash letters".
 *
 * This constraint scores dash motions higher than shifts, enabling
 * the beam search to favor variations and bridges that include dashes.
 */

import { ConstraintType, type ConstraintMode } from "../constraint-types.js";
import type {
  IVariationConstraint,
  ConstraintContext,
  ConstraintScore,
  PictographData,
} from "../types.js";

export type DashPreferenceMode = "maximize" | "require" | "prefer";

export class DashPreferenceConstraint implements IVariationConstraint {
  readonly type = ConstraintType.MOTION_TYPE; // Reuse motion type category
  readonly mode: ConstraintMode;
  readonly description: string;

  private readonly preferenceMode: DashPreferenceMode;

  constructor(preferenceMode: DashPreferenceMode = "maximize") {
    this.preferenceMode = preferenceMode;

    // "require" would be hard mode, others are soft
    this.mode = preferenceMode === "require" ? "hard" : "soft";

    switch (preferenceMode) {
      case "maximize":
        this.description = "Maximize dash motions over shifts";
        break;
      case "require":
        this.description = "Require at least one dash motion per step";
        break;
      case "prefer":
        this.description = "Prefer dash motions when available";
        break;
    }
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    const { candidate } = context;

    const blueDash = candidate.blueMotion.motionType === "dash";
    const redDash = candidate.redMotion.motionType === "dash";
    const blueShift =
      candidate.blueMotion.motionType === "pro" ||
      candidate.blueMotion.motionType === "anti";
    const redShift =
      candidate.redMotion.motionType === "pro" ||
      candidate.redMotion.motionType === "anti";

    // Count dashes vs shifts
    const dashCount = (blueDash ? 1 : 0) + (redDash ? 1 : 0);
    const shiftCount = (blueShift ? 1 : 0) + (redShift ? 1 : 0);

    let score: number;
    let satisfied: boolean;
    let reason: string;

    switch (this.preferenceMode) {
      case "require":
        // Hard mode: must have at least one dash
        satisfied = dashCount >= 1;
        score = satisfied ? 1 : 0;
        reason = dashCount >= 1
          ? `${dashCount} dash motion(s)`
          : "No dash motions (required)";
        break;

      case "maximize":
        // Soft mode: score based on dash count
        // 2 dashes = 1.0, 1 dash = 0.75, 0 dashes = 0.25
        if (dashCount === 2) {
          score = 1.0;
          reason = "Both hands dash (dual-dash)";
        } else if (dashCount === 1) {
          score = 0.75;
          reason = blueDash ? "Blue hand dashes" : "Red hand dashes";
        } else if (shiftCount === 0) {
          // Static - neutral
          score = 0.5;
          reason = "Static motion (no shift or dash)";
        } else {
          // All shifts - lowest score for this constraint
          score = 0.25;
          reason = "Shift motions only (no dashes)";
        }
        satisfied = true; // Soft constraint is always "satisfied"
        break;

      case "prefer":
      default:
        // Softer mode: slight preference for dashes
        if (dashCount >= 1) {
          score = 1.0;
          reason = `${dashCount} dash motion(s)`;
        } else {
          score = 0.5;
          reason = "No dash motions";
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

    // For hard mode, check if there's a dash
    return (
      candidate.blueMotion.motionType === "dash" ||
      candidate.redMotion.motionType === "dash"
    );
  }
}

/**
 * Convenience factories for DashPreferenceConstraint
 */
export function maximizeDashes(): DashPreferenceConstraint {
  return new DashPreferenceConstraint("maximize");
}

export function requireDashes(): DashPreferenceConstraint {
  return new DashPreferenceConstraint("require");
}

export function preferDashes(): DashPreferenceConstraint {
  return new DashPreferenceConstraint("prefer");
}


export type DashAvoidanceMode = "minimize" | "avoid" | "forbid";

/**
 * Dash Avoidance Constraint
 *
 * Prefers shift motions over dash motions.
 * Used when user wants to "minimize dashes", "avoid dashes", or "fewer dashes".
 *
 * This is the inverse of DashPreferenceConstraint - it scores shift motions
 * higher than dashes, enabling the beam search to favor variations and
 * bridges that use shifts instead of dashes.
 */
export class DashAvoidanceConstraint implements IVariationConstraint {
  readonly type = ConstraintType.MOTION_TYPE;
  readonly mode: ConstraintMode;
  readonly description: string;

  private readonly avoidanceMode: DashAvoidanceMode;

  constructor(avoidanceMode: DashAvoidanceMode = "minimize") {
    this.avoidanceMode = avoidanceMode;

    // "forbid" is hard mode, others are soft
    this.mode = avoidanceMode === "forbid" ? "hard" : "soft";

    switch (avoidanceMode) {
      case "minimize":
        this.description = "Minimize dash motions - prefer shifts";
        break;
      case "avoid":
        this.description = "Avoid dash motions when possible";
        break;
      case "forbid":
        this.description = "No dash motions allowed";
        break;
    }
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    const { candidate } = context;

    const blueDash = candidate.blueMotion.motionType === "dash";
    const redDash = candidate.redMotion.motionType === "dash";
    const blueShift =
      candidate.blueMotion.motionType === "pro" ||
      candidate.blueMotion.motionType === "anti";
    const redShift =
      candidate.redMotion.motionType === "pro" ||
      candidate.redMotion.motionType === "anti";

    const dashCount = (blueDash ? 1 : 0) + (redDash ? 1 : 0);
    const shiftCount = (blueShift ? 1 : 0) + (redShift ? 1 : 0);

    let score: number;
    let satisfied: boolean;
    let reason: string;

    switch (this.avoidanceMode) {
      case "forbid":
        // Hard mode: no dashes allowed
        satisfied = dashCount === 0;
        score = satisfied ? 1 : 0;
        reason = dashCount === 0
          ? "No dash motions"
          : `${dashCount} dash motion(s) (forbidden)`;
        break;

      case "minimize":
        // Soft mode: score inversely to dash count
        // 0 dashes = 1.0, 1 dash = 0.5, 2 dashes = 0.25
        if (dashCount === 0) {
          if (shiftCount === 2) {
            score = 1.0;
            reason = "Both hands shift (ideal)";
          } else if (shiftCount === 1) {
            score = 0.9;
            reason = "One hand shifts, one static";
          } else {
            score = 0.75;
            reason = "Static motion (no dashes)";
          }
        } else if (dashCount === 1) {
          score = 0.5;
          reason = blueDash ? "Blue hand dashes (avoid)" : "Red hand dashes (avoid)";
        } else {
          score = 0.25;
          reason = "Both hands dash (avoid)";
        }
        satisfied = true;
        break;

      case "avoid":
      default:
        // Softer mode: penalize dashes but not as strongly
        if (dashCount === 0) {
          score = 1.0;
          reason = "No dash motions";
        } else {
          score = 0.4;
          reason = `${dashCount} dash motion(s) - try to avoid`;
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

    // For hard mode (forbid), check there are no dashes
    return (
      candidate.blueMotion.motionType !== "dash" &&
      candidate.redMotion.motionType !== "dash"
    );
  }
}

/**
 * Convenience factories for DashAvoidanceConstraint
 */
export function minimizeDashes(): DashAvoidanceConstraint {
  return new DashAvoidanceConstraint("minimize");
}

export function avoidDashes(): DashAvoidanceConstraint {
  return new DashAvoidanceConstraint("avoid");
}

export function forbidDashes(): DashAvoidanceConstraint {
  return new DashAvoidanceConstraint("forbid");
}
