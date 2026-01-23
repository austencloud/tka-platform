/**
 * Constraints Module
 *
 * Exports all constraint types, implementations, and presets.
 */

// Type definitions
export * from "./constraint-types";
export * from "./types";

// Constraint implementations
export { ContinuityConstraint, type ContinuityMode } from "./implementations/ContinuityConstraint";
export { ReversalConstraint, type ReversalMode } from "./implementations/ReversalConstraint";

// Presets
export {
  CONSTRAINT_PRESETS,
  createConstraintSet,
  getPresetMeta,
  type ConstraintPresetId,
  type ConstraintPresetMeta,
} from "./presets/ConstraintPresets";
