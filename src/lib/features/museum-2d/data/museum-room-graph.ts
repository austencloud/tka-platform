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
  // ── Phase 3: Digital era + Suppression ──

  {
    id: "digital",
    name: "Digital Wing",
    minWidth: 20,
    maxWidth: 26,
    minHeight: 18,
    maxHeight: 22,
    material: "stone",
    theme: "digital",
    description:
      "CRT glow and the hum of fluorescent tubes. The 1990s wing documents the moment " +
      "kinetic notation escaped into the digital world. A terminal sits in the corner, " +
      "still running TKA-OS v2. BBS printouts line the walls.",
    exhibits: [
      { wall: "north", position: 0.5, refId: "digital-crt", facing: "south" },
      { wall: "west", position: 0.35, refId: "digital-bbs", facing: "east" },
      { wall: "east", position: 0.5, refId: "digital-3400", facing: "west" },
      { wall: "south", position: 0.5, refId: "digital-team", facing: "north" },
    ],
  },
  {
    id: "suppression",
    name: "The Suppression",
    minWidth: 28,
    maxWidth: 34,
    minHeight: 24,
    maxHeight: 30,
    material: "marble",
    theme: "institutional",
    description:
      "Fluorescent flicker. Sterile institutional lighting. This is the reveal wing. " +
      "The Order of the Closed Palm is named here for the first time. " +
      "The symbol you've been seeing since the cave is everywhere now. " +
      "The air smells like old paper and bureaucratic dread.",
    exhibits: [
      { wall: "north", position: 0.3, refId: "supp-order-1", facing: "south" },
      { wall: "north", position: 0.5, refId: "supp-order-2", facing: "south" },
      { wall: "north", position: 0.7, refId: "supp-order-3", facing: "south" },
      { wall: "west", position: 0.4, refId: "supp-lethe", facing: "east" },
      { wall: "east", position: 0.4, refId: "supp-youve-seen", facing: "west" },
      { wall: "south", position: 0.5, refId: "supp-may8", facing: "north" },
    ],
  },
  {
    id: "vtg-wing",
    name: "The Vulcan Wing",
    minWidth: 14,
    maxWidth: 18,
    minHeight: 12,
    maxHeight: 14,
    material: "stone",
    theme: "construction",
    description:
      "NOTICE: This exhibit has been under renovation since 2024. " +
      "Estimated completion: [DATE NOT FOUND]. " +
      "Visitors interested in the Vulcan notation tradition are encouraged " +
      "to consult external resources.",
    exhibits: [
      { wall: "north", position: 0.5, refId: "vtg-renovation", facing: "south" },
    ],
  },

  // ── Phase 4: Post-Order rooms ──

  {
    id: "crumble",
    name: "The Crumble",
    minWidth: 8,
    maxWidth: 10,
    minHeight: 18,
    maxHeight: 22,
    material: "dirt",
    theme: "construction",
    description:
      "The seam. Water-stained walls. Half-installed exhibits frozen mid-construction. " +
      "Filing cabinets left open, papers scattered. The approval loop that strangled " +
      "the Order is visible in the unfinished work. 23 years of abandonment.",
  },
  {
    id: "gallery",
    name: "K's Gallery",
    minWidth: 24,
    maxWidth: 30,
    minHeight: 22,
    maxHeight: 28,
    material: "wood",
    theme: "gallery",
    description:
      "Warm wood floors, steady torchlight. Someone has been living here. " +
      "The exhibits are handmade — sticky notes evolving into proper signs. " +
      "This is where the museum stops being an archive and starts being an invitation.",
    exhibits: [
      { wall: "north", position: 0.5, refId: "gallery-spiral", facing: "south" },
      { wall: "west", position: 0.4, refId: "gallery-scribes", facing: "east" },
      { wall: "east", position: 0.4, refId: "gallery-practice", facing: "west" },
      { wall: "south", position: 0.5, refId: "gallery-k-note", facing: "north" },
    ],
    performers: [
      { offsetX: 0, offsetY: 0.1, facing: "south", refId: "gallery-scribe" },
    ],
    torches: [
      { wall: "west", position: 0.1 },
      { wall: "east", position: 0.1 },
      { wall: "west", position: 0.85 },
      { wall: "east", position: 0.85 },
    ],
  },
  {
    id: "fear",
    name: "Room of Fear",
    minWidth: 18,
    maxWidth: 22,
    minHeight: 16,
    maxHeight: 20,
    material: "stone",
    theme: "institutional",
    description:
      "Containment warnings on every wall. Closed Palm symbols stamped on every surface. " +
      "The Order's final argument: this knowledge is a public health hazard. " +
      "Seal the archive. Walk away.",
    exhibits: [
      { wall: "north", position: 0.3, refId: "fear-containment-1", facing: "south" },
      { wall: "north", position: 0.5, refId: "fear-containment-2", facing: "south" },
      { wall: "north", position: 0.7, refId: "fear-containment-3", facing: "south" },
    ],
  },
  {
    id: "isolation",
    name: "Room of Isolation",
    minWidth: 28,
    maxWidth: 34,
    minHeight: 22,
    maxHeight: 28,
    material: "marble",
    theme: "institutional",
    description:
      "Cubicle walls for flow artists. Three feet apart with walls between them. " +
      "Each person has something whole and beautiful. The problem isn't that anyone's piece " +
      "is incomplete — it's that nobody's sharing it.",
  },
  {
    id: "collaboration",
    name: "Room of Collaboration",
    minWidth: 24,
    maxWidth: 30,
    minHeight: 20,
    maxHeight: 26,
    material: "dirt",
    theme: "outdoor",
    description:
      "Birds chirping. Trees. Light. Warmth. Real people spinning together. " +
      "Imperfect technique. Fully alive. The activity that 40,000 years of history " +
      "has been arguing over, just happening.",
    performers: [
      { offsetX: -0.2, offsetY: -0.15, facing: "east", refId: "collab-1" },
      { offsetX: 0.15, offsetY: -0.2, facing: "west", refId: "collab-2" },
      { offsetX: 0.25, offsetY: 0.15, facing: "north", refId: "collab-3" },
      { offsetX: -0.1, offsetY: 0.2, facing: "south", refId: "collab-4" },
    ],
  },

  // ── Phase 5: Final rooms + Easter eggs ──

  {
    id: "gift-shop",
    name: "Gift Shop",
    minWidth: 20,
    maxWidth: 24,
    minHeight: 16,
    maxHeight: 20,
    material: "marble",
    theme: "retail",
    description:
      "Bright commercial lighting. Dusty shelves of branded merchandise from a secret society " +
      "that no longer exists. A crumpled $20 bill on the floor near the entrance. " +
      "A mannequin in a museum uniform stands behind the register.",
    performers: [
      { offsetX: 0.35, offsetY: 0, facing: "west", refId: "shop-cashier" },
    ],
  },
  {
    id: "construction-zone",
    name: "Construction Zone",
    minWidth: 14,
    maxWidth: 18,
    minHeight: 12,
    maxHeight: 16,
    material: "dirt",
    theme: "construction",
    description:
      "Work lights. Scaffolding. Unfinished exhibits frozen mid-construction. " +
      "A hard hat on the ground. A door at the back marked MAINTENANCE.",
    exhibits: [
      { wall: "north", position: 0.5, refId: "cz-staff-only", facing: "south" },
    ],
  },
  {
    id: "janitor",
    name: "Janitor's Closet",
    minWidth: 8,
    maxWidth: 10,
    minHeight: 6,
    maxHeight: 8,
    material: "dirt",
    theme: "construction",
    description:
      "A single bare bulb. Hot glue guns on a shelf. Foam core scraps. " +
      "A whiteboard that reads AUSTEN'S FAKE MUSEUM IDEAS. " +
      "A mannequin with a photograph taped to its face. " +
      "No plaque. No explanation.",
    exhibits: [
      { wall: "east", position: 0.5, refId: "janitor-whiteboard", facing: "west" },
      { wall: "west", position: 0.5, refId: "janitor-mannequin", facing: "east" },
    ],
    torches: [
      { wall: "north", position: 0.5 },
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
  // Phase 3
  {
    from: "victorian",
    to: "digital",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 4,
  },
  {
    from: "digital",
    to: "suppression",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 4,
  },
  {
    from: "digital",
    to: "vtg-wing",
    type: "side-branch",
    fromWall: "west",
    toWall: "east",
    corridorWidth: 4,
  },
  // Phase 4
  {
    from: "suppression",
    to: "crumble",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 4,
  },
  {
    from: "crumble",
    to: "gallery",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 4,
  },
  {
    from: "gallery",
    to: "fear",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 4,
  },
  {
    from: "fear",
    to: "isolation",
    type: "main-path",
    fromWall: "east",
    toWall: "west",
    corridorWidth: 4,
  },
  {
    from: "isolation",
    to: "collaboration",
    type: "main-path",
    fromWall: "east",
    toWall: "west",
    corridorWidth: 4,
  },
  // Phase 5
  {
    from: "collaboration",
    to: "gift-shop",
    type: "main-path",
    fromWall: "south",
    toWall: "north",
    corridorWidth: 4,
  },
  {
    from: "victorian",
    to: "construction-zone",
    type: "side-branch",
    fromWall: "south",
    toWall: "north",
    corridorWidth: 4,
  },
  {
    from: "construction-zone",
    to: "janitor",
    type: "side-branch",
    fromWall: "east",
    toWall: "west",
    corridorWidth: 3,
  },
];

// ── Grid Configuration ──

export const GRID_CONFIG: GridConfig = {
  cellWidth: 40,
  cellHeight: 40,
  padding: 2,
};
