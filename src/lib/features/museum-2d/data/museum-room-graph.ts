/**
 * Museum Room Graph — Phases 1-2
 *
 * Defines the abstract topology of the museum: rooms as nodes, connections
 * as edges. No absolute coordinates here. The layout engine computes positions
 * from this graph + the grid config.
 *
 * Phase 1: Entrance Lobby + Vulcan Cave
 * Phase 2: Egyptian + Renaissance + Victorian wings
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
  // ── Phase 2: Order-era wings ──

  {
    id: "egyptian",
    name: "Egyptian Wing",
    minWidth: 24,
    maxWidth: 30,
    minHeight: 20,
    maxHeight: 26,
    material: "sandstone",
    theme: "classical",
    description:
      "Warm sandstone and the soft glow of oil lamps. " +
      "This wing documents the formalization of the Type system in ancient Egypt and Greece. " +
      "Four stone pillars frame the central hall. " +
      "The first hint that access to this knowledge was deliberately restricted.",
    exhibits: [
      { wall: "north", position: 0.5, refId: "egypt-karnak", facing: "south" },
      { wall: "west", position: 0.35, refId: "egypt-priesthood", facing: "east" },
      { wall: "east", position: 0.35, refId: "egypt-amphora", facing: "west" },
      { wall: "south", position: 0.5, refId: "egypt-controlled", facing: "north" },
    ],
    torches: [
      { wall: "west", position: 0.1 },
      { wall: "east", position: 0.1 },
      { wall: "west", position: 0.85 },
      { wall: "east", position: 0.85 },
    ],
  },
  {
    id: "renaissance",
    name: "Renaissance Wing",
    minWidth: 20,
    maxWidth: 26,
    minHeight: 18,
    maxHeight: 24,
    material: "wood",
    theme: "renaissance",
    description:
      "Natural light and the smell of old wood. Da Vinci's workshop, recreated from contemporary accounts. " +
      "Codex pages and rotational diagrams cover the walls. The notebooks were scattered after his death. " +
      "Someone wanted the complete system to be unrecoverable.",
    exhibits: [
      { wall: "north", position: 0.5, refId: "ren-codex", facing: "south" },
      { wall: "west", position: 0.4, refId: "ren-vitruvian", facing: "east" },
      { wall: "east", position: 0.5, refId: "ren-workshop", facing: "west" },
      { wall: "south", position: 0.5, refId: "ren-notebooks", facing: "north" },
    ],
    torches: [
      { wall: "north", position: 0.15 },
      { wall: "north", position: 0.85 },
    ],
  },
  {
    id: "victorian",
    name: "Victorian Wing",
    minWidth: 22,
    maxWidth: 28,
    minHeight: 20,
    maxHeight: 26,
    material: "marble",
    theme: "industrial",
    description:
      "Gas lamps and brass fittings. The Victorian era brought mechanization to kinetic notation — " +
      "and the first systematic suppression. Patents filed, patents recalled. " +
      "Inventors discredited by scandal. The method is never explained.",
    exhibits: [
      { wall: "north", position: 0.5, refId: "vic-brass", facing: "south" },
      { wall: "west", position: 0.4, refId: "vic-patents", facing: "east" },
      { wall: "east", position: 0.4, refId: "vic-portraits", facing: "west" },
      { wall: "south", position: 0.5, refId: "vic-discredited", facing: "north" },
    ],
    torches: [
      { wall: "west", position: 0.1 },
      { wall: "east", position: 0.1 },
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
  {
    from: "vulcan-cave",
    to: "egyptian",
    type: "main-path",
    fromWall: "east",
    toWall: "west",
    corridorWidth: 4,
  },
  {
    from: "egyptian",
    to: "renaissance",
    type: "main-path",
    fromWall: "south",
    toWall: "north",
    corridorWidth: 4,
  },
  {
    from: "renaissance",
    to: "victorian",
    type: "main-path",
    fromWall: "west",
    toWall: "east",
    corridorWidth: 4,
  },
];

// ── Grid Configuration ──

export const GRID_CONFIG: GridConfig = {
  cellWidth: 40,
  cellHeight: 40,
  padding: 2,
};
