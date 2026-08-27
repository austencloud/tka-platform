/**
 * The First Fire — Vulcan Cave fire bay geometry.
 *
 * Same contract as the Drowned Gallery's terrain module: pure geometry that,
 * given the compiled cave grid, derives world-space elevation zones, blocked
 * regions and EVERY rect the graybox renders for the fire bay. The physics
 * provider consumes elevationAt/blockedAt; the graybox reads the same rect
 * lists; the floor plan's performer stations read the same anchors. One
 * geometry source — a rect the graybox draws that this module does not know
 * about is a bug by construction.
 *
 * Route, west → east: the grotto corridor drops onto an ember bridge over a
 * lava stream, a bent darkening crack kills the sightline behind it, and the
 * room opens into a three-terrace basalt amphitheatre facing three fire-pit
 * stations across a blocked lava fissure. A cold ash circle sits behind the
 * benches; the exit stair climbs east to the Earth door.
 *
 * There is not one absolute world coordinate in this file: every offset is
 * metres measured from a compiled room bound or a real door tile span.
 *
 * Design: docs/superpowers/specs/2026-08-04-first-fire-design.md
 */
import type {
  MuseumGrid,
  MuseumTerrainProgram,
} from "../domain/museum-grid-types";
import {
  TILE_METRES,
  WALL_THICKNESS,
  WATERLINE_Y,
  bandRects,
  doorSpan,
  inRectClosed,
  interiorWorldRect,
  spansExcluding,
  subtractTiles,
  tileCentredOffset,
  unionRect,
  widenSpan,
  type CeilingRect,
  type FloorRect,
  type Point2,
  type Span,
  type WallRect,
  type WorldRect,
} from "./drowned-gallery-terrain";

const TILE = TILE_METRES;
/** See elevationAt: how far tile rounding lets the player drift past a rect edge. */
const TILE_ROUNDING_SLOP = TILE / 2;


export const FIRE_ROOM_ID = "cave-fire";
export const GROTTO_ROOM_ID = "cave-water";

// ── Datums (metres; museum floor = 0) ───────────────────────────────────────

/** Entry, bridge and crack head — matches the grotto's walkway datum. */
export const BRIDGE_Y = -0.3;
/** Bench terraces, south (highest) → north (lowest). */
export const TERRACE_Y = [-0.8, -1.3, -1.8] as const;
/** The performers' shore, north of the fissure. Blocked; never walked. */
export const SHORE_Y = -1.3;
/** Visual bed of the lava fissure — THE barrier between benches and shore. */
export const FISSURE_BED_Y = -3.5;
/** Visual bed of the lava stream the ember bridge crosses. */
export const LAVA_BED_Y = -2.0;
/** Corridor and both doors sit on the museum datum. */
export const DOOR_Y = 0;
export const CAVE_CEILING_Y = 7.0;
export const CORRIDOR_CEILING_Y = 2.6;

// ── Programme metrics (metres; a corridor width does not scale with a room) ──

/** Ramp from the corridor datum down onto the bridge. */
const APPROACH_RUN = 2.0;
const BRIDGE_RUN = 8.0;
const BRIDGE_WIDTH = 3.0;
/** Depth of the lava stream band on each side of the bridge. */
const LAVA_DEPTH = 4.0;
const CRACK_WIDTH = 2.5;
/** Each of the crack's three legs: west ramp, bend, east ramp. */
const CRACK_LEG = 2.5;
const SHORE_DEPTH = 4.0;
const FISSURE_DEPTH = 4.0;
const TERRACE_DEPTH = 3.0;
/** Run of the ramped riser that joins one terrace to the next. */
const RISER_RUN = 1.0;
/** East–west run of the exit stair up to the Earth door. */
const EXIT_RUN = 3.0;
/** Half-width of the blocked ash circle on the top terrace. */
const ASH_HALF = 1.5;
/** Clear walking margin the ash circle keeps from the room's south edge. */
const ASH_SOUTH_MARGIN = 1.5;
/** Station anchors across the shore, west → east. */
const STATION_X_FRACTIONS = [0.2, 0.5, 0.8] as const;


export interface FirstFireLayout {
  /** Interior world rect of the fire chamber. */
  fire: WorldRect;
  /** Corridor tiles between the grotto's east door and the fire west door. */
  corridor: WorldRect[];

  /** Ramp from the corridor datum onto the bridge. */
  approachRamp: WorldRect;
  bridge: WorldRect;
  /** Blocked lava bands flanking the bridge, north then south. */
  lavaStream: WorldRect[];

  crackWest: WorldRect;
  crackBend: WorldRect;
  crackEast: WorldRect;

  amphitheatre: WorldRect;
  /** Flat bench terraces, south (−0.8) → north (−1.8). */
  terraces: WorldRect[];
  /** Ramped risers joining terrace n to terrace n+1. */
  terraceRisers: WorldRect[];
  /** Blocked disc of cold ash on the top terrace, south-centre. */
  ashCircle: WorldRect;
  /** Blocked 4 m lava fissure — the pool rule made literal. */
  fissure: WorldRect;
  /** Blocked performers' shore north of the fissure. */
  shore: WorldRect;
  /** Ramp east from the top terrace up to the Earth door. */
  exitStair: WorldRect;
  /** Fire-pit station anchors on the shore, west → east. */
  stations: Point2[];

  /** Every interior tile that is neither floor, water nor stair. */
  rockFill: WorldRect[];

  floorRects: FloorRect[];
  wallRects: WallRect[];
  ceilingRects: CeilingRect[];

  /** Union bbox of the fire bay. elevationAt throws inside it when nothing matches. */
  bayBounds: WorldRect;

  probes: {
    bridge: Point2;
    crack: Point2;
    terraces: Point2[];
    exitStair: Point2;
    ash: Point2;
    fissure: Point2;
    shore: Point2;
    lava: Point2;
    /** A point inside the rock fill — no floor covers it. */
    rock: Point2;
  };
}


/**
 * Station offsets in metres from the fire chamber's interior minimum corner.
 * The floor plan's performer entries and this module's layout anchors are the
 * SAME expression, so a performer can never drift off the fire pit rendered
 * under it. `interiorWidth` is the chamber's interior width in metres.
 */
export function firstFireStationOffsets(
  interiorWidth: number
): { xMetres: number; zMetres: number }[] {
  const amphiMin = amphitheatreMinOffset();
  const amphiWidth = interiorWidth - EXIT_RUN - amphiMin;
  return STATION_X_FRACTIONS.map((fraction) => ({
    xMetres: amphiMin + amphiWidth * fraction,
    zMetres: SHORE_DEPTH / 2,
  }));
}

/** Metres from the interior's west edge to the amphitheatre's west edge. */
function amphitheatreMinOffset(): number {
  return APPROACH_RUN + BRIDGE_RUN + CRACK_LEG * 3;
}


const cx = (r: WorldRect) => (r.minX + r.maxX) / 2;
const cz = (r: WorldRect) => (r.minZ + r.maxZ) / 2;
const centre = (r: WorldRect): Point2 => ({ x: cx(r), z: cz(r) });
const area = (r: WorldRect) => (r.maxX - r.minX) * (r.maxZ - r.minZ);

/** Half-open containment — used for blocking, matching the Water module. */
function inRectHalfOpen(r: WorldRect, x: number, z: number): boolean {
  return x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ;
}

/** Centre a span of `width` on `centreValue`, clamped inside `[lo, hi]`. */
function spanAround(
  centreValue: number,
  width: number,
  lo: number,
  hi: number
): Span {
  let min = centreValue - width / 2;
  let max = centreValue + width / 2;
  if (min < lo) {
    max += lo - min;
    min = lo;
  }
  if (max > hi) {
    min -= max - hi;
    max = hi;
  }
  return { min, max };
}


export function buildFirstFireLayout(grid: MuseumGrid): FirstFireLayout | null {
  const fireWing = grid.wings.find((w) => w.id === FIRE_ROOM_ID);
  const grottoWing = grid.wings.find((w) => w.id === GROTTO_ROOM_ID);
  if (!fireWing || !grottoWing) return null;

  const fire = interiorWorldRect(fireWing.bounds);
  const westDoor = doorSpan(grid, FIRE_ROOM_ID, "west");
  const eastDoor = doorSpan(grid, FIRE_ROOM_ID, "east");
  if (!westDoor || !eastDoor) {
    throw new Error(
      "First Fire layout: a door on the fire route is missing from the compiled grid"
    );
  }

  // ── Z programme, north → south. The last band takes the remainder, so the
  // room can be resized without any band silently overrunning the interior.
  // The shore and the fissure belong to the amphitheatre half of the room;
  // west of it the crossing runs through solid rock.
  const amphiMinX = fire.minX + amphitheatreMinOffset();
  const shore: WorldRect = {
    minX: amphiMinX,
    maxX: fire.maxX,
    minZ: fire.minZ,
    maxZ: fire.minZ + SHORE_DEPTH,
  };
  const fissure: WorldRect = {
    minX: amphiMinX,
    maxX: fire.maxX,
    minZ: shore.maxZ,
    maxZ: shore.maxZ + FISSURE_DEPTH,
  };
  const terraceBandMinZ = [
    fissure.maxZ + TERRACE_DEPTH * 2, // top terrace (−0.8), southernmost
    fissure.maxZ + TERRACE_DEPTH, // middle (−1.3)
    fissure.maxZ, // lowest (−1.8), against the fissure
  ];
  const terraceBandMaxZ = [
    fire.maxZ,
    fissure.maxZ + TERRACE_DEPTH * 2,
    fissure.maxZ + TERRACE_DEPTH,
  ];
  if (terraceBandMinZ[0]! + RISER_RUN >= fire.maxZ) {
    throw new Error(
      "First Fire layout: the fire chamber is too shallow for its shore, fissure and three terraces"
    );
  }

  // ── X programme, west → east.
  const bridgeZ = spanAround(
    (westDoor.min + westDoor.max) / 2,
    BRIDGE_WIDTH,
    fire.minZ,
    fire.maxZ
  );
  const approachRamp: WorldRect = {
    minX: fire.minX,
    maxX: fire.minX + APPROACH_RUN,
    minZ: bridgeZ.min,
    maxZ: bridgeZ.max,
  };
  const bridge: WorldRect = {
    minX: approachRamp.maxX,
    maxX: approachRamp.maxX + BRIDGE_RUN,
    minZ: bridgeZ.min,
    maxZ: bridgeZ.max,
  };
  const lavaStream: WorldRect[] = [
    {
      minX: bridge.minX,
      maxX: bridge.maxX,
      minZ: Math.max(fire.minZ, bridge.minZ - LAVA_DEPTH),
      maxZ: bridge.minZ,
    },
    {
      minX: bridge.minX,
      maxX: bridge.maxX,
      minZ: bridge.maxZ,
      maxZ: Math.min(fire.maxZ, bridge.maxZ + LAVA_DEPTH),
    },
  ].filter((r) => r.maxZ - r.minZ > 0.01);

  // The crack bends once, from the bridge axis onto the top terrace, which is
  // what kills the sightline back to the grotto.
  const crackWestZ = spanAround(
    cz(bridge),
    CRACK_WIDTH,
    fire.minZ,
    fire.maxZ
  );
  const topTerraceCentreZ =
    (terraceBandMinZ[0]! + RISER_RUN + terraceBandMaxZ[0]!) / 2;
  const crackEastZ = spanAround(
    topTerraceCentreZ,
    CRACK_WIDTH,
    terraceBandMinZ[0]! + RISER_RUN,
    fire.maxZ
  );
  const crackWest: WorldRect = {
    minX: bridge.maxX,
    maxX: bridge.maxX + CRACK_LEG,
    minZ: crackWestZ.min,
    maxZ: crackWestZ.max,
  };
  const crackBend: WorldRect = {
    minX: crackWest.maxX,
    maxX: crackWest.maxX + CRACK_LEG,
    minZ: Math.min(crackWestZ.min, crackEastZ.min),
    maxZ: Math.max(crackWestZ.max, crackEastZ.max),
  };
  const crackEast: WorldRect = {
    minX: crackBend.maxX,
    maxX: crackBend.maxX + CRACK_LEG,
    minZ: crackEastZ.min,
    maxZ: crackEastZ.max,
  };
  const crackMidY = (BRIDGE_Y + TERRACE_Y[0]!) / 2;

  if (Math.abs(crackEast.maxX - amphiMinX) > 1e-9) {
    throw new Error(
      "First Fire layout: the crossing's run and the amphitheatre's west edge have drifted apart"
    );
  }
  const amphitheatre: WorldRect = {
    minX: crackEast.maxX,
    maxX: fire.maxX - EXIT_RUN,
    minZ: fissure.maxZ,
    maxZ: fire.maxZ,
  };
  if (amphitheatre.maxX - amphitheatre.minX < 8) {
    throw new Error(
      "First Fire layout: the crossing and the crack have eaten the amphitheatre — widen cave-fire"
    );
  }

  // Each terrace is a flat bench with a ramped riser along its NORTH edge,
  // dropping to the terrace in front of it. Ramps rather than steps keep every
  // neighbouring pair of walkable tiles inside the 0.6 m sweep, so the whole
  // amphitheatre is walkable from any bench.
  const terraces: WorldRect[] = [];
  const terraceRisers: WorldRect[] = [];
  for (let i = 0; i < 3; i++) {
    const bandMinZ = terraceBandMinZ[i]!;
    const bandMaxZ = terraceBandMaxZ[i]!;
    // The lowest terrace fronts the fissure, so it has nothing to step down to.
    const riserRun = i === 2 ? 0 : RISER_RUN;
    if (riserRun > 0) {
      terraceRisers.push({
        minX: amphitheatre.minX,
        maxX: amphitheatre.maxX,
        minZ: bandMinZ,
        maxZ: bandMinZ + riserRun,
      });
    }
    terraces.push({
      minX: amphitheatre.minX,
      maxX: amphitheatre.maxX,
      minZ: bandMinZ + riserRun,
      maxZ: bandMaxZ,
    });
  }

  const ashCircle: WorldRect = {
    minX: cx(amphitheatre) - ASH_HALF,
    maxX: cx(amphitheatre) + ASH_HALF,
    minZ: fire.maxZ - ASH_SOUTH_MARGIN - ASH_HALF * 2,
    maxZ: fire.maxZ - ASH_SOUTH_MARGIN,
  };

  // The exit stair lands on whichever terrace the compiled east door faces.
  // It must be a walkable one — a door onto the fissure or the shore would
  // strand the room, so say so loudly rather than shipping a dead end.
  const exitZ = widenSpan(eastDoor, 2.5, fire.minZ, fire.maxZ);
  const exitCentreZ = (exitZ.min + exitZ.max) / 2;
  const exitTerrace = terraces.findIndex(
    (t) => exitCentreZ >= t.minZ && exitCentreZ <= t.maxZ
  );
  if (exitTerrace < 0) {
    throw new Error(
      `First Fire layout: the Earth door at z=${exitCentreZ.toFixed(2)} does not open onto a bench terrace`
    );
  }
  const exitStair: WorldRect = {
    minX: fire.maxX - EXIT_RUN,
    maxX: fire.maxX,
    minZ: Math.max(exitZ.min, terraces[exitTerrace]!.minZ),
    maxZ: Math.min(exitZ.max, terraces[exitTerrace]!.maxZ),
  };

  // ── Station anchors: snapped to tile centres so the compiled performer
  // stations land on exactly the same point (see the floor plan).
  const interiorWidth = fire.maxX - fire.minX;
  const stations: Point2[] = firstFireStationOffsets(interiorWidth).map((offset) => ({
    x: fire.minX + tileCentredOffset(offset.xMetres),
    z: fire.minZ + tileCentredOffset(offset.zMetres),
  }));

  // ── Corridor from the grotto. Both wings suppress their tile geometry, so
  // the corridor between them is suppressed too and this module owns it.
  const gb = grottoWing.bounds;
  const fb = fireWing.bounds;
  const corridorTyMin = Math.min(gb.y, fb.y) - 2;
  const corridorTyMax = Math.max(gb.y + gb.height, fb.y + fb.height) + 2;
  const corridor = bandRects(
    grid,
    gb.x + gb.width - 1,
    fb.x,
    corridorTyMin,
    corridorTyMax,
    (t) => t === "corridor" || t === "door"
  );
  const corridorWalls = bandRects(
    grid,
    gb.x + gb.width,
    fb.x - 1,
    corridorTyMin,
    corridorTyMax,
    (t) => t === "wall"
  );

  // ── Rock fill: every interior tile the programme does not use.
  const carved = [
    approachRamp,
    bridge,
    ...lavaStream,
    crackWest,
    crackBend,
    crackEast,
    ...terraces,
    ...terraceRisers,
    fissure,
    shore,
    exitStair,
  ];
  const rockFill = subtractTiles(fire, carved);

  // ── Floor rects: the single list physics and the graybox both read ────────
  const floorRects: FloorRect[] = [
    ...corridor.map((rect, i) => ({
      id: `fire-corridor-${i}`,
      rect,
      kind: "flat" as const,
      fromY: DOOR_Y,
      toY: DOOR_Y,
    })),
    {
      id: "approach-ramp",
      rect: approachRamp,
      kind: "ramp-x",
      fromY: DOOR_Y,
      toY: BRIDGE_Y,
    },
    { id: "bridge", rect: bridge, kind: "flat", fromY: BRIDGE_Y, toY: BRIDGE_Y },
    {
      id: "crack-west",
      rect: crackWest,
      kind: "ramp-x",
      fromY: BRIDGE_Y,
      toY: crackMidY,
    },
    {
      id: "crack-bend",
      rect: crackBend,
      kind: "flat",
      fromY: crackMidY,
      toY: crackMidY,
    },
    {
      id: "crack-east",
      rect: crackEast,
      kind: "ramp-x",
      fromY: crackMidY,
      toY: TERRACE_Y[0]!,
    },
    ...terraces.map((rect, i) => ({
      id: `terrace-${i}`,
      rect,
      kind: "flat" as const,
      fromY: TERRACE_Y[i]!,
      toY: TERRACE_Y[i]!,
    })),
    ...terraceRisers.map((rect, i) => ({
      id: `terrace-riser-${i}`,
      rect,
      kind: "ramp-z" as const,
      // North edge is the lower terrace, south edge is the bench above it.
      fromY: TERRACE_Y[i + 1]!,
      toY: TERRACE_Y[i]!,
    })),
    {
      id: "exit-stair",
      rect: exitStair,
      kind: "ramp-x",
      fromY: TERRACE_Y[exitTerrace]!,
      toY: DOOR_Y,
    },
    // Blocked beds: rendered, never walked.
    { id: "shore", rect: shore, kind: "flat", fromY: SHORE_Y, toY: SHORE_Y },
    {
      id: "fissure-bed",
      rect: fissure,
      kind: "flat",
      fromY: FISSURE_BED_Y,
      toY: FISSURE_BED_Y,
    },
    ...lavaStream.map((rect, i) => ({
      id: `lava-bed-${i}`,
      rect,
      kind: "flat" as const,
      fromY: LAVA_BED_Y,
      toY: LAVA_BED_Y,
    })),
  ];

  // ── Wall rects: envelope with gaps derived from real door tiles ───────────
  const baseY = FISSURE_BED_Y - 0.5;
  const wallRects: WallRect[] = [];
  const pushWall = (id: string, rect: WorldRect, top: number) => {
    if (rect.maxX - rect.minX > 0.01 && rect.maxZ - rect.minZ > 0.01) {
      wallRects.push({ id, rect, baseY, topY: top });
    }
  };

  pushWall(
    "fire-north",
    {
      minX: fire.minX - WALL_THICKNESS,
      maxX: fire.maxX + WALL_THICKNESS,
      minZ: fire.minZ - WALL_THICKNESS,
      maxZ: fire.minZ,
    },
    CAVE_CEILING_Y
  );
  pushWall(
    "fire-south",
    {
      minX: fire.minX - WALL_THICKNESS,
      maxX: fire.maxX + WALL_THICKNESS,
      minZ: fire.maxZ,
      maxZ: fire.maxZ + WALL_THICKNESS,
    },
    CAVE_CEILING_Y
  );
  for (const [z0, z1] of spansExcluding(fire.minZ, fire.maxZ, [westDoor])) {
    pushWall(
      `fire-west-${z0.toFixed(2)}`,
      {
        minX: fire.minX - WALL_THICKNESS,
        maxX: fire.minX,
        minZ: z0,
        maxZ: z1,
      },
      CAVE_CEILING_Y
    );
  }
  for (const [z0, z1] of spansExcluding(fire.minZ, fire.maxZ, [eastDoor])) {
    pushWall(
      `fire-east-${z0.toFixed(2)}`,
      {
        minX: fire.maxX,
        maxX: fire.maxX + WALL_THICKNESS,
        minZ: z0,
        maxZ: z1,
      },
      CAVE_CEILING_Y
    );
  }
  corridorWalls.forEach((rect, i) =>
    pushWall(`fire-corridor-wall-${i}`, rect, CORRIDOR_CEILING_Y)
  );

  const ceilingRects: CeilingRect[] = [
    { id: "fire-ceiling", rect: fire, y: CAVE_CEILING_Y },
    ...corridor.map((rect, i) => ({
      id: `fire-corridor-ceiling-${i}`,
      rect,
      y: CORRIDOR_CEILING_Y,
    })),
  ];

  const bayBounds = unionRect([fire, ...corridor]);
  const rockProbe = rockFill.length
    ? rockFill.reduce((widest, r) => (area(r) > area(widest) ? r : widest))
    : fire;

  return {
    fire,
    corridor,
    approachRamp,
    bridge,
    lavaStream,
    crackWest,
    crackBend,
    crackEast,
    amphitheatre,
    terraces,
    terraceRisers,
    ashCircle,
    fissure,
    shore,
    exitStair,
    stations,
    rockFill,
    floorRects,
    wallRects,
    ceilingRects,
    bayBounds,
    probes: {
      bridge: centre(bridge),
      crack: centre(crackBend),
      // West of centre, so the probe reads open bench rather than the ash
      // circle that sits on the top terrace's centre line.
      terraces: terraces.map((rect) => ({
        x: rect.minX + (rect.maxX - rect.minX) * 0.25,
        z: cz(rect),
      })),
      exitStair: centre(exitStair),
      ash: centre(ashCircle),
      fissure: centre(fissure),
      shore: centre(shore),
      lava: centre(lavaStream[0] ?? fissure),
      rock: centre(rockProbe),
    },
  };
}

// ── Terrain program ─────────────────────────────────────────────────────────

export function createFirstFireTerrain(
  grid: MuseumGrid
): MuseumTerrainProgram | null {
  const layout = buildFirstFireLayout(grid);
  if (!layout) return null;

  const { floorRects, bayBounds } = layout;
  const blocked: WorldRect[] = [
    layout.shore,
    layout.fissure,
    ...layout.lavaStream,
    layout.ashCircle,
    ...layout.rockFill,
  ];

  const heightOn = (floor: FloorRect, x: number, z: number): number => {
    if (floor.kind === "flat") return floor.fromY;
    const alongZ = floor.kind === "ramp-z";
    const min = alongZ ? floor.rect.minZ : floor.rect.minX;
    const max = alongZ ? floor.rect.maxZ : floor.rect.maxX;
    const v = alongZ ? z : x;
    const t =
      max === min ? 0 : Math.min(1, Math.max(0, (v - min) / (max - min)));
    return floor.fromY + (floor.toY - floor.fromY) * t;
  };

  return {
    waterlineY: WATERLINE_Y,
    elevationAt(x, z) {
      for (const floor of floorRects) {
        if (inRectClosed(floor.rect, x, z)) return heightOn(floor, x, z);
      }
      // Absorb exactly the quarter-tile the physics provider's Math.round
      // lookup can legally drift past a rect edge, and no more — a real hole
      // is wider than this and still throws.
      for (const floor of floorRects) {
        const grown: WorldRect = {
          minX: floor.rect.minX - TILE_ROUNDING_SLOP,
          maxX: floor.rect.maxX + TILE_ROUNDING_SLOP,
          minZ: floor.rect.minZ - TILE_ROUNDING_SLOP,
          maxZ: floor.rect.maxZ + TILE_ROUNDING_SLOP,
        };
        if (inRectClosed(grown, x, z)) return heightOn(floor, x, z);
      }
      if (import.meta.env.DEV && inRectClosed(bayBounds, x, z)) {
        throw new Error(
          `First Fire: no elevation zone covers (${x.toFixed(2)}, ${z.toFixed(2)}) ` +
            "inside the fire bay — the layout and the walkable grid disagree"
        );
      }
      return 0;
    },
    blockedAt(x, z) {
      for (const rect of blocked) if (inRectHalfOpen(rect, x, z)) return true;
      return false;
    },
  };
}
