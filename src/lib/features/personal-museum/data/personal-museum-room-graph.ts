/**
 * Personal Museum Room Graph
 *
 * Defines the single-room topology for the Personal Museum MVP.
 * The room uses the same grid builder as the official museum.
 * Each exhibit segment's refId is a stable slot id consumed by the
 * curation reducer to map user-saved sequences onto wall positions.
 */

import type { RoomNode, RoomEdge } from "../../museum/domain/layout-types";
import { GRID_CONFIG } from "../../museum/data/museum-room-graph";

// ── Grid config (re-exported, no new literal) ──

export const PERSONAL_MUSEUM_GRID_CONFIG = GRID_CONFIG;


const PERSONAL_GALLERY: RoomNode = {
  id: "personal-gallery",
  name: "My Gallery",
  material: "marble",
  theme: "gallery",
  description:
    "Your personal gallery — a quiet marble room where your saved sequences hang on the walls. " +
    "Each frame holds a sequence you've collected. The room grows with you.",
  walls: {
    // North wall: slots 1 & 2
    north: {
      segments: [
        { type: "gap", minTiles: 3 },
        { type: "exhibit", refId: "slot-1", size: "standard", facing: "south" },
        { type: "gap", minTiles: 4 },
        { type: "exhibit", refId: "slot-2", size: "standard", facing: "south" },
        { type: "gap", minTiles: 3 },
      ],
      minMargin: 2,
    },
    // South wall: slots 3 & 4
    south: {
      segments: [
        { type: "gap", minTiles: 3 },
        { type: "exhibit", refId: "slot-3", size: "standard", facing: "north" },
        { type: "gap", minTiles: 4 },
        { type: "exhibit", refId: "slot-4", size: "standard", facing: "north" },
        { type: "gap", minTiles: 3 },
      ],
      minMargin: 2,
    },
    // East wall: slot 5
    east: {
      segments: [
        { type: "gap", minTiles: 4 },
        { type: "exhibit", refId: "slot-5", size: "standard", facing: "west" },
        { type: "gap", minTiles: 4 },
      ],
      minMargin: 2,
    },
    // West wall: slot 6
    west: {
      segments: [
        { type: "gap", minTiles: 4 },
        { type: "exhibit", refId: "slot-6", size: "standard", facing: "east" },
        { type: "gap", minTiles: 4 },
      ],
      minMargin: 2,
    },
  },
  performers: [
    // 2×3 grid spread around center, all facing south
    { offsetX: -0.3, offsetY: -0.3, facing: "south", refId: "slot-1" },
    { offsetX: 0.3, offsetY: -0.3, facing: "south", refId: "slot-2" },
    { offsetX: -0.3, offsetY: 0, facing: "south", refId: "slot-3" },
    { offsetX: 0.3, offsetY: 0, facing: "south", refId: "slot-4" },
    { offsetX: -0.3, offsetY: 0.3, facing: "south", refId: "slot-5" },
    { offsetX: 0.3, offsetY: 0.3, facing: "south", refId: "slot-6" },
  ],
  minInteriorWidth: 22,
  minInteriorHeight: 22,
  furniture: [
    { role: "bench", offsetX: 0, offsetY: 0.1, rotationY: 0 },
    { role: "plant", offsetX: -0.38, offsetY: -0.38 },
    { role: "plant", offsetX: 0.38, offsetY: -0.38 },
  ],
};


export const PERSONAL_MUSEUM_ROOMS: RoomNode[] = [PERSONAL_GALLERY];

export const PERSONAL_MUSEUM_EDGES: RoomEdge[] = [];

/**
 * Stable slot ids derived from the room's exhibit wall segments,
 * in wall order: north → south → east → west.
 */
export const PERSONAL_MUSEUM_SLOT_IDS: string[] = [
  PERSONAL_GALLERY.walls.north,
  PERSONAL_GALLERY.walls.south,
  PERSONAL_GALLERY.walls.east,
  PERSONAL_GALLERY.walls.west,
]
  .flatMap((wall) => wall.segments)
  .filter((s): s is Extract<typeof s, { type: "exhibit" }> => s.type === "exhibit")
  .map((s) => s.refId);
