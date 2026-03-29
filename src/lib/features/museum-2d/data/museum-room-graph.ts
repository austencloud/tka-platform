/**
 * Museum Room Graph — Phase 1
 *
 * Defines the abstract topology of the museum: rooms as nodes, connections
 * as edges. No absolute coordinates here. The layout engine computes positions
 * from this graph + the grid config.
 *
 * Phase 1: Entrance Lobby + Vulcan Cave (2 rooms, 1 corridor).
 * Future phases add rooms by extending MUSEUM_ROOMS and MUSEUM_EDGES.
 */

import type { RoomNode, RoomEdge, GridConfig } from "../domain/layout-types";

// ── Room Definitions ──

export const MUSEUM_ROOMS: RoomNode[] = [
  {
    id: "entrance",
    name: "Entrance Lobby",
    minWidth: 20,
    maxWidth: 26,
    minHeight: 14,
    maxHeight: 18,
    material: "marble",
    theme: "institutional",
    description:
      "The front entrance of The Kinetic Archive. " +
      "A guest book sits near the door. The marble floor is worn from decades of foot traffic. " +
      "A corridor leads north into the first exhibit.",
    exhibits: [
      {
        wall: "north",
        position: 0.5,
        refId: "entrance-welcome",
        facing: "south",
      },
      {
        wall: "south",
        position: 0.5,
        refId: "entrance-guest-book",
        facing: "north",
      },
    ],
  },
  {
    id: "vulcan-cave",
    name: "Vulcan Cave",
    minWidth: 26,
    maxWidth: 32,
    minHeight: 24,
    maxHeight: 30,
    material: "stone",
    theme: "cave",
    description:
      "The cave of ancient origins. Lascaux-style tablets line the north wall. " +
      "Cave painting panels hang on the west wall depicting early kinetic notation. " +
      "Torchlight flickers across rough stone. Two figures in animal skins " +
      "demonstrate the earliest known sequences with crude wooden clubs.",
    exhibits: [
      {
        wall: "north",
        position: 0.4,
        refId: "cave-lascaux-1",
        facing: "south",
      },
      {
        wall: "north",
        position: 0.6,
        refId: "cave-lascaux-2",
        facing: "south",
      },
      {
        wall: "west",
        position: 0.3,
        refId: "cave-paintings-1",
        facing: "east",
      },
      {
        wall: "west",
        position: 0.6,
        refId: "cave-paintings-2",
        facing: "east",
      },
      {
        wall: "west",
        position: 0.8,
        refId: "cave-marchand",
        facing: "east",
      },
    ],
    performers: [
      {
        offsetX: -0.15,
        offsetY: 0.1,
        facing: "south",
        refId: "cave-performer-1",
      },
      {
        offsetX: 0.15,
        offsetY: 0.1,
        facing: "south",
        refId: "cave-performer-2",
      },
    ],
    torches: [
      { wall: "west", position: 0.1 },
      { wall: "east", position: 0.1 },
      { wall: "west", position: 0.85 },
      { wall: "east", position: 0.85 },
      { wall: "north", position: 0.2 },
      { wall: "south", position: 0.8 },
    ],
  },
];

// ── Edge Definitions ──

export const MUSEUM_EDGES: RoomEdge[] = [
  {
    from: "entrance",
    to: "vulcan-cave",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 4,
  },
];

// ── Grid Configuration ──

export const GRID_CONFIG: GridConfig = {
  cellWidth: 40,
  cellHeight: 40,
  padding: 2,
};
