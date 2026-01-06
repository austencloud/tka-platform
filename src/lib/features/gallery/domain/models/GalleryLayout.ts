/**
 * Gallery Layout Domain Models
 *
 * Defines the structure of a 3D gallery space including walls,
 * exhibit slots, and navigation points.
 */

/**
 * A slot on a wall where an exhibit can be placed
 */
export interface ExhibitSlot {
  /** Unique identifier */
  readonly id: string;
  /** ID of the wall this slot belongs to */
  readonly wallId: string;
  /** 3D position in scene units */
  readonly position: { x: number; y: number; z: number };
  /** Y-axis rotation in radians (to face outward from wall) */
  readonly rotation: number;
  /** Width of the slot in scene units */
  readonly width: number;
  /** Height of the slot in scene units */
  readonly height: number;
}

/**
 * A single wall segment in the gallery
 */
export interface WallSegment {
  /** Unique identifier */
  readonly id: string;
  /** Start position of wall (x, z) */
  readonly startPos: { x: number; z: number };
  /** End position of wall (x, z) */
  readonly endPos: { x: number; z: number };
  /** Wall height in scene units */
  readonly height: number;
  /** Thickness of the wall in scene units */
  readonly thickness: number;
  /** Exhibit slots along this wall */
  readonly exhibitSlots: readonly ExhibitSlot[];
}

/**
 * Complete gallery layout definition
 */
export interface GalleryLayout {
  /** Unique identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** All wall segments in the gallery */
  readonly walls: readonly WallSegment[];
  /** Player spawn point */
  readonly spawnPoint: { x: number; y: number; z: number };
  /** Bounding box for collision/culling */
  readonly bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  /** Floor dimensions */
  readonly floorSize: { width: number; depth: number };
}

/**
 * Layout generation options
 */
export interface LayoutGenerationOptions {
  /** Number of exhibits to accommodate */
  exhibitCount: number;
  /** Random seed for deterministic generation */
  seed?: number;
  /** Layout type */
  layoutType?: "hallway" | "procedural";
}
