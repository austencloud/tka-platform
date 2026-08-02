/**
 * Layout Engine Types
 *
 * Data structures for the graph-first layout algorithm.
 * Rooms are nodes, connections are edges, and the layout engine
 * computes absolute positions from a coarse grid assignment.
 */

import type {
  FloorMaterial,
  Direction,
  MuseumFormationPresentation,
  MuseumFurnitureRole,
  MuseumRoomPresentation,
  WingTheme,
} from "./museum-grid-types";
import type { WallDefinition } from "./wall-segment-types";

// ── Room Graph (input) ──

/** Decade label for a sequence screen's content era */
export type ScreenDecade =
  | "1970s"
  | "1980s"
  | "1990s"
  | "2000s"
  | "2010s"
  | "2020s";

export interface PerformerPlacement {
  /** -0.5 to 0.5 offset from room center (0 = center) */
  offsetX: number;
  /** -0.5 to 0.5 offset from room center (0 = center) */
  offsetY: number;
  /** Direction the performer faces */
  facing: Direction;
  /** Reference ID linking to PerformerDefinition content */
  refId: string;
  /** Ritual keeps the full platform and acolytes; sculpture presents only the kinetic core. */
  presentation?: MuseumFormationPresentation;
  /** Uniform scale applied to formation-style performers. */
  scale?: number;
  /** Circular collision footprint around the placement, expressed in tiles. */
  collisionRadiusTiles?: number;
}

export interface FurniturePlacement {
  /** Semantic role from the model loader */
  role: MuseumFurnitureRole;
  /** -0.5 to 0.5 offset from room center (same system as PerformerPlacement) */
  offsetX: number;
  /** -0.5 to 0.5 offset from room center */
  offsetY: number;
  /** Y-axis rotation in radians (0 = facing south / +Z) */
  rotationY?: number;
}

export interface RoomSpawnPlacement {
  /** -0.5 to 0.5 offset from room center (same system as furniture placement) */
  offsetX: number;
  /** -0.5 to 0.5 offset from room center */
  offsetY: number;
  facing: Direction;
}

export interface RoomNode {
  id: string;
  name: string;
  material: FloorMaterial;
  theme: WingTheme;
  description?: string;
  /** Designer notes rendered as in-game dev whiteboards */
  devNotes?: string;
  /** Wall segment definitions - ordered arrays of typed segments per wall */
  walls: {
    north: WallDefinition;
    south: WallDefinition;
    east: WallDefinition;
    west: WallDefinition;
  };
  performers?: PerformerPlacement[];
  /** Furniture models placed relative to room center */
  furniture?: FurniturePlacement[];
  /** Optional player start inside this room. Only the first placed room uses it. */
  spawn?: RoomSpawnPlacement;
  /** Authored visual layer mounted over the tile-built room structure. */
  roomPresentation?: MuseumRoomPresentation;
  /** Minimum interior width override (for rooms needing floor space beyond wall demands) */
  minInteriorWidth?: number;
  /** Minimum interior height override */
  minInteriorHeight?: number;
}

export interface RoomEdge {
  from: string;
  to: string;
  type: "main-path" | "side-branch" | "secret";
  fromWall: "north" | "south" | "east" | "west";
  toWall: "north" | "south" | "east" | "west";
  corridorWidth?: number;
}

// ── Grid Configuration ──

export interface GridConfig {
  /** Tiles per grid cell horizontally */
  cellWidth: number;
  /** Tiles per grid cell vertically */
  cellHeight: number;
  /** Tiles of padding between rooms within a cell */
  padding: number;
}

// ── Layout Engine (output) ──

export interface GridAssignment {
  roomId: string;
  gridCol: number;
  gridRow: number;
}

export interface PlacedRoom {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  material: FloorMaterial;
  theme: WingTheme;
  description?: string;
  /** Designer notes rendered as in-game dev whiteboards */
  devNotes?: string;
  /** Wall segment definitions (copied from RoomNode) */
  walls: {
    north: WallDefinition;
    south: WallDefinition;
    east: WallDefinition;
    west: WallDefinition;
  };
  performers?: PerformerPlacement[];
  /** Furniture models placed relative to room center */
  furniture?: FurniturePlacement[];
  /** Optional player start copied from the room graph. */
  spawn?: RoomSpawnPlacement;
  /** Authored visual layer copied from the room graph. */
  roomPresentation?: MuseumRoomPresentation;
}

export interface CorridorSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export interface LayoutResult {
  rooms: PlacedRoom[];
  corridors: { edge: RoomEdge; segments: CorridorSegment[] }[];
  gridWidth: number;
  gridHeight: number;
}

export interface ValidationResult {
  valid: boolean;
  unreachableRooms: string[];
  overlaps: { roomA: string; roomB: string }[];
  spawnOnWalkable: boolean;
  errors: string[];
}
