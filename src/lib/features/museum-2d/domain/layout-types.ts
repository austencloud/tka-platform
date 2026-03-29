/**
 * Layout Engine Types
 *
 * Data structures for the graph-first layout algorithm.
 * Rooms are nodes, connections are edges, and the layout engine
 * computes absolute positions from a coarse grid assignment.
 */

import type { FloorMaterial, Direction, WingTheme, MuseumGrid } from "./museum-grid-types";

// ── Room Graph (input) ──

export interface ExhibitPlacement {
  /** Which wall this exhibit is mounted on */
  wall: "north" | "south" | "east" | "west";
  /** 0.0–1.0 position along the wall (0.5 = center) */
  position: number;
  /** Reference ID linking to ExhibitDefinition content */
  refId: string;
  /** Which direction the exhibit faces (toward the room interior) */
  facing: Direction;
}

export interface PerformerPlacement {
  /** -0.5 to 0.5 offset from room center (0 = center) */
  offsetX: number;
  /** -0.5 to 0.5 offset from room center (0 = center) */
  offsetY: number;
  /** Direction the performer faces */
  facing: Direction;
  /** Reference ID linking to PerformerDefinition content */
  refId: string;
}

export interface TorchPlacement {
  /** Which wall this torch is mounted on */
  wall: "north" | "south" | "east" | "west";
  /** 0.0–1.0 position along the wall (0.5 = center) */
  position: number;
}

export interface RoomNode {
  id: string;
  name: string;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  material: FloorMaterial;
  theme: WingTheme;
  description?: string;
  exhibits?: ExhibitPlacement[];
  performers?: PerformerPlacement[];
  torches?: TorchPlacement[];
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
  exhibits?: ExhibitPlacement[];
  performers?: PerformerPlacement[];
  torches?: TorchPlacement[];
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
