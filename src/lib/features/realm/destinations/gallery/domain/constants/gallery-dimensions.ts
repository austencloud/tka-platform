/**
 * Gallery Dimension Constants
 *
 * All measurements in METERS (unified scale: 1 unit = 1 meter)
 * Reference: Avatar height ~1.7m (5'7")
 */

// ============================================================================
// WALL DIMENSIONS
// ============================================================================

/** Wall height - GRAND museum ceiling (~5m / 16ft) */
export const WALL_HEIGHT = 5.0;

/** Wall thickness */
export const WALL_THICKNESS = 0.1;

/** Wall color (legacy - use WALL_COLOR_MAIN for luxury style) */
export const WALL_COLOR = "#4a1c1c";

// ============================================================================
// EXHIBIT FRAME DIMENSIONS
// ============================================================================

/** Frame width (outer) - larger for grand museum (~1.2m) */
export const FRAME_WIDTH = 1.2;

/** Frame height (outer) - larger for grand museum (~1.2m) */
export const FRAME_HEIGHT = 1.2;

/** Frame depth (how far it protrudes from wall) */
export const FRAME_DEPTH = 0.04;

/** Frame border thickness */
export const FRAME_BORDER = 0.06;

/** Frame color (gold/brass) */
export const FRAME_COLOR = "#b8860b";

/** Center height of frame from floor - eye level for grand halls (~1.7m) */
export const FRAME_CENTER_Y = 1.7;

// ============================================================================
// EXHIBIT SPACING
// ============================================================================

/** Horizontal spacing between exhibit centers along a wall (~2m) */
export const EXHIBIT_SPACING = 2.0;

/** Distance from wall for avatar to stand (~0.9m) */
export const AVATAR_OFFSET_FROM_WALL = 0.9;

/** Horizontal offset of avatar from frame center (~0.8m) */
export const AVATAR_OFFSET_X = 0.8;

/** Distance from wall for animation screen */
export const ANIMATION_SCREEN_OFFSET = 0.025;

// ============================================================================
// HALLWAY LAYOUT
// ============================================================================

/** Width of hallway corridor (~3m) */
export const HALLWAY_WIDTH = 3.0;

/** Buffer space at start and end of hallway (~1.5m) */
export const HALLWAY_BUFFER = 1.5;

/** Player spawn distance from first exhibit (~1m) */
export const SPAWN_DISTANCE = 1.0;

// ============================================================================
// PLAYER / CAMERA
// ============================================================================

/** Player eye height from floor (~1.6m) */
export const PLAYER_EYE_HEIGHT = 1.6;

/** Player movement speed (meters per second) */
export const PLAYER_MOVE_SPEED = 2.5;

/** Sprint multiplier when holding shift */
export const SPRINT_MULTIPLIER = 2.2;

/** Mouse sensitivity for looking around */
export const MOUSE_SENSITIVITY = 0.002;

/** Vertical look angle limit (radians) */
export const LOOK_ANGLE_LIMIT = Math.PI * 0.45;

// ============================================================================
// LOD (Level of Detail)
// ============================================================================

/** Distance at which avatars become active (~5m) */
export const AVATAR_ACTIVATION_DISTANCE = 5.0;

/** Distance at which avatars are deactivated (~7m) */
export const AVATAR_DEACTIVATION_DISTANCE = 7.0;

// ============================================================================
// FLOOR
// ============================================================================

/** Floor color (warm wood - visible!) */
export const FLOOR_COLOR = "#5c4033";

/** Carpet runner color (rich red velvet) */
export const CARPET_COLOR = "#a83232";

/** Carpet runner width (proportion of hallway width) */
export const CARPET_WIDTH_RATIO = 0.35;

// ============================================================================
// WALL STYLING (Luxury Museum)
// ============================================================================

/** Main wall color (warm burgundy - visible!) */
export const WALL_COLOR_MAIN = "#8b4545";

/** Upper wall color (above chair rail - lighter) */
export const WALL_COLOR_UPPER = "#9e5555";

/** Trim/molding color (antique gold) */
export const TRIM_COLOR = "#c9a227";

/** Crown molding height (~0.25m) */
export const CROWN_MOLDING_HEIGHT = 0.25;

/** Crown molding depth (protrusion from wall) (~0.125m) */
export const CROWN_MOLDING_DEPTH = 0.125;

/** Chair rail height from floor (~1m) */
export const CHAIR_RAIL_HEIGHT = 1.0;

/** Chair rail thickness (~0.06m) */
export const CHAIR_RAIL_SIZE = 0.06;

/** Baseboard height (~0.125m) */
export const BASEBOARD_HEIGHT = 0.125;

/** Baseboard depth (~0.05m) */
export const BASEBOARD_DEPTH = 0.05;

// ============================================================================
// TORCH SCONCES
// ============================================================================

/** Torch sconce height from floor (~1.9m) */
export const TORCH_HEIGHT = 1.9;

/** Torch spacing along walls (~2.5m) */
export const TORCH_SPACING = 2.5;

/** Torch offset from wall surface (~0.15m) */
export const TORCH_WALL_OFFSET = 0.15;

// ============================================================================
// LIGHTING
// ============================================================================

/** Ambient light intensity */
export const AMBIENT_INTENSITY = 0.3;

/** Spotlight intensity (per exhibit) */
export const SPOTLIGHT_INTENSITY = 1.2;

/** Spotlight angle (radians) */
export const SPOTLIGHT_ANGLE = Math.PI / 6;
