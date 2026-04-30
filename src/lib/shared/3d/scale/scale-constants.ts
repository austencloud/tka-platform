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

	/** Crouch speed multiplier (fraction of walk speed) */
	CROUCH_MULTIPLIER: 0.4,

	/** Eye height while crouching (meters) - roughly 60% of standing */
	CROUCH_EYE_HEIGHT: 0.95,

	/** Capsule half-height while crouching (standing = 0.55, crouch shrinks to fit under geometry) */
	CROUCH_HALF_HEIGHT: 0.25,

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
 * Stage-specific constants
 *
 * These apply to the Stage (StageWorld) where performers
 * demonstrate TKA sequences on a bounded grid.
 */
export const STAGE = {
	// ─────────────────────────────────────────────────────────────────
	// Ground Plane (physics collider)
	// ─────────────────────────────────────────────────────────────────

	/** Half-extent of ground plane (50m = 100m x 100m total) */
	GROUND_HALF_SIZE: 50,

	/** Ground plane thickness */
	GROUND_THICKNESS: 0.1,

	// ─────────────────────────────────────────────────────────────────
	// Performer Layout
	// ─────────────────────────────────────────────────────────────────

	/** Spacing between performers in a formation */
	PERFORMER_SPACING: 2.0,

	/** Maximum performers supported */
	MAX_PERFORMERS: 4,

	/**
	 * Viewer-specific max performers. The standalone 3D viewer allows up to 8,
	 * while realm/museum/duet continue to use the shared MAX_PERFORMERS = 4.
	 * Wired into createPerformerManager via its optional maxPerformers dep.
	 */
	MAX_VIEWER_PERFORMERS: 8,

	/** Offset behind grid plane where avatar stands (facing the grid) */
	AVATAR_GRID_OFFSET: 0.3,

	/**
	 * Height of the wooden performance stage deck above the ground.
	 * Set to 0 for a flush stage, or a positive value for a raised
	 * platform that the performer visibly stands on. Consumers that
	 * render an avatar on top of the stage should offset their rig
	 * root by this amount so the avatar's feet land on the deck top.
	 */
	STAGE_DECK_HEIGHT: 0.55,

	// ─────────────────────────────────────────────────────────────────
	// Camera Presets (meters from origin)
	// ─────────────────────────────────────────────────────────────────

	CAMERA_PRESETS: {
		/** Looking at Wall plane from front */
		front: [0, 0, 4] as [number, number, number],
		/** Looking at Floor plane from above */
		top: [0, 4, 0] as [number, number, number],
		/** Looking at Wheel plane from side */
		side: [4, 0, 0] as [number, number, number],
		/** Angled isometric view */
		perspective: [2.75, 2.25, 2.75] as [number, number, number],
	},

	// ─────────────────────────────────────────────────────────────────
	// Orbit Controls
	// ─────────────────────────────────────────────────────────────────

	/** Minimum orbit distance */
	ORBIT_MIN_DISTANCE: 1.0,

	/** Maximum orbit distance */
	ORBIT_MAX_DISTANCE: 10.0,

	/**
	 * Buffer above the ground plane (meters) for the orbit camera floor.
	 * The camera can get this close to the ground but no closer,
	 * so you never clip through the surface.
	 */
	ORBIT_GROUND_BUFFER: 0.15,

	// ─────────────────────────────────────────────────────────────────
	// First Person Camera
	// ─────────────────────────────────────────────────────────────────

	/** Forward offset from avatar center (see past nose) */
	FIRST_PERSON_FORWARD_OFFSET: 0.25,
} as const;

/**
 * Infinite Worlds constants
 *
 * These apply to the procedural terrain exploration mode.
 */
export const WORLDS = {
	// ─────────────────────────────────────────────────────────────────
	// Chunk System
	// ─────────────────────────────────────────────────────────────────

	/** Default chunk size in meters */
	CHUNK_SIZE: 64,

	/** Default view distance in meters */
	VIEW_DISTANCE: 256,

	/** LOD distance thresholds */
	LOD_DISTANCES: [32, 64, 128, 256] as readonly number[],

	// ─────────────────────────────────────────────────────────────────
	// Water
	// ─────────────────────────────────────────────────────────────────

	/** Default water level (Y coordinate) */
	WATER_LEVEL: 5,

	// ─────────────────────────────────────────────────────────────────
	// Spawn
	// ─────────────────────────────────────────────────────────────────

	/** Default spawn height (high enough to drop onto terrain) */
	SPAWN_HEIGHT: 50,
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
