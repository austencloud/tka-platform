/**
 * Constraint Presets
 *
 * Pre-configured constraint sets for common generation styles.
 * These are the options exposed to users in the UI.
 */

import { ContinuityConstraint } from "../implementations/ContinuityConstraint";
import { ReversalConstraint } from "../implementations/ReversalConstraint";
import type { ConstraintSet } from "../types";

/**
 * Preset identifier for UI selection.
 */
export type ConstraintPresetId =
  | "natural"
  | "smooth"
  | "high-reversal"
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
    id: "natural",
    label: "Natural",
    description: "Balanced flow with occasional direction changes",
    icon: "fa-leaf",
  },
  {
    id: "high-reversal",
    label: "High Reversal",
    description: "Maximize direction changes for dynamic movement",
    icon: "fa-bolt",
  },
];

/**
 * Create a constraint set from a preset ID.
 */
export function createConstraintSet(presetId: ConstraintPresetId): ConstraintSet {
  switch (presetId) {
    case "smooth":
      return {
        hard: [],
        soft: [
          new ContinuityConstraint("maximize"),
          new ReversalConstraint("minimize"),
        ],
      };

    case "high-reversal":
      return {
        hard: [],
        soft: [
          new ReversalConstraint("every"),
        ],
      };

    case "natural":
      return {
        hard: [],
        soft: [
          new ContinuityConstraint("allow"),
          new ReversalConstraint("minimize"),
        ],
      };

    case "random":
    case "custom":
    default:
      return {
        hard: [],
        soft: [],
      };
  }
}

/**
 * Get preset metadata by ID.
 */
export function getPresetMeta(presetId: ConstraintPresetId): ConstraintPresetMeta | undefined {
  return CONSTRAINT_PRESETS.find((p) => p.id === presetId);
}
