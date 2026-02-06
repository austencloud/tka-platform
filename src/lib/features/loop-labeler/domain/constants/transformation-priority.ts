/**
 * Transformation priority ordering.
 * Simpler explanations come first (higher priority).
 */
export const TRANSFORMATION_PRIORITY = [
  // ==============================================
  // IDENTITY (highest priority - simplest explanation)
  // ==============================================
  "repeated", // Literally the same motion repeated, no transformation

  // ==============================================
  // SAME-COLOR TRANSFORMATIONS (high priority)
  // These are simpler explanations - both props do the same thing
  // ==============================================

  // Pure rotations (same colors)
  "rotated_90_cw",
  "rotated_90_ccw",
  "rotated_180",
  // Rotation + inversion (same colors)
  "rotated_90_cw_inverted",
  "rotated_90_ccw_inverted",
  "rotated_180_inverted",
  // Flip/mirror (same colors)
  "flipped",
  "flipped_inverted",
  "mirrored",
  "mirrored_inverted",
  // Pure inversion (same colors, same positions)
  "inverted",

  // ==============================================
  // SWAPPED TRANSFORMATIONS (lower priority)
  // More complex - props swap roles
  // ==============================================

  // Rotation + swap
  "rotated_90_cw_swapped",
  "rotated_90_ccw_swapped",
  "rotated_180_swapped",
  // Triple compound (rotation + swap + invert)
  "rotated_90_cw_swapped_inverted",
  "rotated_90_ccw_swapped_inverted",
  "rotated_180_swapped_inverted",
  // Mirror + swap
  "mirrored_swapped",
  "mirrored_swapped_inverted",
  // Flip + swap
  "flipped_swapped",
  "flipped_swapped_inverted",
  // Pure swap + inversion
  "swapped_inverted",
  // Pure swap
  "swapped",
];
