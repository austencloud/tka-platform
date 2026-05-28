/**
 * Constraint Type Definitions
 *
 * Enum and categorization for all supported constraint types.
 */

/**
 * All supported constraint types in the system.
 */
export enum ConstraintType {
  // Motion constraints
  MOTION_TYPE = "motionType",
  ROTATION_DIRECTION = "rotationDirection",

  // Sequence-level constraints
  CONTINUITY = "continuity",
  REVERSAL = "reversal",
  HAND_PATH = "handPath",

  // Position constraints
  POSITION_GROUP = "positionGroup",

  // Timing constraints
  TND_TIMING = "tndTiming",

  // Pattern constraints
  ALTERNATING = "alternating",
}

/**
 * Whether a constraint is hard (must satisfy) or soft (best-effort).
 */
export type ConstraintMode = "hard" | "soft";

/**
 * Categories for organizing constraints.
 */
export enum ConstraintCategory {
  MOTION = "motion",
  SEQUENCE = "sequence",
  POSITION = "position",
  TIMING = "timing",
  PATTERN = "pattern",
}

/**
 * Map constraint types to their categories.
 */
export const CONSTRAINT_CATEGORIES: Record<ConstraintType, ConstraintCategory> = {
  [ConstraintType.MOTION_TYPE]: ConstraintCategory.MOTION,
  [ConstraintType.ROTATION_DIRECTION]: ConstraintCategory.MOTION,
  [ConstraintType.CONTINUITY]: ConstraintCategory.SEQUENCE,
  [ConstraintType.REVERSAL]: ConstraintCategory.SEQUENCE,
  [ConstraintType.HAND_PATH]: ConstraintCategory.SEQUENCE,
  [ConstraintType.POSITION_GROUP]: ConstraintCategory.POSITION,
  [ConstraintType.TND_TIMING]: ConstraintCategory.TIMING,
  [ConstraintType.ALTERNATING]: ConstraintCategory.PATTERN,
};
