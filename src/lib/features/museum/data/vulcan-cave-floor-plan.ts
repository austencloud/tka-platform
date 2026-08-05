import type { GridConfig, RoomEdge, RoomNode } from "../domain/layout-types";
import type {
  MuseumFloorPlanPoint,
  MuseumFloorPlanZone,
  MuseumFloorPlanZoneTone,
} from "../domain/museum-floor-plan-types";
import { tileKey } from "../domain/museum-grid-types";
import type { MuseumTerrainProgram } from "../domain/museum-grid-types";
import type { WallDefinition } from "../domain/wall-segment-types";
import { computeRoomDimensions } from "../domain/wall-segment-types";
import { buildMuseumGrid } from "../services/museum-grid-builder";
import type { MuseumGridBuildResult } from "../services/types";
import {
  ALCOVE_X_FRACTIONS,
  ALCOVE_Z_OFFSET_M,
  SHELF_Y,
  TILE_METRES,
  createDrownedGalleryTerrain,
  tileCentredOffset,
} from "./drowned-gallery-terrain";
import {
  buildDrownedGalleryLayout,
  inRectClosed,
  type WorldRect,
} from "./drowned-gallery-terrain";
import {
  buildFirstFireLayout,
  createFirstFireTerrain,
  firstFireStationOffsets,
  SHORE_Y as FIRE_SHORE_Y,
} from "./first-fire-layout";
import {
  buildEarthCanyonLayout,
  createEarthCanyonTerrain,
  earthCanyonStationOffsets,
  BOSS_Y as EARTH_BOSS_Y,
} from "./earth-canyon-layout";
import {
  buildAirChimneyLayout,
  createAirChimneyTerrain,
  airLedgeStationOffsets,
} from "./air-chimney-layout";
import { CAVE_THRESHOLD_ROOM } from "./lobby-floor-plan";

type WallName = "north" | "south" | "east" | "west";

export interface CaveModeRoom {
  roomId: string;
  label: string;
  category: "SS" | "SO" | "TS" | "TO" | "QS" | "QO";
  technicalMode: string;
  /** Every performer the chamber stages. The Water grotto stages three. */
  performerIds: readonly string[];
  /** One authored sequence per performer, in the same order. */
  sequenceIds: readonly string[];
  tone: MuseumFloorPlanZoneTone;
}

export const CAVE_MODE_ROOMS = [
  {
    roomId: "cave-water",
    label: "Water",
    category: "SS",
    technicalMode: "Split-time / same-direction",
    performerIds: ["cave-water-a", "cave-water-b", "cave-water-c"],
    sequenceIds: ["cave-water-seq-a", "cave-water-seq-b", "cave-water-seq-c"],
    tone: "arrival",
  },
  {
    roomId: "cave-fire",
    label: "Fire",
    category: "SO",
    technicalMode: "Split-time / opposite-direction",
    performerIds: [
      "cave-fire-automaton-dj",
      "cave-fire-automaton-ek",
      "cave-fire-automaton-fl",
    ],
    sequenceIds: [
      "cave-fire-seq-dj",
      "cave-fire-seq-ek",
      "cave-fire-seq-fl",
    ],
    tone: "retail",
  },
  {
    roomId: "cave-earth",
    label: "Earth",
    category: "TS",
    technicalMode: "Together-time / same-direction",
    performerIds: [
      "cave-earth-automaton-g",
      "cave-earth-automaton-h",
      "cave-earth-automaton-i",
    ],
    sequenceIds: ["cave-earth-seq-g", "cave-earth-seq-h", "cave-earth-seq-i"],
    tone: "social",
  },
  {
    roomId: "cave-air",
    label: "Air",
    category: "TO",
    technicalMode: "Together-time / opposite-direction",
    performerIds: [
      "cave-air-automaton-dj",
      "cave-air-automaton-ek",
      "cave-air-automaton-fl",
    ],
    sequenceIds: ["cave-air-seq-dj", "cave-air-seq-ek", "cave-air-seq-fl"],
    tone: "service",
  },
  {
    roomId: "cave-sun",
    label: "Sun",
    category: "QS",
    technicalMode: "Quarter-time / same-direction",
    performerIds: ["cave-sun-automaton"],
    sequenceIds: ["cave-sun-seq"],
    tone: "anchor",
  },
  {
    roomId: "cave-moon",
    label: "Moon",
    category: "QO",
    technicalMode: "Quarter-time / opposite-direction",
    performerIds: ["cave-moon-automaton"],
    sequenceIds: ["cave-moon-seq"],
    tone: "exhibit",
  },
] as const satisfies readonly CaveModeRoom[];

export const CAVE_SPACE_ORDER = [
  "cave-threshold",
  "cave-squeeze",
  "cave-water-approach",
  "cave-water-gallery",
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
  approachToGallery: "cave-water-approach->cave-water-gallery",
  galleryToGrotto: "cave-water-gallery->cave-water",
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
 * passage be as narrow as its door, and lets a door sit flush against a
 * corner (the flooded gallery's south door hugs its east wall, which is what
 * turns its path into an S rather than a U).
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

/**
 * The Water grotto's authored shell. Declared before VULCAN_CAVE_ROOMS so the
 * performer stations can be derived from the SAME compiled dimensions the
 * layout engine will use — see grottoPerformers below.
 */
const GROTTO_MIN_INTERIOR_WIDTH = 33;
const GROTTO_MIN_INTERIOR_HEIGHT = 29;

const grottoWalls = {
  north: torchWall("center"),
  south: doorWall(EDGE_IDS.galleryToGrotto, "center", 6),
  east: doorWall(EDGE_IDS.waterToFire, "end"),
  west: EMPTY_WALL,
} satisfies Record<WallName, WallDefinition>;

const grottoDimensions = computeRoomDimensions({
  walls: grottoWalls,
  minInteriorWidth: GROTTO_MIN_INTERIOR_WIDTH,
  minInteriorHeight: GROTTO_MIN_INTERIOR_HEIGHT,
});

/**
 * Converts "n metres from the interior's minimum edge" into the centre-relative
 * fraction `placePerformers` expects, landing on the very tile the layout
 * module's alcove anchor names — `tileCentredOffset` is the shared expression
 * that decides which tile that is. The +0.5 keeps
 * `Math.floor(offset * interior)` exact for negative offsets instead of riding
 * a floating-point boundary.
 */
function interiorOffsetFraction(
  metresFromInteriorMin: number,
  roomSpanTiles: number,
  interiorSpanTiles: number
): number {
  const centred = tileCentredOffset(metresFromInteriorMin);
  const targetTile = 1 + Math.round((centred - TILE_METRES / 2) / TILE_METRES);
  const centreTile = Math.floor(roomSpanTiles / 2);
  return (targetTile - centreTile + 0.5) / interiorSpanTiles;
}

/**
 * A, B and C stand on the alcove shelves. Their anchors come off ONE
 * expression shared with the terrain module (ALCOVE_X_FRACTIONS /
 * ALCOVE_Z_OFFSET_M / SHELF_Y), so a performer can never drift off the shelf
 * the graybox renders under it.
 */
const grottoPerformers = ALCOVE_X_FRACTIONS.map((fraction, index) => ({
  offsetX: interiorOffsetFraction(
    fraction * (grottoDimensions.w - 2) * TILE_METRES,
    grottoDimensions.w,
    grottoDimensions.w - 2
  ),
  offsetY: interiorOffsetFraction(
    ALCOVE_Z_OFFSET_M,
    grottoDimensions.h,
    grottoDimensions.h - 2
  ),
  facing: "south" as const,
  refId: `cave-water-${["a", "b", "c"][index]}`,
  collisionRadiusTiles: 2,
  elevation: SHELF_Y,
}));

/**
 * The First Fire chamber's authored shell. Declared before VULCAN_CAVE_ROOMS
 * for the same reason the grotto's is: the three fire-pit stations come off
 * the SAME compiled dimensions the layout engine uses, so a performer cannot
 * drift off the pit rendered under it.
 *
 * Interior metres = minInterior × ROOM_SCALE (1.5) × TILE (0.5) = ×0.75, so
 * 62 × 27 compiles to ≈ 46.5 × 20.5 m: the design's 26 × 20 m amphitheatre
 * plus the 17.5 m bridge-and-crack approach and the 3 m exit stair.
 */
const FIRE_MIN_INTERIOR_WIDTH = 62;
const FIRE_MIN_INTERIOR_HEIGHT = 27;

const fireWalls = {
  north: torchWall("start"),
  south: EMPTY_WALL,
  // The Earth door sits at the south end of the east wall, which is where the
  // top bench terrace (and therefore the exit stair) is.
  east: doorWall(EDGE_IDS.fireToEarth, "end"),
  west: doorWall(EDGE_IDS.waterToFire, "center"),
} satisfies Record<WallName, WallDefinition>;

const fireDimensions = computeRoomDimensions({
  walls: fireWalls,
  minInteriorWidth: FIRE_MIN_INTERIOR_WIDTH,
  minInteriorHeight: FIRE_MIN_INTERIOR_HEIGHT,
});

const FIRE_STATION_SUFFIXES = ["dj", "ek", "fl"] as const;

const firePerformers = firstFireStationOffsets(
  (fireDimensions.w - 2) * TILE_METRES
).map((offset, index) => ({
  offsetX: interiorOffsetFraction(
    offset.xMetres,
    fireDimensions.w,
    fireDimensions.w - 2
  ),
  offsetY: interiorOffsetFraction(
    offset.zMetres,
    fireDimensions.h,
    fireDimensions.h - 2
  ),
  facing: "south" as const,
  refId: `cave-fire-automaton-${FIRE_STATION_SUFFIXES[index]}`,
  collisionRadiusTiles: 2,
  elevation: FIRE_SHORE_Y,
}));

/**
 * The Earth canyon overlook's authored shell, declared before VULCAN_CAVE_ROOMS
 * for the same reason Water's and Fire's are: the three boss stations come off
 * the SAME compiled dimensions the layout engine uses.
 *
 * Interior metres = ceil(minInterior × 1.5) × 0.5, so 45 × 32 compiles to
 * 34 × 24 m: a 12.5 m grass gully plus a 21.5 × 24 m canyon chamber holding a
 * ⌀14 m void with its rim ring.
 */
// Interior metres = ceil(minInterior × 1.5) × 0.5, the same compile the Earth
// note above describes. 23 × 27 gives 17.5 × 20.5 m.
//
// These were 34 × 48, chosen for the prototype's 18 m ramp run and carrying a
// comment that read them as tiles (17 × 24 m). They are not tiles — the real
// compile was 25.5 × 36 m, which is why the shaft looked lost in the room and
// why the performer ledges sat 11 m from the column. With the ramp gone the
// footprint should be the wing's smallest, per the pacing thesis: Air is the
// narrowest plan and the tallest space.
const AIR_MIN_INTERIOR_WIDTH = 23;
const AIR_MIN_INTERIOR_HEIGHT = 27;

const EARTH_MIN_INTERIOR_WIDTH = 45;
const EARTH_MIN_INTERIOR_HEIGHT = 32;

const earthWalls = {
  // The canyon is open north. The compiled wall stays for collision; the
  // graybox omits its visual and renders the boulder parapet just inside it.
  north: EMPTY_WALL,
  // The Air door sits at the east end of the south wall, at the top of the
  // exit ramp that climbs east along the south rim.
  south: doorWall(EDGE_IDS.earthToAir, "end"),
  east: torchWall("start"),
  west: doorWall(EDGE_IDS.fireToEarth, "center"),
} satisfies Record<WallName, WallDefinition>;

const earthDimensions = computeRoomDimensions({
  walls: earthWalls,
  minInteriorWidth: EARTH_MIN_INTERIOR_WIDTH,
  minInteriorHeight: EARTH_MIN_INTERIOR_HEIGHT,
});

const EARTH_STATION_SUFFIXES = ["g", "h", "i"] as const;

const earthPerformers = earthCanyonStationOffsets(
  (earthDimensions.w - 2) * TILE_METRES
).map((offset, index) => ({
  offsetX: interiorOffsetFraction(
    offset.xMetres,
    earthDimensions.w,
    earthDimensions.w - 2
  ),
  offsetY: interiorOffsetFraction(
    offset.zMetres,
    earthDimensions.h,
    earthDimensions.h - 2
  ),
  // Up and out toward the south rim and the slab overlook, where the visitor
  // stands six metres above them.
  facing: "south" as const,
  refId: `cave-earth-automaton-${EARTH_STATION_SUFFIXES[index]}`,
  collisionRadiusTiles: 2,
  elevation: EARTH_BOSS_Y,
}));

const airWalls = {
  north: doorWall(EDGE_IDS.earthToAir, "start"),
  south: doorWall(EDGE_IDS.airToSun, "end", 3),
  east: torchWall("start"),
  west: EMPTY_WALL,
} satisfies Record<WallName, WallDefinition>;

const airDimensions = computeRoomDimensions({
  walls: airWalls,
  minInteriorWidth: AIR_MIN_INTERIOR_WIDTH,
  minInteriorHeight: AIR_MIN_INTERIOR_HEIGHT,
});

/** Fire's three pairs, met again — DJ, EK, FL — now one per ledge, low → high. */
const AIR_STATION_SUFFIXES = ["dj", "ek", "fl"] as const;

const airPerformers = airLedgeStationOffsets(
  (airDimensions.w - 2) * TILE_METRES
).map((offset, index) => ({
  offsetX: interiorOffsetFraction(
    offset.xMetres,
    airDimensions.w,
    airDimensions.w - 2
  ),
  offsetY: interiorOffsetFraction(
    offset.zMetres,
    airDimensions.h,
    airDimensions.h - 2
  ),
  // Each ledge faces the shaft the visitor rises through.
  facing: offset.facing,
  refId: `cave-air-automaton-${AIR_STATION_SUFFIXES[index]}`,
  // No collision radius on purpose: these stations are 2.4–7.6 m overhead and
  // unreachable by design, and the collider is 2D — one here would plant an
  // invisible pillar in the open floor the room depends on being open.
  elevation: offset.y,
}));

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
      north: narrowDoorWall(EDGE_IDS.approachToGallery, "start", 3),
      south: narrowDoorWall(EDGE_IDS.squeezeToApproach, "end", 3),
      east: EMPTY_WALL,
      west: EMPTY_WALL,
    },
  },
  {
    id: "cave-water-gallery",
    name: "The Flooded Gallery",
    material: "stone",
    theme: "cave",
    // Interior ≈ 13.5 × 24 m once ROOM_SCALE (1.5) is applied. Sized by the
    // walk it has to carry: the submerged span must stay contiguous for 24 m
    // or more, and the S-path plus its two stairs need the room to hold them.
    minInteriorWidth: 18,
    minInteriorHeight: 32,
    description:
      "A rock-roofed flooded gallery walked on the bottom. The ceiling sits below the waterline, so there is no sign of air until the surfacing stair.",
    roomPresentation: { suppressTileGeometry: true },
    walls: {
      // Centred 6-tile (3 m) door onto the grotto: the surfacing stair, the
      // corridor and the grotto's own south door share one axis, which is what
      // makes the arrival a symmetric centre-south composition.
      north: doorWall(EDGE_IDS.galleryToGrotto, "center", 6),
      // Flush against the east wall, so the descent lands off-centre and the
      // path reads as an S rather than doubling back on itself.
      south: narrowDoorWall(EDGE_IDS.approachToGallery, "end", 3),
      east: EMPTY_WALL,
      west: EMPTY_WALL,
    },
  },
  {
    id: "cave-water",
    name: "The Drowned Gallery",
    material: "stone",
    theme: "cave",
    minInteriorWidth: GROTTO_MIN_INTERIOR_WIDTH,
    minInteriorHeight: GROTTO_MIN_INTERIOR_HEIGHT,
    description:
      "The Water grotto: a ring of walkways around a channel and a mirror pool, with three alcoves performing A, B, C across the water.",
    roomPresentation: { suppressTileGeometry: true },
    walls: grottoWalls,
    performers: grottoPerformers,
  },
  {
    id: "cave-fire",
    name: "The First Fire",
    material: "stone",
    theme: "cave",
    minInteriorWidth: FIRE_MIN_INTERIOR_WIDTH,
    minInteriorHeight: FIRE_MIN_INTERIOR_HEIGHT,
    description:
      "A basalt bridge over a lava stream, a darkening crack, and a stepped amphitheatre facing three fire-pit stations across a lava fissure.",
    roomPresentation: { suppressTileGeometry: true },
    walls: fireWalls,
    performers: firePerformers,
  },
  {
    id: "cave-earth",
    name: "The Canyon Overlook",
    material: "stone",
    theme: "cave",
    minInteriorWidth: EARTH_MIN_INTERIOR_WIDTH,
    minInteriorHeight: EARTH_MIN_INTERIOR_HEIGHT,
    description:
      "A grass gully opens onto the rim of a canyon. Three figures perform six metres below, on a floor there is no way down to; a fallen slab cantilevers over the drop and the shelves beyond recede into haze.",
    roomPresentation: { suppressTileGeometry: true },
    walls: earthWalls,
    performers: earthPerformers,
  },
  {
    id: "cave-air",
    name: "Air Chamber",
    material: "stone",
    theme: "cave",
    minInteriorWidth: AIR_MIN_INTERIOR_WIDTH,
    minInteriorHeight: AIR_MIN_INTERIOR_HEIGHT,
    description:
      "A tall shaft with an open floor and no stair. A column of rising air carries the visitor past three ledges — one pair at a time, each arriving at eye level — to an overlook nine metres up; a second, warmer column sets them back down beside the door on.",
    roomPresentation: { suppressTileGeometry: true },
    walls: airWalls,
    performers: airPerformers,
  },
  {
    id: "cave-sun",
    name: "Sun Chamber",
    material: "sandstone",
    theme: "cave",
    // Interior metres = ceil(minInterior * 1.5) * 0.5, NOT tiles. 43 -> 32.5 m
    // and 45 -> 34.0 m, which carries the 24 m chamber plus the north light
    // crack. Measure the compiled grid before trusting this comment; the Air
    // comment in this same file once read these as tiles and was out by 40%.
    minInteriorWidth: 43,
    minInteriorHeight: 45,
    description:
      "A round chamber whose sun is driven by where the visitor stands: bearing from the centre is azimuth, distance from it is elevation. A spiral crossing sweeps a quarter of the compass on the way to a zenith noon, and the ground itself lifts the visitor out through the ceiling onto the Moon.",
    roomPresentation: { suppressTileGeometry: true },
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
    to: "cave-water-gallery",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 3,
  },
  {
    from: "cave-water-gallery",
    to: "cave-water",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    // Matches the 6-tile doors at both ends so the surfacing stair runs
    // straight through into the grotto with no pinch.
    corridorWidth: 6,
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
    id: "cave-water-gallery",
    title: "The flooded gallery",
    description:
      "Thirty metres walked on the bottom of a rock-roofed gallery, with a bloom of cave life at the midpoint.",
    tone: "threshold",
  },
  {
    id: "cave-water",
    title: "The drowned gallery",
    description:
      "A surfacing stair breaks the water at the mirror pool; a ring of walkways passes three alcoves performing A, B, and C.",
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
    title: "The canyon overlook",
    description:
      "A grass gully turns once and opens on a canyon rim; three figures work six metres below, past a fallen slab, with no way down.",
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

/**
 * Routes an elevation/blocking query to the bay that owns the point. Outside
 * every bay the museum datum stands, which is what the tile-built rooms use.
 */
function composeCaveTerrain(
  bays: { bounds: WorldRect | undefined; program: MuseumTerrainProgram | null }[]
): MuseumTerrainProgram | null {
  const active = bays.filter(
    (bay): bay is { bounds: WorldRect; program: MuseumTerrainProgram } =>
      Boolean(bay.bounds && bay.program)
  );
  if (active.length === 0) return null;

  return {
    waterlineY: active[0]!.program.waterlineY,
    elevationAt(x, z) {
      for (const bay of active) {
        if (inRectClosed(bay.bounds, x, z)) return bay.program.elevationAt(x, z);
      }
      return 0;
    },
    blockedAt(x, z) {
      for (const bay of active) {
        if (inRectClosed(bay.bounds, x, z) && bay.program.blockedAt(x, z)) {
          return true;
        }
      }
      return false;
    },
    updraftAt(x, z, y) {
      for (const bay of active) {
        if (inRectClosed(bay.bounds, x, z)) {
          return bay.program.updraftAt?.(x, z, y) ?? 0;
        }
      }
      return 0;
    },
  };
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

  // Elevation + blocking for every authored bay in the cave. Physics reads it
  // for ground clamping; each graybox layer reads the same layout for its
  // meshes. Each program answers only inside its own bay, so a bay's loud
  // "no elevation zone" failure can never be swallowed by its neighbour.
  const terrain = composeCaveTerrain([
    {
      bounds: buildDrownedGalleryLayout(build.grid)?.bayBounds,
      program: createDrownedGalleryTerrain(build.grid),
    },
    {
      bounds: buildFirstFireLayout(build.grid)?.bayBounds,
      program: createFirstFireTerrain(build.grid),
    },
    {
      bounds: buildEarthCanyonLayout(build.grid)?.bayBounds,
      program: createEarthCanyonTerrain(build.grid),
    },
    {
      bounds: buildAirChimneyLayout(build.grid)?.bayBounds,
      program: createAirChimneyTerrain(build.grid),
    },
  ]);
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
