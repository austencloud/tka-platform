/**
 * Gallery Layout Domain Models
 *
 * Defines the structure of a 3D gallery space for model-based galleries.
 * The gallery is loaded from a GLB model, with exhibit slots extracted
 * from named objects in the scene.
 */

// =============================================================================
// Exhibit Slot
// =============================================================================

/**
 * A slot where an exhibit can be placed.
 * For model-based galleries, these are extracted from the GLB model.
 */
export interface ExhibitSlot {
  /** Unique identifier */
  readonly id: string;
  /** 3D position in scene units */
  readonly position: { x: number; y: number; z: number };
  /** Y-axis rotation in radians (to face outward from wall) */
  readonly rotation: number;
  /** Width of the slot */
  readonly width: number;
  /** Height of the slot */
  readonly height: number;
}

// =============================================================================
// Gallery Layout
// =============================================================================

/**
 * Complete gallery layout definition for model-based galleries.
 */
export interface GalleryLayout {
  /** Unique identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Path to the GLB model */
  readonly modelPath: string;
  /** All exhibit slots extracted from the model */
  readonly exhibitSlots: readonly ExhibitSlot[];
  /** Player spawn point */
  readonly spawnPoint: { x: number; y: number; z: number };
  /** Floor dimensions (for physics floor collider) */
  readonly floorSize: { width: number; depth: number };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get all exhibit slots from a layout
 */
export function getAllExhibitSlots(layout: GalleryLayout): readonly ExhibitSlot[] {
  return layout.exhibitSlots;
}
