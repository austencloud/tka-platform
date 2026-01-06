/**
 * Gallery Dimension Constants
 *
 * All measurements in scene units (1 unit = 0.5 cm at TKA scale)
 * Reference: Avatar height ~340 units (~170 cm / 5'7")
 */

// ============================================================================
// WALL DIMENSIONS
// ============================================================================

/** Wall height - comfortable museum ceiling (~3m / 10ft) */
export const WALL_HEIGHT = 600;

/** Wall thickness */
export const WALL_THICKNESS = 20;

/** Wall color (modern art museum white) */
export const WALL_COLOR = "#f5f5f5";

// ============================================================================
// EXHIBIT FRAME DIMENSIONS
// ============================================================================

/** Frame width (outer) */
export const FRAME_WIDTH = 180;

/** Frame height (outer) */
export const FRAME_HEIGHT = 180;

/** Frame depth (how far it protrudes from wall) */
export const FRAME_DEPTH = 8;

/** Frame border thickness */
export const FRAME_BORDER = 12;

/** Frame color (gold/brass) */
export const FRAME_COLOR = "#b8860b";

/** Center height of frame from floor */
export const FRAME_CENTER_Y = 280;

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

/** Player movement speed (units per second) */
export const PLAYER_MOVE_SPEED = 200;

/** Mouse sensitivity for looking around */
export const MOUSE_SENSITIVITY = 0.002;

/** Vertical look angle limit (radians) */
export const LOOK_ANGLE_LIMIT = Math.PI * 0.45;

// ============================================================================
// LOD (Level of Detail)
// ============================================================================

/** Distance at which avatars become active */
export const AVATAR_ACTIVATION_DISTANCE = 600;

/** Distance at which avatars are deactivated */
export const AVATAR_DEACTIVATION_DISTANCE = 800;

// ============================================================================
// FLOOR
// ============================================================================

/** Floor color (polished concrete) */
export const FLOOR_COLOR = "#2a2a2a";

// ============================================================================
// LIGHTING
// ============================================================================

/** Ambient light intensity */
export const AMBIENT_INTENSITY = 0.3;

/** Spotlight intensity (per exhibit) */
export const SPOTLIGHT_INTENSITY = 1.2;

/** Spotlight angle (radians) */
export const SPOTLIGHT_ANGLE = Math.PI / 6;
