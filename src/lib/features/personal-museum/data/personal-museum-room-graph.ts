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

// ── Room definition ──

const PERSONAL_GALLERY: RoomNode = {
  id: "personal-gallery",
  name: "My Gallery",
  material: "marble",
  theme: "gallery",
  description:
    "Your personal gallery — a quiet marble room where your saved sequences hang on the walls. " +
    "Each frame holds a sequence you've collected. The room grows with you.",
  walls: {
    north: {
      segments: [
        { type: "gap", minTiles: 2 },
        { type: "exhibit", refId: "slot-n1", size: "standard", facing: "south" },
        { type: "gap", minTiles: 2 },
        { type: "exhibit", refId: "slot-n2", size: "standard", facing: "south" },
        { type: "gap", minTiles: 2 },
        { type: "exhibit", refId: "slot-n3", size: "standard", facing: "south" },
        { type: "gap", minTiles: 2 },
      ],
      minMargin: 2,
    },
    south: {
      segments: [
        { type: "gap", minTiles: 3 },
        { type: "exhibit", refId: "slot-s1", size: "standard", facing: "north" },
        { type: "gap", minTiles: 4 },
        { type: "exhibit", refId: "slot-s2", size: "standard", facing: "north" },
        { type: "gap", minTiles: 3 },
      ],
      minMargin: 2,
    },
    east: {
      segments: [
        { type: "gap", minTiles: 3 },
        { type: "exhibit", refId: "slot-e1", size: "standard", facing: "west" },
        { type: "gap", minTiles: 4 },
        { type: "exhibit", refId: "slot-e2", size: "standard", facing: "west" },
        { type: "gap", minTiles: 3 },
      ],
      minMargin: 2,
    },
    west: {
      segments: [
        { type: "gap", minTiles: 3 },
        { type: "exhibit", refId: "slot-w1", size: "standard", facing: "east" },
        { type: "gap", minTiles: 4 },
        { type: "exhibit", refId: "slot-w2", size: "standard", facing: "east" },
        { type: "gap", minTiles: 3 },
      ],
      minMargin: 2,
    },
  },
  minInteriorWidth: 18,
  minInteriorHeight: 18,
  furniture: [
    { role: "bench", offsetX: 0, offsetY: 0.1, rotationY: 0 },
    { role: "plant", offsetX: -0.38, offsetY: -0.38 },
    { role: "plant", offsetX: 0.38, offsetY: -0.38 },
  ],
};

// ── Exports ──

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
