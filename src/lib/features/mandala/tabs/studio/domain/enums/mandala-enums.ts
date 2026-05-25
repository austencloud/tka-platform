/**
 * Symmetry fold counts supported by the mandala generator.
 * Each value divides 360° evenly for rotational symmetry.
 */
export type SymmetryFold = 2 | 3 | 4 | 6 | 8 | 12;

/**
 * Valid symmetry fold values for iteration/validation.
 */
export const SYMMETRY_FOLDS: readonly SymmetryFold[] = [
  2, 3, 4, 6, 8, 12,
] as const;

/**
 * Types of elements that can be placed on the mandala canvas.
 */
export type MandalaElementType = "arrow" | "staff" | "gridDot";

/**
 * Arrow motion types matching the TKA system.
 */
export type ArrowMotionType = "pro" | "anti" | "static" | "dash" | "float";

/**
 * Arrow turn counts (0, 0.5, 1, 1.5, 2, 2.5, 3).
 */
export type ArrowTurns = 0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3;

/**
 * Color for mandala elements (hex string).
 */
export type MandalaColor = string;

/**
 * Export formats supported by the mandala generator.
 */
export type ExportFormat = "png" | "svg";

/**
 * Mirror axis types for symmetry.
 */
export type MirrorAxis = "vertical" | "horizontal" | "both" | "none";
