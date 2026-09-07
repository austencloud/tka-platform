/**
 * The Root Terrace: the Earth wing (TOGETHER-SAME, cases G, H, I) as the
 * museum walks it, and the terrain program physics reads for it.
 *
 * One idea, from the sealed hallway architecture (2026-08-11): the visitor
 * climbs a terrace ABOVE the performers and never shares a floor with one.
 * The barrier is elevation. The plan is a single ribbon:
 *
 *   west door (0) → vestibule (0) → ramp climbing east (0 → 2.8)
 *   → terrace along the north wall (2.8), the rootbed 5.2 m below it on the
 *     right, G, H and I in a row on the bed, each passed in turn
 *   → corner, descent south along the east wall (2.8 → 1.2)
 *   → landing on the row's axis (1.2): the ensemble sightline, three unison
 *     figures aligned
 *   → descent (1.2 → 0) past a cleft where the floor falls away
 *   → south door (0) to Air.
 *
 * Everything off the ribbon is rock or the bed, and both are blocked: the
 * bed is 2.4 m below the museum datum and 5.2 m below the terrace, with no
 * way down. Both doors sit on the datum, so Fire's growth path arrives level
 * and the Air corridor's 0.6 m step rule holds at the south door.
 *
 * The Blender shell (scripts/build-earth-root-terrace-graybox.py and
 * -production.py) is carved from the SAME rects this module returns, via the
 * hash-stamped contract in earth-root-terrace-blender-contract.ts, so the
 * collider and the rock can never disagree about where an edge is.
 *
 * Like the other suppressed-tile bays, this module owns the corridor between
 * the Fire room and this one (both suppress their tile geometry). The
 * corridor on to Air belongs to air-chimney-layout.ts from the south door
 * row down.
 */
import type { MuseumGrid, MuseumTerrainProgram } from "../domain/museum-grid-types";
import {
  TILE_METRES,
  bandRects,
  doorSpan,
  inRectClosed,
  interiorWorldRect,
  unionRect,
  type FloorRect,
  type Point2,
  type Span,
  type WorldRect,
} from "./drowned-gallery-terrain";

export const EARTH_ROOM_ID = "cave-earth";
export const FIRE_ROOM_ID = "cave-fire";

// ── Datums (world Y, metres) ────────────────────────────────────────────────
/** Both doors: Fire's growth path arrives here and the Air corridor leaves here. */
export const DOOR_Y = 0;
/** The terrace deck: the overlook the whole room is built for. */
export const TERRACE_Y = 2.8;
/** The ensemble landing on the row's axis, half way down to the door. */
export const LANDING_Y = 1.2;
/** The rootbed the performers stand on. 5.2 m below the terrace, no way down. */
export const BED_Y = -2.4;
/** The cleft beside the exit: the floor falling away toward Air. */
export const CLEFT_Y = -6.5;
/** Vault crown over the rootbed. */
export const BED_CROWN_Y = 9.6;
/** Crown over the terrace and the east descent. */
export const TERRACE_CROWN_Y = 7.4;
/** Crown over the vestibule: a lower cave, so the terrace opens up out of it. */
export const VESTIBULE_CROWN_Y = 5.4;
/** Top of the daylight aven over the bed. */
export const AVEN_TOP_Y = 17.0;
export const AVEN_RADIUS = 3.2;
/** Brass rail height above the deck it stands on. */
export const RAIL_HEIGHT = 1.0;
/** Where the props circle above a performer's feet, for the sightline proofs. */
export const PROP_CENTRE_ABOVE_FEET = 1.35;
export const EYE_ABOVE_FLOOR = 1.6;

// ── Plan offsets from the room interior's north-west corner (metres) ────────
// The compiled interior is 34 by 24 m; every number below is an offset from
// its minimum X (west) and minimum Z (north), so the plan lands identically
// in the standalone cave grid and the whole-museum walk grid.
const VESTIBULE_RUN = 6; // west door to the ramp foot
const RAMP_RUN = 10; // 0 → 2.8 over 10 m: a 15.6° climb
const WALK_NORTH = 2; // rock behind the terrace, north of the deck
const WALK_WIDTH = 4; // terrace and ramp width
const VESTIBULE_NORTH = 2; // the vestibule shares the deck's north edge
const VESTIBULE_SOUTH = 16.5;
const EAST_RUN = 3.5; // width of the east route (x), against the east wall
const DESCENT_A_END = 12; // z offset where the first descent lands
const LANDING_DEPTH = 2.5;
const DESCENT_B_END = 20; // z offset where the second descent reaches the datum
const BED_WEST = 8;
const BED_EAST = 29.5;
const BED_NORTH = WALK_NORTH + WALK_WIDTH; // the bed starts under the terrace rail
const BED_SOUTH = 20;
const STATION_Z = 13; // the performers' row, 7 m south of the rail
const STATION_XS = [13, 20, 27] as const; // G, H, I west → east
const OPENER = { x: 4, z: 14.2 };
const CLEFT = { minX: 27.5, maxX: 29.7, minZ: 19.5, maxZ: 24 } as const;

export const EARTH_CASE_LETTERS = ["G", "H", "I"] as const;
export type EarthCaseLetter = (typeof EARTH_CASE_LETTERS)[number];

export interface EarthStation {
  letter: EarthCaseLetter;
  performerId: string;
  sequenceId: string;
  catalogId: string;
  /** Where the performer stands, in world metres (its pedestal's centre). */
  centre: Point2;
  /** The bed elevation the pedestal stands on. */
  floorY: number;
}

export interface EarthRootTerraceLayout {
  /** The room interior, wall tiles excluded. */
  earth: WorldRect;
  westDoor: Span;
  southDoor: Span;
  /** Corridor + door tiles between the Fire room and this one. */
  corridor: WorldRect[];
  /**
   * The walked ribbon, in query order: elevationAt takes the FIRST rect that
   * covers a point, so the flat decks are listed before the ramps that meet
   * them and every seam is answered by the deck side.
   */
  floorRects: FloorRect[];
  vestibule: WorldRect;
  ramp: WorldRect;
  terrace: WorldRect;
  descentA: WorldRect;
  landing: WorldRect;
  descentB: WorldRect;
  doorApproach: WorldRect;
  /** The rootbed: blocked, BED_Y, the performers' floor. */
  bed: WorldRect;
  /** The cleft beside the exit: blocked, CLEFT_Y. */
  cleft: WorldRect;
  /** The daylight shaft's centre, over the middle case. */
  avenCentre: Point2;
  stations: EarthStation[];
  /** The opener station's dais on the vestibule floor. */
  opener: { centre: Point2; floorY: number };
  /** The brass rail along every drop edge, RAIL_HEIGHT above the deck under it. */
  rail: Point2[];
  /** The ensemble sightline: where the visitor stands, and where they look. */
  ensemble: { eye: Point2; eyeY: number; target: Point2 };
  /** Rects the composed cave terrain routes queries by: the room plus its corridor. */
  bayFootprint: WorldRect[];
  bayBounds: WorldRect;
}

const CASE_BINDINGS: Record<EarthCaseLetter, { sequenceId: string; catalogId: string }> = {
  G: { sequenceId: "cave-earth-seq-g", catalogId: "tnd-tog-same-gggg" },
  H: { sequenceId: "cave-earth-seq-h", catalogId: "tnd-tog-same-hhhh" },
  I: { sequenceId: "cave-earth-seq-i", catalogId: "tnd-tog-same-iiii" },
};

/**
 * Station offsets from the interior's north-west corner, for the floor plan's
 * performer declarations (which are fractions of the compiled interior).
 */
export function earthRootTerraceStationOffsets(): { xMetres: number; zMetres: number }[] {
  return STATION_XS.map((x) => ({ xMetres: x, zMetres: STATION_Z }));
}

function rect(earth: WorldRect, x0: number, z0: number, x1: number, z1: number): WorldRect {
  return {
    minX: earth.minX + x0,
    maxX: earth.minX + x1,
    minZ: earth.minZ + z0,
    maxZ: earth.minZ + z1,
  };
}

export function buildEarthRootTerraceLayout(grid: MuseumGrid): EarthRootTerraceLayout | null {
  const earthWing = grid.wings.find((w) => w.id === EARTH_ROOM_ID);
  const fireWing = grid.wings.find((w) => w.id === FIRE_ROOM_ID);
  // Fire is optional. It is needed only to span the corridor between the two
  // wings, and the room picker can isolate cave-earth on its own - a grid with
  // no Fire room has no such corridor to own. Requiring it here returned null,
  // which left the component with a [0,0,0] origin: the shell mounted at the
  // world origin, far from the visitor, and the isolated room rendered black.
  if (!earthWing) return null;

  const earth = interiorWorldRect(earthWing.bounds);
  const westDoor = doorSpan(grid, EARTH_ROOM_ID, "west");
  const southDoor = doorSpan(grid, EARTH_ROOM_ID, "south");
  if (!westDoor || !southDoor) {
    throw new Error(
      "Root Terrace layout: a door on the earth route is missing from the compiled grid"
    );
  }
  const width = earth.maxX - earth.minX;
  const depth = earth.maxZ - earth.minZ;
  if (width < 34 - 1e-6 || depth < 24 - 1e-6) {
    throw new Error(
      `Root Terrace layout: the compiled interior is ${width.toFixed(1)} × ${depth.toFixed(1)} m; ` +
        "the plan needs 34 × 24 — widen cave-earth"
    );
  }
  // The plan is anchored on the doors the grid actually compiled: the
  // vestibule must contain the whole west door, and the east route the whole
  // south door, or the visitor steps off a door tile onto rock.
  const vestibule = rect(earth, 0, VESTIBULE_NORTH, VESTIBULE_RUN, VESTIBULE_SOUTH);
  if (westDoor.min < vestibule.minZ || westDoor.max > vestibule.maxZ) {
    throw new Error("Root Terrace layout: the west door lies outside the vestibule");
  }
  const eastMinX = earth.maxX - 0.5 - EAST_RUN;
  const eastMaxX = earth.maxX - 0.5;
  if (southDoor.min < eastMinX || southDoor.max > eastMaxX) {
    throw new Error("Root Terrace layout: the south door lies outside the east route");
  }

  const ramp = rect(
    earth,
    VESTIBULE_RUN,
    WALK_NORTH,
    VESTIBULE_RUN + RAMP_RUN,
    WALK_NORTH + WALK_WIDTH
  );
  const terrace: WorldRect = {
    minX: ramp.maxX,
    maxX: eastMaxX,
    minZ: ramp.minZ,
    maxZ: ramp.maxZ,
  };
  const descentA: WorldRect = {
    minX: eastMinX,
    maxX: eastMaxX,
    minZ: terrace.maxZ,
    maxZ: earth.minZ + DESCENT_A_END,
  };
  const landing: WorldRect = {
    minX: eastMinX,
    maxX: eastMaxX,
    minZ: descentA.maxZ,
    maxZ: descentA.maxZ + LANDING_DEPTH,
  };
  const descentB: WorldRect = {
    minX: eastMinX,
    maxX: eastMaxX,
    minZ: landing.maxZ,
    maxZ: earth.minZ + DESCENT_B_END,
  };
  const doorApproach: WorldRect = {
    minX: eastMinX,
    maxX: eastMaxX,
    minZ: descentB.maxZ,
    maxZ: earth.maxZ,
  };
  const bed = rect(earth, BED_WEST, BED_NORTH, BED_EAST, BED_SOUTH);
  const cleft = rect(earth, CLEFT.minX, CLEFT.minZ, CLEFT.maxX, CLEFT.maxZ);

  const floorRects: FloorRect[] = [
    { id: "vestibule", rect: vestibule, kind: "flat", fromY: DOOR_Y, toY: DOOR_Y },
    { id: "terrace", rect: terrace, kind: "flat", fromY: TERRACE_Y, toY: TERRACE_Y },
    { id: "landing", rect: landing, kind: "flat", fromY: LANDING_Y, toY: LANDING_Y },
    { id: "door-approach", rect: doorApproach, kind: "flat", fromY: DOOR_Y, toY: DOOR_Y },
    { id: "ramp", rect: ramp, kind: "ramp-x", fromY: DOOR_Y, toY: TERRACE_Y },
    { id: "descent-a", rect: descentA, kind: "ramp-z", fromY: TERRACE_Y, toY: LANDING_Y },
    { id: "descent-b", rect: descentB, kind: "ramp-z", fromY: LANDING_Y, toY: DOOR_Y },
  ];

  const stations: EarthStation[] = EARTH_CASE_LETTERS.map((letter, index) => ({
    letter,
    performerId: `cave-earth-automaton-${letter.toLowerCase()}`,
    ...CASE_BINDINGS[letter],
    centre: { x: earth.minX + STATION_XS[index]!, z: earth.minZ + STATION_Z },
    floorY: BED_Y,
  }));
  for (const station of stations) {
    if (!inRectClosed(bed, station.centre.x, station.centre.z)) {
      throw new Error(`Root Terrace layout: case ${station.letter} stands off the bed`);
    }
  }
  const middle = stations[1]!;
  const avenCentre = { x: middle.centre.x, z: middle.centre.z };

  // The rail runs the whole drop edge: the ramp and terrace's south edge over
  // the bed, then down the east route's west edge past the bed and the cleft.
  const rail: Point2[] = [
    { x: bed.minX, z: bed.minZ },
    { x: eastMinX, z: bed.minZ },
    { x: eastMinX, z: earth.maxZ - 0.5 },
  ];

  // Half a metre from the rail line, which is where a person stops at a
  // railing. It is not a stylistic choice: a rail casts a shadow outward
  // across whatever is below it, and the further back the eye, the more of
  // the bed it hides. From the landing's centre the near case is entirely
  // behind the brass and the sightline crosses the bar at eye level. From
  // here the bar sits under the sightline, where a railing belongs, and the
  // three cases nest away down the axis: one shape at three scales.
  const ensembleEye = { x: landing.minX + 0.5, z: earth.minZ + STATION_Z };
  if (!inRectClosed(landing, ensembleEye.x, ensembleEye.z)) {
    throw new Error("Root Terrace layout: the ensemble landing is off the row's axis");
  }

  // ── Corridor from the First Fire. Both wings suppress their tile geometry,
  // so the corridor between them is suppressed too and this module owns it.
  const eb = earthWing.bounds;
  const corridor = fireWing
    ? bandRects(
        grid,
        fireWing.bounds.x + fireWing.bounds.width - 1,
        eb.x,
        Math.min(fireWing.bounds.y, eb.y) - 2,
        Math.max(
          fireWing.bounds.y + fireWing.bounds.height,
          eb.y + eb.height
        ) + 2,
        (t) => t === "corridor" || t === "door"
      )
    : [];

  // The footprint is the INTERIOR plus the corridor. The south wall row is the
  // Air corridor's first row and Air answers for it (cave-terrain-routing).
  const bayFootprint = [earth, ...corridor];
  return {
    earth,
    westDoor,
    southDoor,
    corridor,
    floorRects,
    vestibule,
    ramp,
    terrace,
    descentA,
    landing,
    descentB,
    doorApproach,
    bed,
    cleft,
    avenCentre,
    stations,
    opener: {
      centre: { x: earth.minX + OPENER.x, z: earth.minZ + OPENER.z },
      floorY: DOOR_Y,
    },
    rail,
    ensemble: {
      eye: ensembleEye,
      eyeY: LANDING_Y + EYE_ABOVE_FLOOR,
      target: { x: stations[0]!.centre.x, z: stations[0]!.centre.z },
    },
    bayFootprint,
    bayBounds: unionRect(bayFootprint),
  };
}

/** Elevation on one floor rect, interpolated along a ramp's axis. */
export function heightOnFloor(floor: FloorRect, x: number, z: number): number {
  if (floor.kind === "flat") return floor.fromY;
  const alongZ = floor.kind === "ramp-z";
  const min = alongZ ? floor.rect.minZ : floor.rect.minX;
  const max = alongZ ? floor.rect.maxZ : floor.rect.maxX;
  const v = alongZ ? z : x;
  const t = max === min ? 0 : Math.min(1, Math.max(0, (v - min) / (max - min)));
  return floor.fromY + (floor.toY - floor.fromY) * t;
}

/**
 * A tile-centre probe can legally sit a quarter tile past a rect edge (the
 * door tiles in the wall rows do); the elevation query answers those from the
 * nearest deck. The BLOCKING query never grows: the deck edge is the edge.
 */
const TILE_ROUNDING_SLOP = TILE_METRES / 2;

function grown(r: WorldRect, by: number): WorldRect {
  return { minX: r.minX - by, maxX: r.maxX + by, minZ: r.minZ - by, maxZ: r.maxZ + by };
}

/** Elevation of the ribbon at a point, or null when the point is off it. */
export function ribbonElevationAt(
  layout: EarthRootTerraceLayout,
  x: number,
  z: number,
  slop = 0
): number | null {
  for (const floor of layout.floorRects) {
    if (inRectClosed(floor.rect, x, z)) return heightOnFloor(floor, x, z);
  }
  if (slop > 0) {
    for (const floor of layout.floorRects) {
      if (inRectClosed(grown(floor.rect, slop), x, z)) return heightOnFloor(floor, x, z);
    }
  }
  return null;
}

export function createEarthRootTerraceTerrain(grid: MuseumGrid): MuseumTerrainProgram | null {
  const layout = buildEarthRootTerraceLayout(grid);
  if (!layout) return null;
  const { earth, bed, cleft } = layout;
  return {
    waterlineY: -Infinity,
    elevationAt(x, z) {
      const onRibbon = ribbonElevationAt(layout, x, z, TILE_ROUNDING_SLOP);
      if (onRibbon !== null) return onRibbon;
      // Off the ribbon nothing is walkable, but the query must still answer:
      // the cleft and the bed at their own floors, everything else (the rock,
      // and the corridor outside the interior) at the datum.
      if (inRectClosed(cleft, x, z)) return CLEFT_Y;
      if (inRectClosed(bed, x, z)) return BED_Y;
      return DOOR_Y;
    },
    blockedAt(x, z) {
      // Only the room's interior is authored; the corridor from the Fire room
      // and the door tiles are museum circulation and always open.
      if (!inRectClosed(earth, x, z)) return false;
      return ribbonElevationAt(layout, x, z) === null;
    },
  };
}
