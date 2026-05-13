/**
 * User Proportions Configuration
 *
 * Allows users to input their height and staff length,
 * then derives all 3D scene dimensions proportionally.
 *
 * The key insight: grid size = arm reach + half staff length
 * Arm reach is approximately 40% of height for comfortable extension.
 */

import { CM_TO_UNITS, INCHES_TO_CM } from "./avatar-proportions";

/**
 * User's physical measurements
 */
export interface UserProportions {
  /** User's height in cm */
  heightCm: number;
  /** Staff length in cm */
  staffLengthCm: number;
  /** Build type affects shoulder width and proportions */
  build: "slim" | "average" | "athletic";
}

/**
 * Derived scene dimensions from user proportions
 */
export interface DerivedSceneDimensions {
  /** Avatar scale factor (1.0 = base model height) */
  avatarScale: number;
  /** Staff length in scene units */
  staffLength: number;
  /** Staff radius in scene units */
  staffRadius: number;
  /** Hand point radius (comfortable arm extension) */
  handPointRadius: number;
  /** Outer point radius (hand + half staff) */
  outerPointRadius: number;
  /** Grid size (slightly larger than outer radius) */
  gridSize: number;
  /** Arm reach in cm (for reference) */
  armReachCm: number;
  /** Ground Y position (negative, relative to grid center at Y=0) */
  groundY: number;
}

/**
 * Base model height - the X-Bot is scaled to this height
 * All avatar scaling is relative to this baseline
 */
const BASE_MODEL_HEIGHT_CM = 188; // 6'2" (current X-Bot scaling)

/**
 * Arm reach as fraction of height.
 * Anatomically, shoulder-to-fingertip ≈ 44% of standing height.
 * Comfortable spinning uses ~65% of full extension — the performer
 * keeps elbows slightly bent and doesn't lock out the shoulder.
 *
 * handPointRadius = heightCm * ARM_REACH_HEIGHT_RATIO * COMFORTABLE_EXTENSION
 *
 * This decouples grid layout (anatomy) from prop size (equipment).
 * Changing staff length only changes the visual prop and outer point
 * radius, not where the hand points sit on the grid.
 */
const ARM_REACH_HEIGHT_RATIO = 0.44;
const COMFORTABLE_EXTENSION = 0.65;

/**
 * Shoulder height as percentage of total height
 * Grid center (Y=0) is at shoulder level where hands manipulate props
 * Shoulder is typically at 82% of total height
 */
const SHOULDER_HEIGHT_RATIO = 0.82;

/**
 * Staff diameter - standard double staff
 */
const STAFF_DIAMETER_CM = 2.5; // ~1 inch

/**
 * Convert feet and inches to cm
 */
export function feetInchesToCm(feet: number, inches: number = 0): number {
  return (feet * 12 + inches) * INCHES_TO_CM;
}

/**
 * Convert inches to cm
 */
export function inchesToCm(inches: number): number {
  return inches * INCHES_TO_CM;
}

/**
 * Calculate all scene dimensions from user proportions
 */
export function calculateSceneDimensions(
  props: UserProportions
): DerivedSceneDimensions {
  const { heightCm, staffLengthCm } = props;

  // Avatar scale relative to base model
  const avatarScale = heightCm / BASE_MODEL_HEIGHT_CM;

  // Staff in scene units
  const staffLength = staffLengthCm * CM_TO_UNITS;
  const staffRadius = (STAFF_DIAMETER_CM / 2) * CM_TO_UNITS;

  // Hand point radius from anatomy — where the performer's hand orbits.
  // Independent of staff length so the grid stays fixed when prop size changes.
  const armReachCm = heightCm * ARM_REACH_HEIGHT_RATIO;
  const handPointRadius = armReachCm * CM_TO_UNITS * COMFORTABLE_EXTENSION;

  // Outer point = hand + half staff (where staff tip reaches)
  const outerPointRadius = handPointRadius + staffLength / 2;

  // Grid size must show the outer points with padding
  const gridSize = outerPointRadius + 0.15;

  // Ground Y position (negative, below grid center)
  // Grid center (Y=0) is at shoulder level
  // Ground is shoulder-height below that
  const shoulderHeightCm = heightCm * SHOULDER_HEIGHT_RATIO;
  const groundY = -(shoulderHeightCm * CM_TO_UNITS);

  return {
    avatarScale,
    staffLength,
    staffRadius,
    handPointRadius,
    outerPointRadius,
    gridSize,
    armReachCm,
    groundY,
  };
}

/**
 * Common staff lengths for quick selection
 */
export const COMMON_STAFF_LENGTHS = {
  "30 inch": inchesToCm(30),
  "34 inch": inchesToCm(34),
  "36 inch": inchesToCm(36),
  "40 inch": inchesToCm(40),
  "42 inch": inchesToCm(42),
  "48 inch": inchesToCm(48),
  "54 inch": inchesToCm(54),
  "60 inch": inchesToCm(60),
} as const;

/**
 * Common height presets
 */
export const COMMON_HEIGHTS = {
  "5'0\"": feetInchesToCm(5, 0),
  "5'4\"": feetInchesToCm(5, 4),
  "5'6\"": feetInchesToCm(5, 6),
  "5'8\"": feetInchesToCm(5, 8),
  "5'10\"": feetInchesToCm(5, 10),
  "6'0\"": feetInchesToCm(6, 0),
  "6'2\"": feetInchesToCm(6, 2),
  "6'3\"": feetInchesToCm(6, 3),
  "6'4\"": feetInchesToCm(6, 4),
  "6'6\"": feetInchesToCm(6, 6),
} as const;

/**
 * Default proportions (Austen's measurements)
 */
export const DEFAULT_USER_PROPORTIONS: UserProportions = {
  heightCm: feetInchesToCm(6, 3), // 6'3" = 190.5 cm
  staffLengthCm: inchesToCm(34), // 34" staff
  build: "slim",
};

/**
 * Pre-calculated default dimensions
 */
export const DEFAULT_SCENE_DIMENSIONS = calculateSceneDimensions(
  DEFAULT_USER_PROPORTIONS
);
