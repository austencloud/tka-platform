/**
 * Avatar Proportions Configuration
 *
 * Real-world measurements (in centimeters) that define the avatar's proportions.
 * All 3D scene units are derived from these measurements.
 *
 * SCALE: 1 unit = 1 meter (so a 190cm person = 1.9 units)
 */

// Conversion: cm to scene units (meters)
export const CM_TO_UNITS = 0.01; // 1 cm = 0.01 meters
export const INCHES_TO_CM = 2.54;

/**
 * Height configurations for different body types
 * Heights are in cm, converted to scene units (meters)
 */
export const BODY_TYPE_HEIGHTS = {
  masculine: 188, // 6'2" = 188 cm = 1.88 meters
  feminine: 178, // 5'10" = 178 cm = 1.78 meters
  androgynous: 183, // 6'0" = 183 cm = 1.83 meters (average)
} as const;

/**
 * Get height in scene units for a body type
 */
export function getHeightForBodyType(
  bodyType: keyof typeof BODY_TYPE_HEIGHTS
): number {
  return cmToUnits(BODY_TYPE_HEIGHTS[bodyType]);
}

/**
 * Convert inches to scene units
 */
export function inchesToUnits(inches: number): number {
  return inches * INCHES_TO_CM * CM_TO_UNITS;
}

/**
 * Convert cm to scene units
 */
export function cmToUnits(cm: number): number {
  return cm * CM_TO_UNITS;
}

/**
 * Real-world measurements for the avatar (in cm)
 * Based on: 6'3" (190.5cm), lanky build, 32x32 pants, 175 lbs
 */
export interface AvatarMeasurements {
  // Overall
  height: number; // Total height in cm

  // Head & Neck
  headHeight: number;
  neckLength: number;

  // Torso
  shoulderWidth: number; // Shoulder to shoulder
  torsoLength: number; // Shoulder to hip
  hipWidth: number;

  // Arms
  upperArmLength: number; // Shoulder to elbow
  forearmLength: number; // Elbow to wrist
  handLength: number; // Wrist to fingertip

  // Legs (inseam = hip to floor)
  inseam: number;
  thighLength: number;
  shinLength: number;
}

/**
 * Default measurements for Austen's build
 * 6'3" (190.5cm), lanky, 32x32 pants, long torso
 */
export const AUSTEN_MEASUREMENTS: AvatarMeasurements = {
  // 6'3" = 190.5 cm
  height: 190.5,

  // Head typically ~23cm, neck ~10cm
  headHeight: 23,
  neckLength: 10,

  // Lanky = narrower shoulders (~44cm), long torso
  shoulderWidth: 44,
  torsoLength: 62, // Long torso for height
  hipWidth: 32, // Narrow hips (32" waist)

  // Lanky arms (proportionally longer)
  upperArmLength: 34, // ~13.4"
  forearmLength: 29, // ~11.4"
  handLength: 20, // ~8"

  // 32" inseam = 81.3cm
  inseam: 81.3,
  thighLength: 45,
  shinLength: 44,
};

/**
 * Staff/prop configuration
 */
export interface PropConfig {
  length: number; // in cm
  diameter: number; // in cm
}

/**
 * 34" double staff
 */
export const STAFF_34_INCH: PropConfig = {
  length: 34 * INCHES_TO_CM, // 86.4 cm
  diameter: 2.5, // ~1" diameter typical
};

/**
 * Derive 3D scene dimensions from real measurements
 */
export function deriveSceneProportions(
  measurements: AvatarMeasurements,
  bodyType: "masculine" | "feminine" = "masculine"
) {
  const m = measurements;
  const isFeminine = bodyType === "feminine";

  // Apply feminine adjustments (narrower shoulders, wider hips proportionally)
  const shoulderMult = isFeminine ? 0.88 : 1;
  const hipMult = isFeminine ? 1.15 : 1;
  const limbMult = isFeminine ? 0.92 : 1;

  return {
    // Head & Neck
    headRadius: cmToUnits(m.headHeight / 2),
    neckLength: cmToUnits(m.neckLength),
    neckRadius: cmToUnits(isFeminine ? 4 : 5),

    // Shoulders
    shoulderX: cmToUnits((m.shoulderWidth * shoulderMult) / 2),
    shoulderBarRadius: cmToUnits(isFeminine ? 4 : 5),

    // Torso
    torsoLength: cmToUnits(m.torsoLength),
    torsoTopRadius: cmToUnits(isFeminine ? 14 : 16),
    torsoBottomRadius: cmToUnits(isFeminine ? 12 : 13),

    // Hips
    hipWidth: cmToUnits((m.hipWidth * hipMult) / 2),
    hipBarRadius: cmToUnits(5),

    // Arms (for IK)
    upperArmLength: cmToUnits(m.upperArmLength * limbMult),
    forearmLength: cmToUnits(m.forearmLength * limbMult),
    armThickness: cmToUnits(isFeminine ? 3.5 : 4),
    jointRadius: cmToUnits(isFeminine ? 4.5 : 5),
    wristRadius: cmToUnits(isFeminine ? 5 : 5.5),

    // Legs
    thighLength: cmToUnits(m.thighLength),
    shinLength: cmToUnits(m.shinLength),
    legThickness: cmToUnits(5),
    footLength: cmToUnits(12),

    // Vertical positioning (Y coordinates)
    // Origin at shoulder height for easier prop positioning
    headY: cmToUnits(m.neckLength + m.headHeight / 2),
    neckY: cmToUnits(m.neckLength / 2),
    shoulderY: 0, // Origin
    torsoY: cmToUnits(-m.torsoLength / 2),
    hipY: cmToUnits(-m.torsoLength),
    kneeY: cmToUnits(-m.torsoLength - m.thighLength),
    ankleY: cmToUnits(-m.torsoLength - m.thighLength - m.shinLength),
    footY: cmToUnits(-m.torsoLength - m.inseam),

    // Figure Z position (behind grid, facing audience) in meters
    figureZ: -0.4, // 40cm behind grid
  };
}

/**
 * Get staff dimensions in scene units
 */
export function getStaffDimensions(config: PropConfig = STAFF_34_INCH) {
  return {
    length: cmToUnits(config.length),
    radius: cmToUnits(config.diameter / 2),
  };
}

/**
 * Pre-calculated proportions for Austen's build
 */
export const AUSTEN_PROPORTIONS = deriveSceneProportions(
  AUSTEN_MEASUREMENTS,
  "masculine"
);
export const AUSTEN_STAFF = getStaffDimensions(STAFF_34_INCH);
