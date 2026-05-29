/**
 * Constraint Presets
 *
 * Pre-configured constraint sets for common generation styles.
 * These are the options exposed to users in the UI.
 */

import { ContinuityConstraint } from "../continuity-constraint";
import { ReversalConstraint } from "../reversal-constraint";
import { HandPathConstraint } from "../hand-path-constraint";
import type { ConstraintSet } from "../types";

/**
 * Preset identifier for UI selection.
 */
export type ConstraintPresetId =
  | "smooth"
  | "mixed"
  | "choppy"
  | "random"
  | "custom";

/**
 * Preset metadata for UI display.
 */
export interface ConstraintPresetMeta {
  id: ConstraintPresetId;
  label: string;
  description: string;
  icon: string;
}

/**
 * All available presets with their metadata.
 */
export const CONSTRAINT_PRESETS: ConstraintPresetMeta[] = [
  {
    id: "smooth",
    label: "Smooth",
    description: "Minimize direction changes for continuous flow",
    icon: "fa-water",
  },
  {
    id: "mixed",
    label: "Mixed",
    description: "Balanced flow with occasional direction changes",
    icon: "fa-leaf",
  },
  {
    id: "choppy",
    label: "Choppy",
    description: "Maximize direction changes for dynamic movement",
    icon: "fa-bolt",
  },
];

/**
 * Options for creating a constraint set.
 */
export interface ConstraintSetOptions {
  /** Hand path reversal mode: 'smooth' = minimize, 'mixed' = balanced, 'choppy' = maximize */
  handPathMode?: "smooth" | "mixed" | "choppy";
}

/**
 * Create a constraint set from a preset ID with optional customizations.
 */
export function createConstraintSet(
  presetId: ConstraintPresetId,
  options?: ConstraintSetOptions
): ConstraintSet {
  const softConstraints: ConstraintSet["soft"] = [];

  // Base constraints from preset
  switch (presetId) {
    case "smooth":
      softConstraints.push(
        new ContinuityConstraint("maximize"),
        new ReversalConstraint("minimize")
      );
      break;

    case "choppy":
      softConstraints.push(new ReversalConstraint("every"));
      break;

    case "mixed":
      softConstraints.push(
        new ContinuityConstraint("allow"),
        new ReversalConstraint("minimize")
      );
      break;

    case "random":
    case "custom":
    default:
      // No base constraints
      break;
  }

  // Add hand path constraint based on user preference
  // Spectrum: smooth (minimize) → mixed (allow) → choppy (maximize reversals)
  if (options?.handPathMode === "smooth") {
    softConstraints.push(new HandPathConstraint("maximize")); // maximize continuity = minimize reversals
  } else if (options?.handPathMode === "mixed") {
    softConstraints.push(new HandPathConstraint("allow")); // balanced, no strong preference
  } else if (options?.handPathMode === "choppy") {
    softConstraints.push(new HandPathConstraint("every")); // maximize reversals
  }

  return {
    hard: [],
    soft: softConstraints,
  };
}

/**
 * Get preset metadata by ID.
 */
export function getPresetMeta(presetId: ConstraintPresetId): ConstraintPresetMeta | undefined {
  return CONSTRAINT_PRESETS.find((p) => p.id === presetId);
}
