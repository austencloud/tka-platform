/**
 * Constraints Module
 *
 * Exports all constraint types, implementations, and presets.
 */

// Type definitions
export * from "./constraint-types";
export * from "./types";

// Constraint implementations
export { ContinuityConstraint, type ContinuityMode } from "./continuity-constraint";
export { ReversalConstraint, type ReversalMode } from "./reversal-constraint";
export { HandPathConstraint, type HandPathConstraintMode, HandPath as ConstraintHandPath } from "./hand-path-constraint";

// Presets
export {
  CONSTRAINT_PRESETS,
  createConstraintSet,
  getPresetMeta,
  type ConstraintPresetId,
  type ConstraintPresetMeta,
  type ConstraintSetOptions,
} from "./presets/constraint-presets";
