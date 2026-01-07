/**
 * Gallery Layout Domain Models
 *
 * Defines the structure of a 3D gallery space including rooms, walls,
 * exhibit slots, and navigation.
 *
 * The layout uses a room-based architecture where:
 * - Rooms define physical spaces with shapes (circular, rectangular)
 * - Doorways connect rooms
 * - Walls are generated from room perimeters
 * - RoomGraph enables spatial queries and navigation
 *
 * For backwards compatibility, the legacy `walls` array is still generated
 * and can be used for rendering existing wall components.
 */

import type { Room } from "./Room";
import type { Doorway } from "./doorway";
import type { RoomGraph } from "./RoomGraph";
import type { CollisionWorld } from "./WallCollider";
import type { Point2D, AABB2D } from "./geometry";

// =============================================================================
// Exhibit Slot (unchanged for compatibility)
// =============================================================================

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
  /** Optional: ID of the room this slot is in */
  readonly roomId?: string;
}

// =============================================================================
// Wall Segment (legacy, still used for rendering)
// =============================================================================

/**
 * A single wall segment in the gallery
 * This is the legacy format still used by wall rendering components
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
  /** Optional: ID of the room this wall belongs to */
  readonly roomId?: string;
  /** Whether this wall contains a doorway opening */
  readonly hasDoorway?: boolean;
}

// =============================================================================
// Gallery Layout (Enhanced)
// =============================================================================

/**
 * Complete gallery layout definition
 *
 * Now includes both room-based architecture and legacy wall array
 */
export interface GalleryLayout {
  /** Unique identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;

  // ==========================================================================
  // NEW: Room-based architecture
  // ==========================================================================

  /** All rooms in the gallery */
  readonly rooms: readonly Room[];

  /** All doorways connecting rooms */
  readonly doorways: readonly Doorway[];

  /** Room graph for spatial queries and navigation */
  readonly roomGraph: RoomGraph;

  /** Collision world with all wall colliders */
  readonly collisionWorld: CollisionWorld;

  // ==========================================================================
  // LEGACY: Wall-based data (for backwards compatibility)
  // ==========================================================================

  /** All wall segments (generated from rooms) */
  readonly walls: readonly WallSegment[];

  /** Bounding box for the entire layout */
  readonly bounds: AABB2D;

  /** Floor dimensions (legacy - now each room has its own floor) */
  readonly floorSize: { width: number; depth: number };

  // ==========================================================================
  // Spawn and navigation
  // ==========================================================================

  /** Player spawn point */
  readonly spawnPoint: { x: number; y: number; z: number };

  /** ID of the room where player spawns */
  readonly spawnRoomId: string;
}

// =============================================================================
// Layout Generation Options
// =============================================================================

/**
 * Layout generation options
 */
export interface LayoutGenerationOptions {
  /** Number of exhibits to accommodate */
  exhibitCount: number;
  /** Random seed for deterministic generation */
  seed?: number;
  /** Layout type */
  layoutType?: "hallway" | "mansion" | "procedural";
  /** Whether to include alcoves in wings */
  includeAlcoves?: boolean;
  /** Number of wings (for mansion layout) */
  wingCount?: number;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Summary statistics for a layout
 */
export interface LayoutStats {
  /** Number of rooms */
  roomCount: number;
  /** Number of doorways */
  doorwayCount: number;
  /** Number of wall segments */
  wallCount: number;
  /** Total number of exhibit slots */
  exhibitSlotCount: number;
  /** Total floor area in scene units squared */
  totalFloorArea: number;
}

/**
 * Get statistics about a layout
 */
export function getLayoutStats(layout: GalleryLayout): LayoutStats {
  const exhibitSlotCount = layout.walls.reduce(
    (sum, wall) => sum + wall.exhibitSlots.length,
    0
  );

  return {
    roomCount: layout.rooms.length,
    doorwayCount: layout.doorways.length,
    wallCount: layout.walls.length,
    exhibitSlotCount,
    totalFloorArea: layout.floorSize.width * layout.floorSize.depth,
  };
}

/**
 * Get all exhibit slots from a layout
 */
export function getAllExhibitSlots(layout: GalleryLayout): readonly ExhibitSlot[] {
  return layout.walls.flatMap((wall) => wall.exhibitSlots);
}

/**
 * Get exhibit slots for a specific room
 */
export function getExhibitSlotsForRoom(
  layout: GalleryLayout,
  roomId: string
): readonly ExhibitSlot[] {
  return layout.walls
    .filter((wall) => wall.roomId === roomId)
    .flatMap((wall) => wall.exhibitSlots);
}
