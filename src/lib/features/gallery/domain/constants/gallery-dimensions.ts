/**
 * Gallery Dimension Constants
 *
 * All measurements in scene units (1 unit = 0.5 cm at TKA scale)
 * Reference: Avatar height ~340 units (~170 cm / 5'7")
 */

// ============================================================================
// WALL DIMENSIONS
// ============================================================================

/** Wall height - GRAND museum ceiling (~5m / 16ft) */
export const WALL_HEIGHT = 1000;

/** Wall thickness */
export const WALL_THICKNESS = 20;

/** Wall color (legacy - use WALL_COLOR_MAIN for luxury style) */
export const WALL_COLOR = "#4a1c1c";

// ============================================================================
// EXHIBIT FRAME DIMENSIONS
// ============================================================================

/** Frame width (outer) - larger for grand museum */
export const FRAME_WIDTH = 240;

/** Frame height (outer) - larger for grand museum */
export const FRAME_HEIGHT = 240;

/** Frame depth (how far it protrudes from wall) */
export const FRAME_DEPTH = 8;

/** Frame border thickness */
export const FRAME_BORDER = 12;

/** Frame color (gold/brass) */
export const FRAME_COLOR = "#b8860b";

/** Center height of frame from floor - eye level for grand halls */
export const FRAME_CENTER_Y = 340;

// ============================================================================
// EXHIBIT SPACING
// ============================================================================

/** Horizontal spacing between exhibit centers along a wall */
export const EXHIBIT_SPACING = 400;

/** Distance from wall for avatar to stand */
export const AVATAR_OFFSET_FROM_WALL = 180;

/** Horizontal offset of avatar from frame center */
export const AVATAR_OFFSET_X = 160;

/** Distance from wall for animation screen */
export const ANIMATION_SCREEN_OFFSET = 5;

// ============================================================================
// HALLWAY LAYOUT
// ============================================================================

/** Width of hallway corridor */
export const HALLWAY_WIDTH = 600;

/** Buffer space at start and end of hallway */
export const HALLWAY_BUFFER = 300;

/** Player spawn distance from first exhibit */
export const SPAWN_DISTANCE = 200;

// ============================================================================
// PLAYER / CAMERA
// ============================================================================

/** Player eye height from floor */
export const PLAYER_EYE_HEIGHT = 320;

/** Player movement speed (units per second) - faster for huge museum */
export const PLAYER_MOVE_SPEED = 500;

/** Sprint multiplier when holding shift - faster for exploration */
export const SPRINT_MULTIPLIER = 2.2;

/** Mouse sensitivity for looking around */
export const MOUSE_SENSITIVITY = 0.002;

/** Vertical look angle limit (radians) */
export const LOOK_ANGLE_LIMIT = Math.PI * 0.45;

// ============================================================================
// LOD (Level of Detail)
// ============================================================================

/** Distance at which avatars become active - larger for epic museum */
export const AVATAR_ACTIVATION_DISTANCE = 1000;

/** Distance at which avatars are deactivated - larger for epic museum */
export const AVATAR_DEACTIVATION_DISTANCE = 1400;

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

/** Crown molding height - larger for grand ceilings */
export const CROWN_MOLDING_HEIGHT = 50;

/** Crown molding depth (protrusion from wall) - more substantial */
export const CROWN_MOLDING_DEPTH = 25;

/** Chair rail height from floor */
export const CHAIR_RAIL_HEIGHT = 200;

/** Chair rail thickness */
export const CHAIR_RAIL_SIZE = 12;

/** Baseboard height */
export const BASEBOARD_HEIGHT = 25;

/** Baseboard depth */
export const BASEBOARD_DEPTH = 10;

// ============================================================================
// TORCH SCONCES
// ============================================================================

/** Torch sconce height from floor - higher for grand walls */
export const TORCH_HEIGHT = 380;

/** Torch spacing along walls (units between torches) - more spread out */
export const TORCH_SPACING = 500;

/** Torch offset from wall surface */
export const TORCH_WALL_OFFSET = 30;

// ============================================================================
// LIGHTING
// ============================================================================

/** Ambient light intensity */
export const AMBIENT_INTENSITY = 0.3;

/** Spotlight intensity (per exhibit) */
export const SPOTLIGHT_INTENSITY = 1.2;

/** Spotlight angle (radians) */
export const SPOTLIGHT_ANGLE = Math.PI / 6;
