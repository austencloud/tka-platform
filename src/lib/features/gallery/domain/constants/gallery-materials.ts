/**
 * Gallery Material Constants
 *
 * Predefined material parameters for consistent, premium rendering.
 * These are the raw parameters - actual Three.js materials are created
 * in components to avoid module-level side effects.
 */

// =============================================================================
// Floor Materials
// =============================================================================

/**
 * Marble floor material parameters
 * Used in: Rotunda, lobby areas
 */
export const MARBLE_FLOOR = {
  color: "#e8dcc8", // Warm cream
  roughness: 0.25, // Polished
  metalness: 0.0,
  envMapIntensity: 0.3, // Subtle reflections
} as const;

/**
 * Dark marble accent (center medallions, inlays)
 */
export const MARBLE_DARK = {
  color: "#2d1810", // Rich dark brown
  roughness: 0.3,
  metalness: 0.0,
} as const;

/**
 * Wood floor material parameters
 * Used in: Exhibition wings, alcoves
 */
export const WOOD_FLOOR = {
  color: "#5c4033", // Warm brown
  roughness: 0.6, // Natural finish
  metalness: 0.0,
} as const;

/**
 * Red velvet carpet material
 * Used as: Runners in wings
 */
export const CARPET_RED = {
  color: "#a83232", // Rich red
  roughness: 0.95, // Very matte
  metalness: 0.0,
} as const;

// =============================================================================
// Wall Materials
// =============================================================================

/**
 * Main wall color (warm burgundy)
 */
export const WALL_MAIN = {
  color: "#8b4545",
  roughness: 0.85, // Matte paint
  metalness: 0.0,
} as const;

/**
 * Upper wall color (lighter, above chair rail)
 */
export const WALL_UPPER = {
  color: "#9e5555",
  roughness: 0.85,
  metalness: 0.0,
} as const;

/**
 * Darker wall accent
 */
export const WALL_DARK = {
  color: "#7a3d3d",
  roughness: 0.85,
  metalness: 0.0,
} as const;

// =============================================================================
// Ceiling Materials
// =============================================================================

/**
 * Standard ceiling (dark warm brown)
 */
export const CEILING_MAIN = {
  color: "#4a3c38",
  roughness: 0.9,
  metalness: 0.0,
} as const;

/**
 * Darker ceiling for contrast/beams
 */
export const CEILING_BEAM = {
  color: "#3d322e",
  roughness: 0.85,
  metalness: 0.0,
} as const;

// =============================================================================
// Trim & Accent Materials
// =============================================================================

/**
 * Gold trim (crown molding, frames, decorations)
 */
export const GOLD_TRIM = {
  color: "#c9a227", // Antique gold
  roughness: 0.4,
  metalness: 0.6, // Metallic
  envMapIntensity: 0.5,
} as const;

/**
 * Brass accents (slightly redder gold)
 */
export const BRASS_ACCENT = {
  color: "#b8860b", // Dark golden rod
  roughness: 0.35,
  metalness: 0.7,
} as const;

/**
 * White/cream trim (alternative to gold)
 */
export const WHITE_TRIM = {
  color: "#f5f0e6",
  roughness: 0.7,
  metalness: 0.0,
} as const;

// =============================================================================
// Column Materials
// =============================================================================

/**
 * White marble column
 */
export const COLUMN_MARBLE = {
  color: "#f0ebe0", // Off-white
  roughness: 0.3,
  metalness: 0.0,
  envMapIntensity: 0.2,
} as const;

/**
 * Dark stone column
 */
export const COLUMN_STONE = {
  color: "#4a4540",
  roughness: 0.5,
  metalness: 0.0,
} as const;

// =============================================================================
// Special Materials
// =============================================================================

/**
 * Torch holder (dark wrought iron)
 */
export const TORCH_BRACKET = {
  color: "#2a2520",
  roughness: 0.6,
  metalness: 0.3,
} as const;

/**
 * Torch wood
 */
export const TORCH_WOOD = {
  color: "#2d1810",
  roughness: 0.9,
  metalness: 0.0,
} as const;

/**
 * Frame material (gold/brass)
 */
export const FRAME_GOLD = {
  color: "#b8860b",
  roughness: 0.4,
  metalness: 0.7,
  envMapIntensity: 0.4,
} as const;

// =============================================================================
// Ring/Inlay Materials (for floor decorations)
// =============================================================================

/**
 * Gold floor ring parameters
 */
export const FLOOR_RING_GOLD = {
  color: "#c9a227",
  roughness: 0.35,
  metalness: 0.6,
} as const;

/**
 * Concentric ring radii for rotunda floor (relative to room radius)
 */
export const ROTUNDA_RING_RATIOS = [0.375, 0.625, 0.875] as const;

/**
 * Center medallion radius ratio
 */
export const ROTUNDA_MEDALLION_RATIO = 0.25;

// =============================================================================
// Material Sets by Room Type
// =============================================================================

/**
 * Material set for rotunda rooms
 */
export const ROTUNDA_MATERIALS = {
  floor: MARBLE_FLOOR,
  floorAccent: MARBLE_DARK,
  floorRings: FLOOR_RING_GOLD,
  ceiling: CEILING_MAIN,
  wall: WALL_MAIN,
  trim: GOLD_TRIM,
  column: COLUMN_MARBLE,
} as const;

/**
 * Material set for exhibition wings
 */
export const WING_MATERIALS = {
  floor: WOOD_FLOOR,
  carpet: CARPET_RED,
  ceiling: CEILING_MAIN,
  ceilingBeam: CEILING_BEAM,
  wall: WALL_MAIN,
  wallUpper: WALL_UPPER,
  trim: GOLD_TRIM,
} as const;

/**
 * Material set for alcoves
 */
export const ALCOVE_MATERIALS = {
  floor: WOOD_FLOOR,
  ceiling: CEILING_MAIN,
  wall: WALL_DARK,
  trim: BRASS_ACCENT,
} as const;
