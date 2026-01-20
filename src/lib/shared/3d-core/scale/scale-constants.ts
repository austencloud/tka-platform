/**
 * Universal Scale System
 *
 * All 3D destinations use meters as the base unit.
 * 1 unit = 1 meter
 *
 * This ensures:
 * - Consistent movement feel across all destinations
 * - Physics engines work correctly (Rapier expects meters)
 * - Simple mental model for developers
 */

export const SCALE = {
	// ─────────────────────────────────────────────────────────────────
	// Player Dimensions (average adult human)
	// ─────────────────────────────────────────────────────────────────

	/** Full standing height in meters */
	PLAYER_HEIGHT: 1.7,

	/** Shoulder width in meters */
	PLAYER_WIDTH: 0.4,

	/** Eye level - slightly below top of head */
	EYE_HEIGHT: 1.6,

	/** Collision capsule radius */
	PLAYER_RADIUS: 0.3,

	// ─────────────────────────────────────────────────────────────────
	// Movement Speeds (meters per second)
	// ─────────────────────────────────────────────────────────────────

	/** Casual walking pace */
	WALK_SPEED: 3.5,

	/** Jogging / brisk movement */
	RUN_SPEED: 7.0,

	/** Full sprint */
	SPRINT_SPEED: 10.0,

	/** Multiplier for sprint (RUN_SPEED / WALK_SPEED) */
	SPRINT_MULTIPLIER: 2.0,

	// ─────────────────────────────────────────────────────────────────
	// Camera Settings
	// ─────────────────────────────────────────────────────────────────

	/** Field of view in degrees */
	DEFAULT_FOV: 75,

	/** Near clipping plane in meters */
	NEAR_CLIP: 0.1,

	/** Far clipping plane in meters */
	FAR_CLIP: 1000,

	// ─────────────────────────────────────────────────────────────────
	// Physics Constants
	// ─────────────────────────────────────────────────────────────────

	/** Gravitational acceleration (m/s^2) */
	GRAVITY: -9.81,

	/** Initial jump velocity (m/s) - gives ~1.25m jump height */
	JUMP_VELOCITY: 5.0,

	/** Terminal velocity for falling (m/s) */
	TERMINAL_VELOCITY: -50,

	// ─────────────────────────────────────────────────────────────────
	// Rotation Speeds
	// ─────────────────────────────────────────────────────────────────

	/** Mouse sensitivity multiplier */
	MOUSE_SENSITIVITY: 0.002,

	/** Smooth rotation interpolation factor */
	ROTATION_SMOOTHING: 8,
} as const;

/**
 * Legacy conversion factors - DEPRECATED
 *
 * The Stage has been fully converted to meters.
 * These are kept only for historical reference.
 *
 * @deprecated All code now uses meters (1 unit = 1 meter)
 */
export const LEGACY_CONVERSION = {
	/** Old Stage scale: 1 unit = 0.5cm */
	STAGE_TO_METERS: 0.005,
	/** Old Stage scale: 200 units = 1 meter */
	METERS_TO_STAGE: 200,
} as const;

export type ScaleConstants = typeof SCALE;
