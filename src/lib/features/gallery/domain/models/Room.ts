/**
 * Room Definition Models
 *
 * Rooms are the fundamental building blocks of the museum layout.
 * Each room has a shape, theme, and connections to other rooms via doorways.
 */

import type { RoomShape } from "./room-shapes";
import type { Point2D } from "./geometry";

// =============================================================================
// Room Types
// =============================================================================

/**
 * The type/purpose of a room, affects default styling and behavior
 */
export type RoomType =
  | "rotunda" // Grand circular central hall
  | "wing" // Long exhibition corridor
  | "alcove" // Small side room off a wing
  | "lobby" // Entry/exit areas
  | "gallery"; // General exhibition space

// =============================================================================
// Room Theme
// =============================================================================

/**
 * Floor material types available
 */
export type FloorType = "marble" | "wood" | "carpet" | "stone";

/**
 * Ceiling types available
 */
export type CeilingType = "dome" | "coffered" | "flat" | "vaulted";

/**
 * Visual theme for a room
 */
export interface RoomTheme {
  /** Floor material */
  readonly floorType: FloorType;
  /** Primary floor color */
  readonly floorColor: string;
  /** Secondary floor color (for patterns, carpet runners) */
  readonly floorAccentColor?: string;

  /** Ceiling type */
  readonly ceilingType: CeilingType;
  /** Ceiling color */
  readonly ceilingColor: string;

  /** Wall color */
  readonly wallColor: string;
  /** Upper wall color (above chair rail, if different) */
  readonly wallUpperColor?: string;

  /** Trim/molding color (gold, white, etc.) */
  readonly trimColor: string;

  /** Whether to add decorative columns */
  readonly hasColumns?: boolean;
  /** Number of columns (for circular rooms) */
  readonly columnCount?: number;
}

// =============================================================================
// Default Themes
// =============================================================================

/**
 * Grand rotunda theme - marble floor, domed ceiling, columns
 */
export const ROTUNDA_THEME: RoomTheme = {
  floorType: "marble",
  floorColor: "#e8dcc8", // Warm cream marble
  floorAccentColor: "#2d1810", // Dark center medallion

  ceilingType: "dome",
  ceilingColor: "#4a3c38", // Dark warm brown

  wallColor: "#8b4545", // Warm burgundy
  wallUpperColor: "#9e5555", // Lighter burgundy

  trimColor: "#c9a227", // Antique gold
  hasColumns: true,
  columnCount: 12,
};

/**
 * Exhibition wing theme - wood floor with carpet, coffered ceiling
 */
export const WING_THEME: RoomTheme = {
  floorType: "wood",
  floorColor: "#5c4033", // Warm brown wood
  floorAccentColor: "#a83232", // Red carpet runner

  ceilingType: "coffered",
  ceilingColor: "#4a3c38",

  wallColor: "#8b4545",
  wallUpperColor: "#9e5555",

  trimColor: "#c9a227",
  hasColumns: false,
};

/**
 * Alcove theme - intimate, focused
 */
export const ALCOVE_THEME: RoomTheme = {
  floorType: "wood",
  floorColor: "#5c4033",

  ceilingType: "flat",
  ceilingColor: "#3d322e",

  wallColor: "#7a3d3d",

  trimColor: "#b8860b",
  hasColumns: false,
};

/**
 * Lobby theme - grand entrance
 */
export const LOBBY_THEME: RoomTheme = {
  floorType: "marble",
  floorColor: "#e8dcc8",
  floorAccentColor: "#c9a227", // Gold inlay

  ceilingType: "vaulted",
  ceilingColor: "#4a3c38",

  wallColor: "#8b4545",
  wallUpperColor: "#9e5555",

  trimColor: "#c9a227",
  hasColumns: true,
  columnCount: 4,
};

// =============================================================================
// Doorway Opening
// =============================================================================

/**
 * A doorway opening in a room's wall
 * Used to cut openings in walls during generation
 */
export interface DoorwayOpening {
  /** Unique ID of this opening */
  readonly id: string;
  /** ID of the doorway this opening belongs to */
  readonly doorwayId: string;
  /** Angle along the room perimeter where the opening is (radians, for circular rooms) */
  readonly angle?: number;
  /** Position along the wall (for rectangular rooms) */
  readonly wallPosition?: {
    /** Which wall: "north", "south", "east", "west" */
    readonly wall: "north" | "south" | "east" | "west";
    /** Offset along the wall from center */
    readonly offset: number;
  };
  /** Width of the opening */
  readonly width: number;
}

// =============================================================================
// Room Definition
// =============================================================================

/**
 * Complete room definition
 */
export interface Room {
  /** Unique identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Type of room (affects defaults) */
  readonly type: RoomType;
  /** Geometric shape of the room */
  readonly shape: RoomShape;
  /** Height of walls */
  readonly wallHeight: number;
  /** Visual theme */
  readonly theme: RoomTheme;
  /** Doorway openings in walls */
  readonly doorwayOpenings: readonly DoorwayOpening[];
  /** Whether this room has a ceiling (false for open-air) */
  readonly hasCeiling: boolean;
  /** Whether exhibits should be placed in this room */
  readonly hasExhibits: boolean;
  /** Exhibit spacing for this room (overrides default) */
  readonly exhibitSpacing?: number;
}

// =============================================================================
// Room Node (for graph)
// =============================================================================

/**
 * Room node with computed properties for use in room graph
 */
export interface RoomNode {
  /** The room definition */
  readonly room: Room;
  /** Center point (derived from shape) */
  readonly center: Point2D;
  /** Bounding radius (for broad-phase checks) */
  readonly boundingRadius: number;
  /** IDs of adjacent rooms (connected via doorways) */
  readonly adjacentRoomIds: readonly string[];
}

// =============================================================================
// Theme Lookup
// =============================================================================

/**
 * Get default theme for a room type
 */
export function getDefaultTheme(type: RoomType): RoomTheme {
  switch (type) {
    case "rotunda":
      return ROTUNDA_THEME;
    case "wing":
    case "gallery":
      return WING_THEME;
    case "alcove":
      return ALCOVE_THEME;
    case "lobby":
      return LOBBY_THEME;
  }
}
