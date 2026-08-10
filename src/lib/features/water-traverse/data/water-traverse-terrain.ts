/**
 * The Water Traverse — terrain program.
 *
 * Pure geometry for one forward-only walk through water in three states. No
 * Three.js, no Rapier: this module owns every rect, and the collider layer and
 * the visual layer both read it. A rect the scene draws that this file does not
 * know about is a bug by construction.
 *
 * Design: docs/superpowers/specs/active/2026-08-09-water-traverse-design.md
 *
 * ── The one idea ───────────────────────────────────────────────────────────
 *
 * THE WATERLINE NEVER MOVES. It is y = 0 from the first step to the last.
 *
 * The visitor's relationship to it is the entire piece:
 *
 *   snowfield   they walk ON it   — the frozen river IS the surface, at y = 0
 *   sea         they walk UNDER it — the floor drops away; y = 0 is the ceiling
 *   hot spring  they stand IN it   — the floor rises back to waist-deep
 *
 * One plane, three sides of it. Nothing has to explain the transformation
 * because the visitor is inside the diagram the whole time.
 *
 * ── Direction ──────────────────────────────────────────────────────────────
 *
 * The walk runs along +Z, from z = 0 to z = TOTAL_LENGTH_M. The watercourse is
 * centred on x = 0 for its whole length and is the only wayfinding the visitor
 * gets: no signage, no objective marker, no choice of route. Follow the water.
 */

import { buildSeabedMesh, type SeabedMesh } from "./water-traverse-seabed";

// ── Types ───────────────────────────────────────────────────────────────────

export interface WorldRect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export type FloorKind = "flat" | "ramp-z";

export interface FloorRect {
  id: string;
  rect: WorldRect;
  kind: FloorKind;
  /** Elevation at minZ. */
  fromY: number;
  /** Elevation at maxZ. Equal to fromY when kind is "flat". */
  toY: number;
}

export interface WallRect {
  id: string;
  rect: WorldRect;
  baseY: number;
  topY: number;
}

/** Which state of water a surface is rendering. */
export type WaterState = "ice" | "sea" | "spring";

export interface WaterPlane extends WorldRect {
  id: string;
  surfaceY: number;
  state: WaterState;
  /** True when the visitor is beneath this plane and sees its underside. */
  seenFromBelow: boolean;
}

export type Leg = "snowfield" | "sea" | "spring";

export interface PerformerAnchor {
  id: string;
  leg: Leg;
  letter: "A" | "B" | "C";
  /** Effect registry id. */
  effectId: string;
  x: number;
  z: number;
  /** Standing surface elevation for this anchor. */
  y: number;
  /** Radians. Faces back down the route, so the visitor meets their front. */
  facingAngle: number;
}

export interface WaterTraverseLayout {
  bounds: WorldRect;
  floorRects: FloorRect[];
  /**
   * The sculpted seabed, as one static triangle soup.
   *
   * Kept out of `floorRects` on purpose: a rect is an axis-aligned flat or
   * ramped slab, and the whole point of the seabed is that it is neither. The
   * flat rects underneath it remain as the safety plane.
   */
  seabedMesh: SeabedMesh;
  wallRects: WallRect[];
  waterPlanes: WaterPlane[];
  performers: PerformerAnchor[];
  /** Centreline samples along the route, for path checks and camera aims. */
  route: { x: number; z: number; y: number }[];
  legs: Record<Leg, WorldRect>;
  /** Where the visitor's eye breaks the surface on the ascent. */
  surfaceBreak: { x: number; z: number; y: number };
  /** The steam column, visible from the snowfield across the whole route. */
  plume: { x: number; z: number; baseY: number; height: number };
  spawn: { x: number; y: number; z: number; yaw: number };
}

// ── Datums ──────────────────────────────────────────────────────────────────

/**
 * The waterline. Everything in this file is measured from it, and it is the
 * only elevation the visitor ever relates to.
 */
export const WATERLINE_Y = 0;

/**
 * Player eye above the floor they stand on: the controller's standing offset
 * (0.85) plus the first-person camera offset (0.75). Matches the museum's
 * EYE_ABOVE_FLOOR; the player capsule is the same one.
 */
export const EYE_ABOVE_FLOOR = 1.6;

/** Snow sits a little proud of the ice so the river reads as a cut ribbon. */
export const SNOW_Y = WATERLINE_Y + 0.28;
/** The sea floor. Deep enough that the surface overhead reads as a sky. */
export const SEA_FLOOR_Y = -18;
/**
 * The geothermal plain's floor. Waist-deep in the stream: the visitor stands
 * 0.9 m under the waterline, so the surface cuts them at the hip.
 */
export const SPRING_FLOOR_Y = WATERLINE_Y - 0.9;
/** Dry bank between the hot pools. */
export const SPRING_BANK_Y = WATERLINE_Y + 0.35;

/**
 * The landing where the ascent breaks the surface. DERIVED, not authored:
 * standing here puts the eye exactly on the waterline, so the visitor's head
 * comes out of the sea on a flat step rather than somewhere on a slope. This is
 * the moment the piece is built around; it does not get to land at an
 * arbitrary height.
 */
export const SURFACE_BREAK_Y = WATERLINE_Y - EYE_ABOVE_FLOOR;

// ── Plan ────────────────────────────────────────────────────────────────────

/**
 * Half-width of the walkable floor, per leg. Three landscapes have to be three
 * SHAPES, not one corridor with three palettes: the snowfield is a wide basin
 * you cross, the trench is a defile you are down inside, and the geothermal
 * plain opens out again. The narrowing at the descent is what makes the drop
 * feel like a gorge closing before it lets go.
 */
const SNOW_HALF_W = 48;
const SEA_HALF_W = 42;
const SPRING_HALF_W = 40;
/** Widest of the three; only used for whole-route bounds. */
const VALLEY_HALF_W = 48;
/** Ridge walls that contain the walk without ever being the subject. */
const RIDGE_THICKNESS = 6;
const SNOW_RIDGE_TOP = SNOW_Y + 30;
/**
 * The seabed ridges top out BELOW the waterline on purpose. Built to the same
 * 30 m as the snowfield's they made a roofed canyon: from the trench floor the
 * entire upper frame was unlit rock, the surface was never visible, and the
 * middle leg read as a slot you were trapped in rather than the floor of a
 * sea. Keeping them under the line means every upward glance down there ends
 * in open water and the light coming through it.
 */
const SEA_RIDGE_TOP = WATERLINE_Y - 3.5;
/** The gorge walls at the descent: high enough to funnel, too low to roof. */
const DESCENT_RIDGE_TOP = SNOW_Y + 9;

/** The watercourse: one ribbon, constant width, centred on x = 0 throughout. */
export const CHANNEL_HALF_W = 4.5;

/**
 * Leg lengths. The two flat legs were originally 118 m and 80 m, which walked
 * as 88 seconds of holding W for the whole route. The transitions are the
 * interesting parts and they keep their full run — the descent has to stay a
 * 40 m ramp or the grade turns into a cliff, and the ascent carries the
 * surface break — so the compression comes entirely out of the flats.
 */
const SNOW_START_Z = 0;
const SNOW_END_Z = 52;
const DESCENT_END_Z = 92;
const SEA_END_Z = 124;
const ASCENT_END_Z = 190;
const SPRING_END_Z = 244;

/**
 * The cave occupies the ascent's run exactly. Named separately because the
 * ascent is a FLOOR fact — two ramps and a landing — and the cave is a
 * containment fact, and after this change the two are authored by different
 * code even though they cover the same metres.
 */
const CAVE_START_Z = SEA_END_Z;
const CAVE_END_Z = ASCENT_END_Z;

export const TOTAL_LENGTH_M = SPRING_END_Z;

/**
 * ── Four spaces, not three ──────────────────────────────────────────────────
 *
 * The route used to climb down into the sea and climb straight back out into
 * an open geothermal plain. Walked as a graybox that read as three rooms in a
 * row, each bigger than the last, with no moment of compression anywhere and
 * 24 m of empty ground after the payoff.
 *
 * It now goes DOWN, INTO A CAVE, and the cave CLIMBS until it opens into an
 * underground canyon with the springs at the bottom of it:
 *
 *   snowfield   a basin you cross            wide, roofed, man-made
 *   sea         a hangar you are down inside vast, roofed, man-made
 *   cave        a flooded passage that climbs TIGHT and dark — the only
 *                                             compression in the walk
 *   canyon      where the heat comes out      vast again, and all rock
 *
 * The shape is big → big → SMALL → big. The cave is what makes the canyon
 * land: you cannot feel a room open up if you have not just been squeezed.
 *
 * The first two are still dioramas in a hall — you can see a ceiling and it is
 * man-made. From the cave mouth onward the ceiling is rock, because a cave
 * that admits it is a building is not a cave.
 */
export type Region = "snowfield" | "sea" | "cave" | "canyon";

/** The two spaces that are still a room in a museum. */
type HallRegion = "snowfield" | "sea";

/**
 * The volume steps up once per hall chamber. Ice is a train shed, the sea is a
 * hangar. Walking the first half is watching the room get bigger, which is the
 * argument for how much the Order spent on it.
 */
export const CHAMBER_CEILING: Record<HallRegion, number> = {
  snowfield: WATERLINE_Y + 34,
  sea: WATERLINE_Y + 52,
};
/**
 * Hall half-width per chamber. These sit OUTSIDE the ridge blocks, which reach
 * roughly 74 m at their deepest, so the peaks stand inside the room rather
 * than punching through its walls.
 */
export const CHAMBER_HALF_W: Record<HallRegion, number> = {
  snowfield: 78,
  sea: 92,
};
/** Chamber extents along Z. The seams are where the portals stand. */
const CHAMBER_Z: Record<HallRegion, [number, number]> = {
  snowfield: [SNOW_START_Z, SNOW_END_Z],
  sea: [SNOW_END_Z, CAVE_START_Z],
};

// ── The cave ────────────────────────────────────────────────────────────────

/**
 * The cave takes over the ascent's run. Its FLOOR is unchanged — the same two
 * ramps and the same landing, so the visitor's head still leaves the water at
 * z 165 on flat ground. What changes is everything around that floor: the
 * trench's far wall closes into a face with a hole at its foot, and the walk
 * spends 66 m inside rock instead of under open water.
 *
 * Surfacing inside a flooded passage is a better version of the same moment
 * than surfacing on an open ramp. It is the difference between a level change
 * and an event.
 */
const CAVE_SLICES = 6;
/**
 * Half-width at the mouth and at the canyon end. The passage doubles as it
 * climbs, so the release starts before the canyon does.
 *
 * The first attempt used 13 → 21, giving a passage 31 m wide and 13 m tall.
 * Walked, that is a road tunnel: at a 40 m sightline a 13 m roof sits only 18
 * degrees above the eye, which puts it in the top fifth of the frame where it
 * exerts no pressure at all. Tightness is an ANGLE, not a metre count — the
 * roof and walls have to be far enough into peripheral vision to be felt. At
 * 12 m across the channel itself is 9 of them, which is the right relationship
 * for a flooded slot: the water fills the passage and you wade up it.
 */
const CAVE_HALF_W_MOUTH = 6;
const CAVE_HALF_W_INNER = 12;
/**
 * Headroom at the mouth and at the canyon end, measured at each slice's HIGH
 * end so the number is the worst case in that slice rather than the best. Six
 * metres, under a hall that is seventy, is the squeeze the walk was missing.
 */
const CAVE_CLEARANCE_MOUTH = 6;
const CAVE_CLEARANCE_INNER = 12;
const ROCK_THICKNESS = 6;

// ── The canyon ──────────────────────────────────────────────────────────────

/**
 * Tall and comparatively narrow: 92 m across against 59 m of height, where the
 * spring hall it replaces was 224 across against 81. A canyon is a shape, and
 * the shape is the ratio — a room twice as wide as it is tall reads as a hall
 * no matter what the walls are made of.
 */
/**
 * The canyon's cross-section: 48 m across against 59 m of height.
 *
 * The first cut was 92 m across. Walked, its walls were 46 m out on each side
 * — off the edges of the frame — so the only thing visible from the mouth was
 * a floor and a distant end wall, and the room read as a hall. A canyon is not
 * a big room; it is a section TALLER THAN IT IS WIDE, and that only works if
 * both walls are in shot at once.
 */
const CANYON_HALF_W = 24;
const CANYON_ROOF_Y = WATERLINE_Y + 58;
/** How far the canyon runs past the point the walk stops, and how far it pinches. */
const CANYON_TAIL_LENGTH = 20;
const CANYON_TAIL_HALF_W = 9;
/**
 * The shaft: a collapse in the canyon roof over the springs. It is the only
 * opening in the room, which makes it the only light and the only way the
 * steam leaves — so the last thing the walk asks the visitor to do is look up.
 */
const SHAFT = { halfW: 8, minZ: 216, maxZ: 240 };
const HALL_THICKNESS = 3;
/** The lowest floor anywhere. Walls are built down to it so none of them float. */
const HALL_BASE_Y = SEA_FLOOR_Y - 2;

/**
 * A portal at a chamber seam: jambs either side and a lintel over the opening.
 *
 * This is the piece the earlier ceiling experiment was missing. Flat lids at
 * three heights read as floating plates because you saw the OUTSIDE of the next
 * room's roof. Through a portal you see the INSIDE of the next room, lit, with
 * its own ceiling above it — which is what makes the step in volume legible
 * instead of alarming.
 *
 * The openings are sized off the one sightline the piece cannot lose: the steam
 * plume at the far end, visible from the first step. The near opening only has
 * to clear the plume's lower third at that distance; the far one is an arch
 * nearly the full height of the sea hall.
 */
function buildPortal(
  id: string,
  z: number,
  halfWidth: number,
  ceilingY: number,
  openingHalfW: number,
  openingTopY: number
): WallRect[] {
  const minZ = z - HALL_THICKNESS / 2;
  const maxZ = z + HALL_THICKNESS / 2;
  return [
    {
      id: `portal-${id}-west`,
      rect: rect(-halfWidth, minZ, -openingHalfW, maxZ),
      baseY: HALL_BASE_Y,
      topY: ceilingY,
    },
    {
      id: `portal-${id}-east`,
      rect: rect(openingHalfW, minZ, halfWidth, maxZ),
      baseY: HALL_BASE_Y,
      topY: ceilingY,
    },
    {
      id: `portal-${id}-lintel`,
      rect: rect(-openingHalfW, minZ, openingHalfW, maxZ),
      baseY: openingTopY,
      topY: ceilingY,
    },
  ];
}

/** Side walls and ceiling for one hall chamber. */
function buildChamber(leg: HallRegion): WallRect[] {
  const [minZ, maxZ] = CHAMBER_Z[leg];
  const halfW = CHAMBER_HALF_W[leg];
  const ceilingY = CHAMBER_CEILING[leg];
  const walls: WallRect[] = [];

  for (const side of [-1, 1] as const) {
    walls.push({
      id: `hall-${leg}-${side < 0 ? "west" : "east"}`,
      rect: rect(
        side < 0 ? -halfW - HALL_THICKNESS : halfW,
        minZ,
        side < 0 ? -halfW : halfW + HALL_THICKNESS,
        maxZ
      ),
      baseY: HALL_BASE_Y,
      topY: ceilingY,
    });
  }

  walls.push({
    id: `hall-${leg}-ceiling`,
    rect: rect(-halfW, minZ, halfW, maxZ),
    baseY: ceilingY,
    topY: ceilingY + HALL_THICKNESS,
  });

  return walls;
}

/**
 * One slice of the cave tube.
 *
 * The passage is cut into slices rather than swept because a WallRect is an
 * axis-aligned box and the floor beneath it climbs at roughly 14 degrees. Six
 * stepped slices give a roof that follows the floor without a single one of
 * them lying about the clearance: each slice's roof is set from the floor at
 * its HIGH end, so the stated headroom is the tightest point in that slice and
 * every other point in it has more.
 */
function caveSlice(index: number): {
  minZ: number;
  maxZ: number;
  halfW: number;
  roofY: number;
} {
  const span = CAVE_END_Z - CAVE_START_Z;
  const t = index / CAVE_SLICES;
  const minZ = CAVE_START_Z + span * t;
  const maxZ = CAVE_START_Z + span * ((index + 1) / CAVE_SLICES);
  const clearance =
    CAVE_CLEARANCE_MOUTH + (CAVE_CLEARANCE_INNER - CAVE_CLEARANCE_MOUTH) * t;
  return {
    minZ,
    maxZ,
    halfW: caveHalfWAt(minZ),
    roofY: baseFloorYAt(maxZ) + clearance,
  };
}

/**
 * Half-width of the passage at world Z, as pure arithmetic.
 *
 * Split out from `caveSlice` because the FLOOR needs the passage width too and
 * cannot get it from there: `caveSlice` asks `baseFloorYAt` where the floor is,
 * so a floor that asked `caveSlice` how wide to be would define itself in a
 * circle. This function touches nothing but constants.
 *
 * It exists because the first cut of the cave left the ascent floor at the old
 * trench's 96 m width. Inside a passage 20 m across, that put 38 m of lit floor
 * on the far side of each wall — the walk read as open ground with some rocks
 * near the middle, which is the exact opposite of the compression the cave is
 * for.
 */
function caveHalfWAt(z: number): number {
  const t = (z - CAVE_START_Z) / (CAVE_END_Z - CAVE_START_Z);
  return (
    CAVE_HALF_W_MOUTH +
    (CAVE_HALF_W_INNER - CAVE_HALF_W_MOUTH) * Math.max(0, Math.min(1, t))
  );
}

/** The cave tube: rock either side and rock overhead, for 66 m. */
function buildCave(): WallRect[] {
  const walls: WallRect[] = [];

  for (let i = 0; i < CAVE_SLICES; i += 1) {
    const { minZ, maxZ, halfW, roofY } = caveSlice(i);
    // Half a metre of overlap into the next slice, so the stepped roof has no
    // seam a visitor can see daylight through.
    const farZ = maxZ + 0.5;

    for (const side of [-1, 1] as const) {
      walls.push({
        id: `cave-${side < 0 ? "west" : "east"}-${i}`,
        rect: rect(
          side < 0 ? -halfW - ROCK_THICKNESS : halfW,
          minZ,
          side < 0 ? -halfW : halfW + ROCK_THICKNESS,
          farZ
        ),
        baseY: HALL_BASE_Y,
        topY: roofY,
      });
    }

    walls.push({
      id: `cave-roof-${i}`,
      rect: rect(-halfW, minZ, halfW, farZ),
      baseY: roofY,
      topY: roofY + ROCK_THICKNESS,
    });
  }

  return walls;
}

/**
 * The canyon: two rock walls, an end wall, and a roof with a hole in it.
 *
 * Solid slabs rather than the broken ridge blocks the open legs use. A ridge
 * is a skyline seen against something beyond it; a canyon wall has nothing
 * beyond it, and gaps between blocks would show the hall the room is trying
 * not to be.
 */
function buildCanyon(): WallRect[] {
  const walls: WallRect[] = [];

  for (const side of [-1, 1] as const) {
    walls.push({
      id: `canyon-${side < 0 ? "west" : "east"}`,
      rect: rect(
        side < 0 ? -CANYON_HALF_W - ROCK_THICKNESS : CANYON_HALF_W,
        CAVE_END_Z,
        side < 0 ? -CANYON_HALF_W : CANYON_HALF_W + ROCK_THICKNESS,
        SPRING_END_Z
      ),
      baseY: HALL_BASE_Y,
      topY: CANYON_ROOF_Y,
    });
  }

  /**
   * The tail: the canyon keeps going after the visitor stops.
   *
   * It used to end at a flat slab across the full width at z 244. Stood at the
   * canyon mouth, that slab was half the frame — one unbroken face, 48 m out,
   * with nothing in front of it. It read as the back of a room, and a room is
   * the one thing this space must not be.
   *
   * So the walls converge past the springs instead and the cap sits 20 m
   * further on, small and deep in shadow. The route still ends at 244; the
   * SPACE does not, which is the whole difference between a canyon and a hall.
   */
  const TAIL_SLICES = 4;
  for (let i = 0; i < TAIL_SLICES; i += 1) {
    const minZ = SPRING_END_Z + (CANYON_TAIL_LENGTH * i) / TAIL_SLICES;
    const maxZ = SPRING_END_Z + (CANYON_TAIL_LENGTH * (i + 1)) / TAIL_SLICES;
    const halfW =
      CANYON_HALF_W +
      (CANYON_TAIL_HALF_W - CANYON_HALF_W) * ((i + 1) / TAIL_SLICES);
    for (const side of [-1, 1] as const) {
      walls.push({
        id: `canyon-tail-${side < 0 ? "west" : "east"}-${i}`,
        rect: rect(
          side < 0 ? -halfW - ROCK_THICKNESS : halfW,
          minZ,
          side < 0 ? -halfW : halfW + ROCK_THICKNESS,
          maxZ + 0.5
        ),
        baseY: HALL_BASE_Y,
        topY: CANYON_ROOF_Y,
      });
    }
    walls.push({
      id: `canyon-tail-roof-${i}`,
      rect: rect(-halfW, minZ, halfW, maxZ + 0.5),
      baseY: CANYON_ROOF_Y,
      topY: CANYON_ROOF_Y + ROCK_THICKNESS,
    });
  }

  walls.push({
    id: "canyon-head",
    rect: rect(
      -CANYON_TAIL_HALF_W,
      SPRING_END_Z + CANYON_TAIL_LENGTH,
      CANYON_TAIL_HALF_W,
      SPRING_END_Z + CANYON_TAIL_LENGTH + ROCK_THICKNESS
    ),
    baseY: HALL_BASE_Y,
    topY: CANYON_ROOF_Y,
  });

  // Roof in four slabs around the shaft.
  const roof = (id: string, r: WorldRect) =>
    walls.push({
      id: `canyon-roof-${id}`,
      rect: r,
      baseY: CANYON_ROOF_Y,
      topY: CANYON_ROOF_Y + ROCK_THICKNESS,
    });
  roof("near", rect(-CANYON_HALF_W, CAVE_END_Z, CANYON_HALF_W, SHAFT.minZ));
  roof("head", rect(-CANYON_HALF_W, SHAFT.maxZ, CANYON_HALF_W, SPRING_END_Z));
  roof("west", rect(-CANYON_HALF_W, SHAFT.minZ, -SHAFT.halfW, SHAFT.maxZ));
  roof("east", rect(SHAFT.halfW, SHAFT.minZ, CANYON_HALF_W, SHAFT.maxZ));

  return walls;
}

function rect(minX: number, minZ: number, maxX: number, maxZ: number): WorldRect {
  return { minX, minZ, maxX, maxZ };
}

function flat(id: string, r: WorldRect, y: number): FloorRect {
  return { id, rect: r, kind: "flat", fromY: y, toY: y };
}

function ramp(id: string, r: WorldRect, fromY: number, toY: number): FloorRect {
  return { id, rect: r, kind: "ramp-z", fromY, toY };
}

/**
 * The ascent is split at the surface-break landing so the visitor's head
 * leaves the water on flat ground. Returns the two ramps and the landing
 * between them, plus where that landing sits.
 */
function buildAscent(): { floors: FloorRect[]; breakZ: number } {
  const LANDING_LENGTH = 6;
  // Where the head leaves the water. Pinned, not derived.
  //
  // Splitting the run in proportion to the climb either side of the break
  // reads as fair and puts the break wherever the arithmetic lands — which
  // was z 184.3, with 1.7 m of ascent left after it. The visitor surfaced
  // 5.7 m from the sea plane's own far edge, so at the one moment the walk
  // exists to sell, the water was a 3.5-degree sliver at the horizon and
  // every drop of it was behind them. Hiding the surface entirely changed
  // nothing in that frame.
  //
  // 165 is the colonnade's last bay. The reef's monumental band runs to 162,
  // so surfacing here happens among the hero structures instead of 22 m past
  // them on bare ramp, and leaves ~25 m of open water ahead — the sea is
  // still in front of the visitor at the moment they rise out of it.
  const SURFACE_BREAK_Z = 165;
  const lowerEndZ = SURFACE_BREAK_Z - LANDING_LENGTH / 2;
  const landingEndZ = lowerEndZ + LANDING_LENGTH;

  /**
   * The elevation profile, which the cave did not change: two ramps around a
   * landing, so the head still leaves the water at z 165. Only the WIDTH is
   * new. Keeping the profile as data and the width as a separate pass is what
   * lets the cave be reshaped without ever touching where the visitor surfaces.
   */
  const profile = [
    { id: "ascent-lower", minZ: SEA_END_Z, maxZ: lowerEndZ, fromY: SEA_FLOOR_Y, toY: SURFACE_BREAK_Y },
    { id: "ascent-landing", minZ: lowerEndZ, maxZ: landingEndZ, fromY: SURFACE_BREAK_Y, toY: SURFACE_BREAK_Y },
    { id: "ascent-upper", minZ: landingEndZ, maxZ: ASCENT_END_Z, fromY: SURFACE_BREAK_Y, toY: SPRING_FLOOR_Y },
  ];

  /**
   * Cut at every cave-slice boundary AND every profile boundary. The two sets
   * do not align — six 11 m slices against a 38/6/22 m profile — so the union
   * is the only set of pieces where each piece has both one constant width and
   * one straight elevation.
   */
  const cuts = new Set<number>([SEA_END_Z, lowerEndZ, landingEndZ, ASCENT_END_Z]);
  for (let i = 1; i < CAVE_SLICES; i += 1) {
    cuts.add(CAVE_START_Z + ((CAVE_END_Z - CAVE_START_Z) * i) / CAVE_SLICES);
  }
  const edges = [...cuts].sort((a, b) => a - b);

  const floors: FloorRect[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const minZ = edges[i];
    const maxZ = edges[i + 1];
    const segment = profile.find((s) => minZ >= s.minZ && maxZ <= s.maxZ);
    if (!segment) continue;

    const span = segment.maxZ - segment.minZ;
    const yAt = (z: number) =>
      segment.fromY +
      (segment.toY - segment.fromY) * ((z - segment.minZ) / span);

    // Width from the WIDE end of the piece, plus the rock's thickness, so the
    // slab always reaches past the wall it meets. Under-reaching would leave a
    // slot along the base of the passage to fall through; over-reaching is
    // buried in rock and costs nothing.
    const halfW = caveHalfWAt(maxZ) + ROCK_THICKNESS;
    const r = rect(-halfW, minZ, halfW, maxZ);

    floors.push(
      minZ >= segment.minZ && segment.fromY === segment.toY
        ? flat(`${segment.id}-${i}`, r, segment.fromY)
        : ramp(`${segment.id}-${i}`, r, yAt(minZ), yAt(maxZ))
    );
  }

  return { breakZ: (lowerEndZ + landingEndZ) / 2, floors };
}

/** Elevation of the walkable floor at a point on the centreline. */
function floorYAt(floors: FloorRect[], z: number): number {
  for (const floor of floors) {
    if (z < floor.rect.minZ || z > floor.rect.maxZ) continue;
    if (floor.kind === "flat") return floor.fromY;
    const t = (z - floor.rect.minZ) / (floor.rect.maxZ - floor.rect.minZ);
    return floor.fromY + (floor.toY - floor.fromY) * t;
  }
  return SNOW_Y;
}

/**
 * Ridge legs: [id, from Z, to Z, base, nominal top, half width, chamber].
 *
 * Only the two hall chambers get ridges. The cave and the canyon are cut rock
 * with their own containment; a broken skyline inside them would be a mountain
 * range indoors.
 */
const RIDGE_LEGS: [string, number, number, number, number, number, HallRegion][] = [
  ["snow", SNOW_START_Z, SNOW_END_Z, SNOW_Y, SNOW_RIDGE_TOP, SNOW_HALF_W, "snowfield"],
  ["descent", SNOW_END_Z, DESCENT_END_Z, SEA_FLOOR_Y, DESCENT_RIDGE_TOP, SEA_HALF_W, "sea"],
  ["sea", DESCENT_END_Z, SEA_END_Z, SEA_FLOOR_Y, SEA_RIDGE_TOP, SEA_HALF_W, "sea"],
];

/** Clearance the peaks keep under their chamber's roof. */
const RIDGE_HEADROOM = 4;

/** Deterministic value in [0,1). Terrain must be identical every reload. */
function jitter(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A containing ridge, built as a broken line of blocks rather than one slab.
 *
 * Two straight walls down a valley read as a corridor, and a corridor is the
 * exact failure this piece was told to avoid: "we don't have to be relegated
 * to being inside a building." Varying each block's height, depth and inset
 * turns the same containment into a skyline. It still cannot be crossed — the
 * lowest block clears the jump apex by a wide margin — but it stops announcing
 * that it is a boundary.
 */
function buildRidge(
  id: string,
  minZ: number,
  maxZ: number,
  baseY: number,
  nominalTop: number,
  halfWidth: number,
  /**
   * Ceiling of the chamber this range stands in. The peaks are scenery inside
   * a building, so they stop short of its roof — a summit that vanishes into
   * the ceiling would read as a modelling mistake rather than as a mountain.
   */
  maxTop: number
): WallRect[] {
  const BLOCK = 17;
  const count = Math.max(2, Math.round((maxZ - minZ) / BLOCK));
  const step = (maxZ - minZ) / count;
  const walls: WallRect[] = [];

  for (const side of [-1, 1] as const) {
    for (let i = 0; i < count; i += 1) {
      const seed = (id.length * 31 + i) * (side < 0 ? 1 : 7.3) + i * 2.7;
      const height = nominalTop - baseY;
      const top = Math.min(
        baseY + height * (0.62 + jitter(seed) * 0.95),
        maxTop
      );
      // Pull some blocks back and push others in, so the valley breathes
      // instead of running at one width for 372 m.
      const inset = -2.5 + jitter(seed + 11) * 9;
      const depth = RIDGE_THICKNESS + jitter(seed + 23) * 14;
      const near = halfWidth + inset;
      const far = near + depth;

      walls.push({
        id: `ridge-${id}-${side < 0 ? "west" : "east"}-${i}`,
        rect: rect(
          side < 0 ? -far : near,
          minZ + i * step,
          side < 0 ? -near : far,
          minZ + (i + 1) * step + 0.5
        ),
        baseY,
        topY: top,
      });
    }
  }

  return walls;
}

/**
 * The analytic floor: flat legs and ramps, with no seabed relief on top.
 *
 * Split out from buildWaterTraverseLayout because the seabed's height field
 * is stored RELATIVE to this, so baseFloorYAt has to be able to ask what the
 * floor was before the field was applied — asking the finished layout would
 * include the tiles built from the field and define itself in a circle.
 */
function buildBaseFloorRects(): FloorRect[] {
  const ascent = buildAscent();
  const full = rect(-SEA_HALF_W, 0, SEA_HALF_W, 0);

  const floorRects: FloorRect[] = [
    // The frozen river is a CUT, not a stripe painted on the snow: banks stand
    // proud of it, and the walkable ice is the waterline itself. Without the
    // cut the surface disappears under the snow slab and the first landscape
    // loses the only thing it is about.
    flat(
      "snowfield-west",
      rect(-SNOW_HALF_W, SNOW_START_Z, -CHANNEL_HALF_W, SNOW_END_Z),
      SNOW_Y
    ),
    flat(
      "snowfield-east",
      rect(CHANNEL_HALF_W, SNOW_START_Z, SNOW_HALF_W, SNOW_END_Z),
      SNOW_Y
    ),
    flat(
      "frozen-river-bed",
      rect(-CHANNEL_HALF_W, SNOW_START_Z, CHANNEL_HALF_W, SNOW_END_Z),
      WATERLINE_Y
    ),
    ramp(
      "descent",
      { ...full, minZ: SNOW_END_Z, maxZ: DESCENT_END_Z },
      SNOW_Y,
      SEA_FLOOR_Y
    ),
    flat("sea-floor", { ...full, minZ: DESCENT_END_Z, maxZ: SEA_END_Z }, SEA_FLOOR_Y),
    ...ascent.floors,
    // Reaches the canyon walls, not the old valley's 40 m. SPRING_HALF_W left
    // a 6 m slot down to nothing along the base of each wall — a floor that
    // stops short of the room it is in is the same defect as one that runs
    // past it, read from the other side.
    flat(
      "spring-plain",
      rect(
        -CANYON_HALF_W - ROCK_THICKNESS,
        ASCENT_END_Z,
        CANYON_HALF_W + ROCK_THICKNESS,
        // Under the tail as well. The visitor never walks there, but they can
        // see it, and a canyon that runs on past a floor that does not would
        // show its own edge — the exact tell the tail exists to avoid.
        SPRING_END_Z + CANYON_TAIL_LENGTH
      ),
      SPRING_FLOOR_Y
    ),
  ];

  // Banks either side of the hot stream, so the visitor can choose to walk dry
  // or walk wet without either being the route.
  for (const side of [-1, 1] as const) {
    floorRects.push(
      flat(
        `spring-bank-${side < 0 ? "west" : "east"}`,
        rect(
          side < 0 ? -CANYON_HALF_W : CHANNEL_HALF_W + 2.5,
          ASCENT_END_Z + 6,
          side < 0 ? -CHANNEL_HALF_W - 2.5 : CANYON_HALF_W,
          SPRING_END_Z - 8
        ),
        SPRING_BANK_Y
      )
    );
  }

  return floorRects;
}

export function buildWaterTraverseLayout(): WaterTraverseLayout {
  const ascent = buildAscent();
  const floorRects: FloorRect[] = buildBaseFloorRects();

  // STALE SINCE THE CAVE: the baked height field runs z 52 → 189.7 at ±42 m,
  // which is the old open-water trench. Past the cave mouth at z 124 the walk
  // is inside a passage 13–21 m wide, so the last 66 m of this field is seabed
  // relief growing through solid rock. Harmless today — the graybox draws
  // boxes and loads no trimesh — but scripts/traverse_seabed.py has to re-bake
  // to end at CAVE_START_Z before any art pass loads it.
  //
  // The sculpted seabed sits on top of the flat trench floor as one trimesh.
  // The route down the middle has zero relief by construction, so it is a
  // perfectly smooth strip of that mesh; the dunes either side carry all the
  // roughness. See water-traverse-seabed.ts.
  const seabedMesh = buildSeabedMesh(baseFloorYAt);

  const wallRects: WallRect[] = [];
  for (const [id, minZ, maxZ, baseY, topY, halfWidth, chamber] of RIDGE_LEGS) {
    wallRects.push(
      ...buildRidge(
        id,
        minZ,
        maxZ,
        baseY,
        topY,
        halfWidth,
        CHAMBER_CEILING[chamber] - RIDGE_HEADROOM
      )
    );
  }
  // The building: two chambers, the second taller and wider than the first,
  // joined by a portal rather than roofed over independently.
  for (const leg of ["snowfield", "sea"] as const) {
    wallRects.push(...buildChamber(leg));
  }
  // Then the rock: a flooded passage that climbs, and the room it opens into.
  wallRects.push(...buildCave(), ...buildCanyon());

  const mouth = caveSlice(0);
  const throat = caveSlice(CAVE_SLICES - 1);
  wallRects.push(
    // Ice → sea. A doorway rather than a missing wall.
    ...buildPortal(
      "ice-sea",
      SNOW_END_Z,
      CHAMBER_HALF_W.sea,
      CHAMBER_CEILING.sea,
      30,
      WATERLINE_Y + 26
    ),
    // The cave mouth: a 26 m hole at the foot of a wall 184 m across and 70 m
    // tall. It has to be small enough that the sea hall reads as ending, and
    // it has to sit on the FLOOR — a cave you enter through an arch halfway up
    // a wall is a doorway with rock texture on it.
    ...buildPortal(
      "cave-mouth",
      CAVE_START_Z,
      CHAMBER_HALF_W.sea,
      CHAMBER_CEILING.sea,
      CAVE_HALF_W_MOUTH,
      mouth.roofY
    ),
    // Cave → canyon. The reveal: you leave a 16 m tube through a hole in the
    // near wall of a room nearly four times as tall.
    ...buildPortal(
      "cave-canyon",
      CAVE_END_Z,
      CANYON_HALF_W,
      CANYON_ROOF_Y,
      CAVE_HALF_W_INNER,
      throat.roofY
    )
  );

  // Close the near end. The walk is forward-only and there is nothing behind
  // you: this is the cyclorama, the end wall the first diorama is built
  // against. The far end is the canyon's head wall, built with the canyon.
  wallRects.push({
    id: "cyclorama-start",
    rect: rect(
      -CHAMBER_HALF_W.snowfield,
      SNOW_START_Z - HALL_THICKNESS,
      CHAMBER_HALF_W.snowfield,
      SNOW_START_Z
    ),
    baseY: HALL_BASE_Y,
    topY: CHAMBER_CEILING.snowfield,
  });

  /**
   * Three surfaces, one elevation. The ice is walked on, the sea is walked
   * under, the spring is stood in — and all three are the same y = 0 plane.
   */
  const waterPlanes: WaterPlane[] = [
    {
      id: "frozen-river",
      ...rect(-CHANNEL_HALF_W, SNOW_START_Z, CHANNEL_HALF_W, SNOW_END_Z),
      surfaceY: WATERLINE_Y,
      state: "ice",
      seenFromBelow: false,
    },
    {
      id: "sea-surface",
      ...rect(-SEA_HALF_W, SNOW_END_Z, SEA_HALF_W, CAVE_START_Z),
      surfaceY: WATERLINE_Y,
      state: "sea",
      seenFromBelow: true,
    },
    // The cave is FLOODED. Its floor climbs from -18 to -0.9 and the waterline
    // does not move, so the visitor walks up through the water and out of it
    // inside the rock. This plane is the thing their head breaks at z 165.
    {
      id: "cave-water",
      ...rect(-CAVE_HALF_W_INNER, CAVE_START_Z, CAVE_HALF_W_INNER, CAVE_END_Z),
      surfaceY: WATERLINE_Y,
      state: "sea",
      seenFromBelow: true,
    },
    {
      id: "hot-stream",
      ...rect(-CHANNEL_HALF_W, ASCENT_END_Z, CHANNEL_HALF_W, SPRING_END_Z),
      surfaceY: WATERLINE_Y,
      state: "spring",
      seenFromBelow: false,
    },
  ];

  // Two wider pools off the stream, so the last leg is a field of water rather
  // than one more channel. They brim to the same line as everything else.
  waterPlanes.push(
    {
      id: "spring-pool-west",
      ...rect(-21, ASCENT_END_Z + 22, -8, ASCENT_END_Z + 44),
      surfaceY: WATERLINE_Y,
      state: "spring",
      seenFromBelow: false,
    },
    {
      id: "spring-pool-east",
      ...rect(9, ASCENT_END_Z + 40, 22, ASCENT_END_Z + 66),
      surfaceY: WATERLINE_Y,
      state: "spring",
      seenFromBelow: false,
    }
  );

  /**
   * One performer per leg. A is pro/pro — unified, locked, ice. C is the
   * hybrid and the only one carrying both rotations — liquid. B is anti/anti,
   * the same motion as A inverted, which is what steam is to ice.
   * Verified against the Flow Arts MCP 2026-08-09.
   */
  const performers: PerformerAnchor[] = [
    /**
     * A, then B, then C, in that order along the walk. The first mapping put
     * the hybrid letter on the liquid leg because liquid is the hybrid state,
     * which was a nice idea nobody walking the route could ever read: what a
     * visitor actually reads is the alphabet counting up as they go.
     */
    {
      id: "ice-performer",
      leg: "snowfield",
      letter: "A",
      effectId: "sparkles",
      x: 0,
      z: (SNOW_START_Z + SNOW_END_Z) / 2 + 6,
      y: WATERLINE_Y,
      facingAngle: Math.PI,
    },
    {
      id: "sea-performer",
      leg: "sea",
      letter: "B",
      effectId: "goo",
      x: 0,
      z: (DESCENT_END_Z + SEA_END_Z) / 2,
      y: SEA_FLOOR_Y,
      facingAngle: Math.PI,
    },
    {
      id: "steam-performer",
      leg: "spring",
      letter: "C",
      effectId: "smoke",
      x: 0,
      z: ASCENT_END_Z + 30,
      y: SPRING_FLOOR_Y,
      facingAngle: Math.PI,
    },
  ];

  const route: { x: number; z: number; y: number }[] = [];
  for (let z = SNOW_START_Z + 2; z <= SPRING_END_Z - 2; z += 4) {
    route.push({ x: 0, z, y: floorYAt(floorRects, z) });
  }

  return {
    // The building's footprint, not the valley's. Bounds are what the resume
    // clamp checks against, so they have to describe the space you can
    // actually stand in.
    bounds: rect(
      -CHAMBER_HALF_W.sea - HALL_THICKNESS,
      SNOW_START_Z - HALL_THICKNESS,
      CHAMBER_HALF_W.sea + HALL_THICKNESS,
      SPRING_END_Z + CANYON_TAIL_LENGTH + ROCK_THICKNESS
    ),
    floorRects,
    seabedMesh,
    wallRects,
    waterPlanes,
    performers,
    route,
    legs: {
      snowfield: rect(-SNOW_HALF_W, SNOW_START_Z, SNOW_HALF_W, DESCENT_END_Z),
      sea: rect(-SEA_HALF_W, DESCENT_END_Z, SEA_HALF_W, ASCENT_END_Z),
      spring: rect(-CANYON_HALF_W, ASCENT_END_Z, CANYON_HALF_W, SPRING_END_Z),
    },
    surfaceBreak: { x: 0, z: ascent.breakZ, y: SURFACE_BREAK_Y },
    /**
     * The steam column, standing under the shaft and going out through it.
     *
     * It used to be the piece's one long sightline, visible from the first
     * step through two portals. Putting the springs underground costs that,
     * and the cost is worth paying: a column you can see for the whole walk is
     * a promise, and a room you cannot see into until you are in it is a
     * reveal. What carries the visitor forward instead is the water — which
     * the terrain header already says is the only wayfinding — and, once the
     * trench opens up, a hole in the far wall with heat coming out of it.
     *
     * It clears the roof rather than stopping under it, because steam that
     * stops at a ceiling is smoke in a room.
     */
    plume: {
      x: 0,
      z: (SHAFT.minZ + SHAFT.maxZ) / 2,
      baseY: WATERLINE_Y,
      height: CANYON_ROOF_Y + ROCK_THICKNESS + 8 - WATERLINE_Y,
    },
    spawn: { x: 0, y: SNOW_Y + 1.0, z: SNOW_START_Z + 6, yaw: 0 },
  };
}

/**
 * Elevation of the ANALYTIC floor at a route Z — the flat legs and the ramps,
 * before the seabed's sculpted relief is added on top.
 *
 * Exported for the seabed module, which stores relief relative to it, and for
 * scripts/traverse_seabed.py, which reproduces this function so the baked mesh
 * lands on the same ramps.
 */
export function baseFloorYAt(z: number): number {
  baseFloors ??= buildBaseFloorRects();
  return floorYAt(baseFloors, z);
}
let baseFloors: FloorRect[] | null = null;

/**
 * Which SPACE a world Z is in.
 *
 * Separate from `legAt` on purpose, and the split is the point of the route
 * change: a leg is the visitor's relationship to the waterline (on it, under
 * it, in it), a region is the room they are standing in. Those used to be the
 * same three things. Now the sea leg spans two rooms — the hangar and the
 * cave — because you are still under the sea for the whole climb.
 */
export function regionAt(z: number): Region {
  if (z < SNOW_END_Z) return "snowfield";
  if (z < CAVE_START_Z) return "sea";
  if (z < CAVE_END_Z) return "cave";
  return "canyon";
}

/** Which cave slice a world Z falls in. Clamped at both ends. */
function caveSliceAt(z: number) {
  const t = (z - CAVE_START_Z) / (CAVE_END_Z - CAVE_START_Z);
  return caveSlice(Math.max(0, Math.min(CAVE_SLICES - 1, Math.floor(t * CAVE_SLICES))));
}

/**
 * The ceiling directly overhead, and the walls either side.
 *
 * Queried by Z rather than read off a per-leg map, because the cave's roof
 * steps six times inside one leg. A readout that answered "52 m to ceiling"
 * while the visitor stood in a nine-metre tube would be reporting the room
 * they just left.
 */
export function ceilingAt(z: number): number {
  const region = regionAt(z);
  if (region === "cave") return caveSliceAt(z).roofY;
  if (region === "canyon") return CANYON_ROOF_Y;
  return CHAMBER_CEILING[region];
}

/** Half the distance between the walls at this Z. */
export function hallHalfWidthAt(z: number): number {
  const region = regionAt(z);
  if (region === "cave") return caveSliceAt(z).halfW;
  if (region === "canyon") return CANYON_HALF_W;
  return CHAMBER_HALF_W[region];
}

/** Which leg a world Z belongs to. */
export function legAt(z: number): Leg {
  // The leg changes where the WATER changes, not where the floor levels out.
  // The descent ramp is already under the surface for most of its run, so
  // calling it snowfield until the bottom would have the readout say "on the
  // water" to someone standing nine metres beneath it.
  if (z < SNOW_END_Z) return "snowfield";
  if (z < ASCENT_END_Z) return "sea";
  return "spring";
}
