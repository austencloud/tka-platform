import type { GridConfig, RoomEdge, RoomNode } from "../domain/layout-types";
import type {
  MuseumFloorPlanPoint,
  MuseumFloorPlanZone,
  MuseumFloorPlanZoneTone,
} from "../domain/museum-floor-plan-types";
import { tileKey } from "../domain/museum-grid-types";
import type { WallDefinition } from "../domain/wall-segment-types";
import { buildMuseumGrid } from "../services/museum-grid-builder";
import type { MuseumGridBuildResult } from "../services/types";
import { createDrownedGalleryTerrain } from "./drowned-gallery-terrain";
import { CAVE_THRESHOLD_ROOM } from "./lobby-floor-plan";

type WallName = "north" | "south" | "east" | "west";

export interface CaveModeRoom {
  roomId: string;
  label: string;
  category: "SS" | "SO" | "TS" | "TO" | "QS" | "QO";
  technicalMode: string;
  performerId: string;
  sequenceId: string;
  tone: MuseumFloorPlanZoneTone;
}

export const CAVE_MODE_ROOMS = [
  {
    roomId: "cave-water",
    label: "Water",
    category: "SS",
    technicalMode: "Split-time / same-direction",
    performerId: "cave-water-automaton",
    sequenceId: "cave-water-seq",
    tone: "arrival",
  },
  {
    roomId: "cave-fire",
    label: "Fire",
    category: "SO",
    technicalMode: "Split-time / opposite-direction",
    performerId: "cave-fire-automaton",
    sequenceId: "cave-fire-seq",
    tone: "retail",
  },
  {
    roomId: "cave-earth",
    label: "Earth",
    category: "TS",
    technicalMode: "Together-time / same-direction",
    performerId: "cave-earth-automaton",
    sequenceId: "cave-earth-seq",
    tone: "social",
  },
  {
    roomId: "cave-air",
    label: "Air",
    category: "TO",
    technicalMode: "Together-time / opposite-direction",
    performerId: "cave-air-automaton",
    sequenceId: "cave-air-seq",
    tone: "service",
  },
  {
    roomId: "cave-sun",
    label: "Sun",
    category: "QS",
    technicalMode: "Quarter-time / same-direction",
    performerId: "cave-sun-automaton",
    sequenceId: "cave-sun-seq",
    tone: "anchor",
  },
  {
    roomId: "cave-moon",
    label: "Moon",
    category: "QO",
    technicalMode: "Quarter-time / opposite-direction",
    performerId: "cave-moon-automaton",
    sequenceId: "cave-moon-seq",
    tone: "exhibit",
  },
] as const satisfies readonly CaveModeRoom[];

export const CAVE_SPACE_ORDER = [
  "cave-threshold",
  "cave-squeeze",
  "cave-water-approach",
  "cave-water-sump",
  "cave-water",
  "cave-fire",
  "cave-earth",
  "cave-air",
  "cave-sun",
  "cave-moon",
  "egypt-threshold",
] as const;

const LOBBY_TO_CAVE_EDGE_ID = "lobby->cave-threshold";

const EDGE_IDS = {
  thresholdToSqueeze: "cave-threshold->cave-squeeze",
  squeezeToApproach: "cave-squeeze->cave-water-approach",
  approachToSump: "cave-water-approach->cave-water-sump",
  sumpToGrotto: "cave-water-sump->cave-water",
  waterToFire: "cave-water->cave-fire",
  fireToEarth: "cave-fire->cave-earth",
  earthToAir: "cave-earth->cave-air",
  airToSun: "cave-air->cave-sun",
  sunToMoon: "cave-sun->cave-moon",
  moonToEgypt: "cave-moon->egypt-threshold",
} as const;

const EMPTY_WALL: WallDefinition = { segments: [], minMargin: 1 };

function doorWall(
  edgeId: string,
  alignment: NonNullable<WallDefinition["alignment"]>,
  width = 4
): WallDefinition {
  return {
    segments: [{ type: "door", edgeId, width }],
    minMargin: 1,
    alignment,
  };
}

/**
 * Door wall with no extra margin beyond the two corner tiles. The stamper
 * already reserves both corners, so minMargin 0 is safe — it just lets a
 * passage be as narrow as its door (used by the sump, which must read as a
 * ~2.5 m flooded squeeze rather than a room).
 */
function narrowDoorWall(
  edgeId: string,
  alignment: NonNullable<WallDefinition["alignment"]>,
  width = 3
): WallDefinition {
  return {
    segments: [{ type: "door", edgeId, width }],
    minMargin: 0,
    alignment,
  };
}

function torchWall(
  alignment: NonNullable<WallDefinition["alignment"]> = "center"
): WallDefinition {
  return {
    segments: [{ type: "torch" }],
    minMargin: 1,
    alignment,
  };
}

const thresholdRoom: RoomNode = {
  ...CAVE_THRESHOLD_ROOM,
  spawn: { offsetX: -0.28, offsetY: 0.28, facing: "north" },
  walls: {
    ...CAVE_THRESHOLD_ROOM.walls,
    north: doorWall(EDGE_IDS.thresholdToSqueeze, "start", 3),
    south: doorWall(LOBBY_TO_CAVE_EDGE_ID, "end", 6),
  },
};

export const VULCAN_CAVE_ROOMS: RoomNode[] = [
  thresholdRoom,
  {
    id: "cave-squeeze",
    name: "The Squeeze",
    material: "dirt",
    theme: "cave",
    minInteriorWidth: 4,
    minInteriorHeight: 12,
    description:
      "A narrow, bent passage that removes the lobby before the first chamber opens.",
    walls: {
      north: doorWall(EDGE_IDS.squeezeToApproach, "start", 3),
      south: doorWall(EDGE_IDS.thresholdToSqueeze, "end", 3),
      east: torchWall("end"),
      west: EMPTY_WALL,
    },
  },
  {
    id: "cave-water-approach",
    name: "The Flooded Approach",
    material: "stone",
    theme: "cave",
    minInteriorWidth: 3,
    minInteriorHeight: 16,
    description:
      "A descending passage where water is heard before it is seen; the floor drops toward the waterline.",
    roomPresentation: { suppressTileGeometry: true },
    walls: {
      north: narrowDoorWall(EDGE_IDS.approachToSump, "start", 3),
      south: narrowDoorWall(EDGE_IDS.squeezeToApproach, "end", 3),
      east: EMPTY_WALL,
      west: EMPTY_WALL,
    },
  },
  {
    id: "cave-water-sump",
    name: "The Sump",
    material: "stone",
    theme: "cave",
    minInteriorWidth: 3,
    minInteriorHeight: 14,
    description:
      "A fully flooded passage. The visitor walks the sump floor below the waterline and surfaces at the far end.",
    roomPresentation: { suppressTileGeometry: true },
    walls: {
      north: narrowDoorWall(EDGE_IDS.sumpToGrotto, "start", 3),
      south: narrowDoorWall(EDGE_IDS.approachToSump, "end", 3),
      east: EMPTY_WALL,
      west: EMPTY_WALL,
    },
  },
  {
    id: "cave-water",
    name: "The Drowned Gallery",
    material: "stone",
    theme: "cave",
    minInteriorWidth: 33,
    minInteriorHeight: 29,
    description:
      "The Water grotto: waterfall, mirror pool, glowworm dome, and three waterline alcoves performing A, B, C.",
    roomPresentation: { suppressTileGeometry: true },
    walls: {
      north: torchWall("center"),
      south: doorWall(EDGE_IDS.sumpToGrotto, "start", 3),
      east: doorWall(EDGE_IDS.waterToFire, "end"),
      west: EMPTY_WALL,
    },
    performers: [
      {
        offsetX: -0.28,
        offsetY: -0.42,
        facing: "south",
        refId: "cave-water-a",
        collisionRadiusTiles: 2,
        elevation: -1.0,
      },
      {
        offsetX: 0,
        offsetY: -0.42,
        facing: "south",
        refId: "cave-water-b",
        collisionRadiusTiles: 2,
        elevation: -1.0,
      },
      {
        offsetX: 0.28,
        offsetY: -0.42,
        facing: "south",
        refId: "cave-water-c",
        collisionRadiusTiles: 2,
        elevation: -1.0,
      },
    ],
  },
  {
    id: "cave-fire",
    name: "Fire Chamber",
    material: "dirt",
    theme: "cave",
    minInteriorWidth: 8,
    minInteriorHeight: 8,
    description:
      "A close chamber where rhythmic light makes the second figure feel less predictable.",
    walls: {
      north: torchWall("start"),
      south: EMPTY_WALL,
      east: doorWall(EDGE_IDS.fireToEarth, "end"),
      west: doorWall(EDGE_IDS.waterToFire, "start"),
    },
    performers: [
      {
        offsetX: 0.08,
        offsetY: 0,
        facing: "west",
        refId: "cave-fire-automaton",
        collisionRadiusTiles: 2,
      },
    ],
  },
  {
    id: "cave-earth",
    name: "Earth Chamber",
    material: "stone",
    theme: "cave",
    minInteriorWidth: 11,
    minInteriorHeight: 11,
    description:
      "The cave's largest chamber, with room for the tactile stone grid and its solo demonstration.",
    walls: {
      north: torchWall("center"),
      south: doorWall(EDGE_IDS.earthToAir, "end"),
      east: EMPTY_WALL,
      west: doorWall(EDGE_IDS.fireToEarth, "start"),
    },
    performers: [
      {
        offsetX: 0,
        offsetY: -0.08,
        facing: "west",
        refId: "cave-earth-automaton",
        collisionRadiusTiles: 2.5,
      },
    ],
  },
  {
    id: "cave-air",
    name: "Air Chamber",
    material: "stone",
    theme: "cave",
    minInteriorWidth: 8,
    minInteriorHeight: 11,
    description:
      "A tall-feeling fissure that releases the compression without opening into an ensemble space.",
    walls: {
      north: doorWall(EDGE_IDS.earthToAir, "start"),
      south: doorWall(EDGE_IDS.airToSun, "end", 3),
      east: torchWall("start"),
      west: EMPTY_WALL,
    },
    performers: [
      {
        offsetX: 0,
        offsetY: 0,
        facing: "north",
        refId: "cave-air-automaton",
        collisionRadiusTiles: 2,
      },
    ],
  },
  {
    id: "cave-sun",
    name: "Sun Chamber",
    material: "sandstone",
    theme: "cave",
    minInteriorWidth: 7,
    minInteriorHeight: 7,
    description:
      "A warm, close chamber that begins the cave's deepest paired idea without joining the figures.",
    walls: {
      north: doorWall(EDGE_IDS.airToSun, "start", 3),
      south: torchWall("end"),
      east: doorWall(EDGE_IDS.sunToMoon, "end"),
      west: EMPTY_WALL,
    },
    performers: [
      {
        offsetX: 0,
        offsetY: 0,
        facing: "north",
        refId: "cave-sun-automaton",
        collisionRadiusTiles: 2,
      },
    ],
  },
  {
    id: "cave-moon",
    name: "Moon Chamber",
    material: "stone",
    theme: "cave",
    minInteriorWidth: 7,
    minInteriorHeight: 7,
    description:
      "A colder, quieter chamber that completes the pairing as a separate encounter.",
    walls: {
      north: EMPTY_WALL,
      south: torchWall("start"),
      east: doorWall(EDGE_IDS.moonToEgypt, "end"),
      west: doorWall(EDGE_IDS.sunToMoon, "start"),
    },
    performers: [
      {
        offsetX: 0,
        offsetY: 0,
        facing: "west",
        refId: "cave-moon-automaton",
        collisionRadiusTiles: 2,
      },
    ],
  },
  {
    id: "egypt-threshold",
    name: "Egypt Threshold",
    material: "sandstone",
    theme: "classical",
    minInteriorWidth: 6,
    minInteriorHeight: 6,
    description:
      "A small sealed transition where warm sandstone light previews the next wing.",
    walls: {
      north: torchWall("end"),
      south: EMPTY_WALL,
      east: EMPTY_WALL,
      west: doorWall(EDGE_IDS.moonToEgypt, "start"),
    },
  },
];

export const VULCAN_CAVE_EDGES: RoomEdge[] = [
  {
    from: "cave-threshold",
    to: "cave-squeeze",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 3,
  },
  {
    from: "cave-squeeze",
    to: "cave-water-approach",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 3,
  },
  {
    from: "cave-water-approach",
    to: "cave-water-sump",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 3,
  },
  {
    from: "cave-water-sump",
    to: "cave-water",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 3,
  },
  {
    from: "cave-water",
    to: "cave-fire",
    type: "main-path",
    fromWall: "east",
    toWall: "west",
    corridorWidth: 4,
  },
  {
    from: "cave-fire",
    to: "cave-earth",
    type: "main-path",
    fromWall: "east",
    toWall: "west",
    corridorWidth: 4,
  },
  {
    from: "cave-earth",
    to: "cave-air",
    type: "main-path",
    fromWall: "south",
    toWall: "north",
    corridorWidth: 4,
  },
  {
    from: "cave-air",
    to: "cave-sun",
    type: "main-path",
    fromWall: "south",
    toWall: "north",
    corridorWidth: 3,
  },
  {
    from: "cave-sun",
    to: "cave-moon",
    type: "main-path",
    fromWall: "east",
    toWall: "west",
    corridorWidth: 4,
  },
  {
    from: "cave-moon",
    to: "egypt-threshold",
    type: "main-path",
    fromWall: "east",
    toWall: "west",
    corridorWidth: 4,
  },
];

const CAVE_PLAN_GRID_CONFIG: GridConfig = {
  cellWidth: 40,
  cellHeight: 40,
  padding: 2,
};

interface CaveSpaceProgram {
  id: (typeof CAVE_SPACE_ORDER)[number];
  title: string;
  description: string;
  tone: MuseumFloorPlanZoneTone;
}

const CAVE_SPACE_PROGRAM: readonly CaveSpaceProgram[] = [
  {
    id: "cave-threshold",
    title: "Cave threshold",
    description:
      "A stone vestibule turns away from the lobby and establishes the inhabited archaeological frame.",
    tone: "threshold",
  },
  {
    id: "cave-squeeze",
    title: "The squeeze",
    description:
      "The narrowest room removes the lobby sightline before any performer appears.",
    tone: "threshold",
  },
  {
    id: "cave-water-approach",
    title: "Flooded approach",
    description:
      "A descending passage where the sound of water builds before anything is visible.",
    tone: "threshold",
  },
  {
    id: "cave-water-sump",
    title: "The sump",
    description:
      "The route passes fully underwater before surfacing into the Water grotto.",
    tone: "threshold",
  },
  {
    id: "cave-water",
    title: "The drowned gallery",
    description:
      "A waterfall feeds a mirror pool under a glowworm dome; three waterline alcoves perform A, B, and C.",
    tone: "arrival",
  },
  {
    id: "cave-fire",
    title: "Fire chamber",
    description:
      "A second isolated figure gains contrast from a harder pulse of light and sound.",
    tone: "retail",
  },
  {
    id: "cave-earth",
    title: "Earth chamber",
    description:
      "The major spatial release holds the tactile four-beat sequence-matching exhibit.",
    tone: "social",
  },
  {
    id: "cave-air",
    title: "Air chamber",
    description:
      "A narrower footprint and taller authored shell create a vertical release after Earth.",
    tone: "service",
  },
  {
    id: "cave-sun",
    title: "Sun chamber",
    description:
      "The first celestial figure begins a paired idea while remaining a separate encounter.",
    tone: "anchor",
  },
  {
    id: "cave-moon",
    title: "Moon chamber",
    description:
      "A colder final solo completes the pair without creating an ensemble sightline.",
    tone: "exhibit",
  },
  {
    id: "egypt-threshold",
    title: "Egypt threshold",
    description:
      "A sealed sandstone transition supplies the first warm cue from the next wing.",
    tone: "threshold",
  },
];

export interface VulcanCaveFloorPlan extends MuseumGridBuildResult {
  edges: RoomEdge[];
  zones: MuseumFloorPlanZone[];
  circulation: MuseumFloorPlanPoint[];
  modeRooms: readonly CaveModeRoom[];
  totalInteriorAreaMetres: number;
}

function roomCenter(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): MuseumFloorPlanPoint {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function findDoorCenter(
  build: MuseumGridBuildResult,
  roomId: string,
  wall: WallName
): MuseumFloorPlanPoint {
  const room = build.grid.wings.find((wing) => wing.id === roomId);
  if (!room) throw new Error(`Missing authored cave room "${roomId}"`);

  const coordinates: MuseumFloorPlanPoint[] = [];
  const { x, y, width, height } = room.bounds;
  if (wall === "north" || wall === "south") {
    const wallY = wall === "north" ? y : y + height - 1;
    for (let wallX = x; wallX < x + width; wallX++) {
      if (build.grid.tiles.get(tileKey(wallX, wallY))?.type === "door") {
        coordinates.push({ x: wallX + 0.5, y: wallY + 0.5 });
      }
    }
  } else {
    const wallX = wall === "west" ? x : x + width - 1;
    for (let wallY = y; wallY < y + height; wallY++) {
      if (build.grid.tiles.get(tileKey(wallX, wallY))?.type === "door") {
        coordinates.push({ x: wallX + 0.5, y: wallY + 0.5 });
      }
    }
  }

  if (coordinates.length === 0) {
    throw new Error(`Expected a ${wall} door in cave room "${roomId}"`);
  }

  return {
    x:
      coordinates.reduce((sum, point) => sum + point.x, 0) / coordinates.length,
    y:
      coordinates.reduce((sum, point) => sum + point.y, 0) / coordinates.length,
  };
}

function buildCirculation(
  build: MuseumGridBuildResult
): MuseumFloorPlanPoint[] {
  const points: MuseumFloorPlanPoint[] = [];
  const append = (point: MuseumFloorPlanPoint) => {
    const previous = points.at(-1);
    if (previous?.x !== point.x || previous?.y !== point.y) {
      points.push(point);
    }
  };

  append({ x: build.grid.spawn.x + 0.5, y: build.grid.spawn.y + 0.5 });

  for (const edge of VULCAN_CAVE_EDGES) {
    const fromRoom = build.grid.wings.find((wing) => wing.id === edge.from);
    const toRoom = build.grid.wings.find((wing) => wing.id === edge.to);
    if (!fromRoom || !toRoom) {
      throw new Error(`Cave circulation is missing ${edge.from} or ${edge.to}`);
    }

    const fromDoor = findDoorCenter(build, edge.from, edge.fromWall);
    const toDoor = findDoorCenter(build, edge.to, edge.toWall);
    append(roomCenter(fromRoom.bounds));
    append(fromDoor);

    if (edge.fromWall === "north" || edge.fromWall === "south") {
      const midY = Math.floor((fromDoor.y + toDoor.y) / 2) + 0.5;
      append({ x: fromDoor.x, y: midY });
      append({ x: toDoor.x, y: midY });
    } else {
      const midX = Math.floor((fromDoor.x + toDoor.x) / 2) + 0.5;
      append({ x: midX, y: fromDoor.y });
      append({ x: midX, y: toDoor.y });
    }

    append(toDoor);
    append(roomCenter(toRoom.bounds));
  }

  return points;
}

export function buildVulcanCaveFloorPlan(): VulcanCaveFloorPlan {
  const build = buildMuseumGrid(
    VULCAN_CAVE_ROOMS,
    VULCAN_CAVE_EDGES,
    CAVE_PLAN_GRID_CONFIG
  );

  const zones = CAVE_SPACE_PROGRAM.map((space, index) => {
    const room = build.grid.wings.find((wing) => wing.id === space.id);
    if (!room) throw new Error(`Cave plan did not produce room "${space.id}"`);

    return {
      ...space,
      number: index + 1,
      x: room.bounds.x + 1,
      y: room.bounds.y + 1,
      width: room.bounds.width - 2,
      height: room.bounds.height - 2,
    } satisfies MuseumFloorPlanZone;
  });

  // Elevation + water blocking for the Drowned Gallery. Physics reads it for
  // ground clamping; the graybox layer reads the same layout for its meshes.
  const terrain = createDrownedGalleryTerrain(build.grid);
  if (terrain) build.grid.terrain = terrain;

  const totalInteriorTiles = build.grid.wings.reduce(
    (sum, wing) => sum + (wing.bounds.width - 2) * (wing.bounds.height - 2),
    0
  );

  return {
    ...build,
    edges: VULCAN_CAVE_EDGES,
    zones,
    circulation: buildCirculation(build),
    modeRooms: CAVE_MODE_ROOMS,
    totalInteriorAreaMetres:
      totalInteriorTiles * build.grid.tileScale * build.grid.tileScale,
  };
}
