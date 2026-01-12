/**
 * Poi-Specific Enums
 *
 * Enums for poi physics constraints and VTG terminology.
 */

/**
 * Types of constraint violations for poi motions.
 * Used to provide specific feedback when a motion/transition is invalid.
 */
export enum PoiMotionValidity {
  VALID = "valid",
  INVALID_FLOAT_ORIENTATION = "invalidFloatOrientation",
  INVALID_ANTI_ZERO_TURNS = "invalidAntiZeroTurns",
  INVALID_PRO_ZERO_IN = "invalidProZeroIn",
  INVALID_DASH_TURNS = "invalidDashTurns",
  INVALID_SPIN_REVERSAL = "invalidSpinReversal",
}

/**
 * VTG Timing/Direction Combinations
 *
 * Describes the phase and direction relationship between two poi:
 * - T = Together timing (same phase)
 * - S = Split timing (180° out of phase)
 * - S = Same direction (both spin same way)
 * - O = Opposite direction (spin opposite ways)
 */
export enum PoiTimingDirection {
  TOGETHER_SAME = "T/S",
  TOGETHER_OPPOSITE = "T/O",
  SPLIT_SAME = "S/S",
  SPLIT_OPPOSITE = "S/O",
}

/**
 * VTG Pattern Ratios
 *
 * Describes prop rotations per arm rotation.
 * Higher ratios mean more prop spin relative to hand movement.
 */
export enum PoiPatternRatio {
  ONE_TO_ONE = "1:1",
  ONE_TO_THREE = "1:3",
  ONE_TO_FIVE = "1:5",
}
