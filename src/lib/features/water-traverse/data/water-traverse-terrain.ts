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
 * Where the canyon starts: waist-deep. The visitor stands 0.9 m under the
 * waterline, so the surface cuts them at the hip. It does not stay there — the
 * canyon floor lets go a few metres in and keeps falling to the springs.
 */
export const SPRING_FLOOR_Y = WATERLINE_Y - 0.9;

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
/**
 * The last step. Held as a literal rather than derived from SUMP_END_Z because
 * that constant is declared with the rest of the sump, below, and a module-scope
 * const cannot read one that has not been initialised yet. The arithmetic it
 * stands for: 250 (sump end) + 34 m of springs chamber.
 */
const SPRING_END_Z = 284;

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
 * ── Six spaces ──────────────────────────────────────────────────────────────
 *
 * The route used to climb down into the sea and climb straight back out into
 * an open geothermal plain: three rooms in a row, each bigger than the last,
 * no compression anywhere, and 24 m of empty ground after the payoff.
 *
 * It now goes down, into a cave, and the cave climbs until it opens into an
 * underground canyon — and then the canyon takes the visitor back DOWN, under
 * the water, and pushes them through a hole into the room the springs are
 * actually in:
 *
 *   snowfield   a basin you cross             wide, roofed, man-made
 *   sea         a hangar you are down inside  vast, roofed, man-made
 *   cave        a flooded passage that climbs tight and dark
 *   canyon      the one big look               vast, all rock, dry-ish
 *   sump        the roof comes down to meet the water and then goes under it
 *   springs     flooded to the roof            where the heat is
 *
 * The shape is big → big → small → BIG → smallest → big. Two squeezes, and the
 * second one is worse than the first: the cave you could stand up in, the sump
 * you cannot, and the sump is nineteen metres under a surface you can no longer
 * see. Coming out of that into the springs is the payoff the room is built for.
 *
 * The first two are still dioramas in a hall — you can see a ceiling and it is
 * man-made. From the cave mouth onward the ceiling is rock, because a cave
 * that admits it is a building is not a cave.
 *
 * The springs chamber is also the volcano's first room. The walk ends there
 * because the next one starts there — which is why nothing in the back half
 * points up any more. An exit through the roof would end this piece; a hole in
 * the far wall hands it on.
 */
export type Region = "snowfield" | "sea" | "cave" | "canyon" | "sump" | "springs";

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

// ── The canyon, the sump, and the springs ───────────────────────────────────

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
/** How far into the canyon the visitor stays waist-deep before the floor lets go. */
const CANYON_SHALLOW_Z = ASCENT_END_Z + 6;
/** Floor at the canyon's far end: eye 4.4 m under the line, walls still 48 m apart. */
const CANYON_FLOOR_END_Y = WATERLINE_Y - 6;

/**
 * ── The sump ────────────────────────────────────────────────────────────────
 *
 * The canyon used to end at a light shaft: the last thing the walk asked for
 * was a look UP, out of a hole in the roof, at the sky. That is an exit, and
 * this room is not where the visitor leaves — it is where they are handed to
 * the volcano.
 *
 * So the far end goes IN, and it goes DOWN. The floor keeps falling and the
 * roof falls FASTER, which is the whole trick: a floor that drops in a room
 * this tall is a slope, but a roof that drops to meet the water is the room
 * closing over your head. The surface is above you, then level with the rock,
 * then gone — and from that point on there is no surface anywhere, because
 * the passage is full.
 *
 * `sump` is the caving word for exactly this: a passage flooded to its roof.
 */
const SUMP_START_Z = 212;
const SUMP_END_Z = 250;
/** Floor at the sump's far end — 19 m under the line, and still falling into it. */
const SUMP_FLOOR_END_Y = WATERLINE_Y - 19;
/**
 * The pinch. 7 m across with 3.5 m of headroom, tighter than the cave's 12 × 6,
 * because the cave already spent that card: a second squeeze that is not worse
 * than the first one is not a squeeze, it is a repeat.
 */
const SUMP_THROAT_HALF_W = 3.5;
const SUMP_THROAT_CLEARANCE = 3.5;
/**
 * How hard the closing is front-loaded. Both are eased rather than linear
 * because linear from 58 m of roof spends three quarters of the run still
 * unmistakably inside the canyon and then drops the ceiling on you in the last
 * five metres. The exponents put the collapse where it can be watched.
 *
 * The roof exponent was 2.6, which is a better CURVE and a worse OBJECT: it
 * spends 12 m of its fall in the first slice, so the first slab read from below
 * as a single enormous lintel across the canyon rather than as the ceiling
 * starting to come down. 2.2 gives up very little of the front-loading and
 * roughly halves that first step.
 */
const SUMP_ROOF_EASE = 2.2;
const SUMP_WALL_EASE = 1.6;
/**
 * Slices. Twenty-four rather than twelve, and the reason is only ever visible
 * on a pitch-up: axis-aligned slabs approximating a curve read as strata when
 * each step is about a metre and as a STAIRCASE when each step is five. Twelve
 * slices over a 60 m fall was a staircase — see the graybox frame at z 196,
 * pitch 0.5, which is the frame this number was set from.
 */
const SUMP_SLICES = 24;

/**
 * ── The springs ─────────────────────────────────────────────────────────────
 *
 * The sump lets out into a chamber that is flooded to its roof: 52 m across,
 * 16 m tall, and every metre of it under water. The vents are on its floor and
 * the heat goes UP into rock instead of out into sky.
 *
 * This chamber is the volcano's first room. The walk ends here because the
 * next one starts here.
 */
const SPRINGS_HALF_W = 26;
const SPRINGS_ROOF_Y = WATERLINE_Y - 3;
const SPRINGS_FLOOR_Y = SUMP_FLOOR_END_Y;
/** The flare: how far it takes to go from the throat to the full chamber. */
const SPRINGS_FLARE_LENGTH = 6;

/**
 * The far end is not a taper. It is a door.
 *
 * What this replaces converged the walls past the last step and capped them
 * 16 m beyond it — the trick the canyon's old head wall was missing, and it
 * does work, in the canyon, where the section is 59 m tall and the cap is a
 * small rectangle low in a very tall frame. It does not survive being moved
 * here. This chamber is 16 m from floor to roof, so a cap 18 m ahead subtends
 * roughly 60° across and 48° up: at the last step it is not a distant
 * continuation, it is a WALL, and the frame reads as the back of a room. Which
 * is the one thing the far end cannot say, because the far end is the handoff.
 *
 * So the chamber ends in a face with a mouth in it — 14 m across and 8 m tall,
 * sitting on the floor of a wall 52 m wide and 16 m high — and a flooded throat
 * runs on into the dark behind it. A hole reads as somewhere to go in a way no
 * taper does, and the last step of the water walk lands in it.
 */
const SPRINGS_MOUTH_HALF_W = 7;
const SPRINGS_MOUTH_TOP_Y = SPRINGS_FLOOR_Y + 8;
/**
 * Sixty metres of throat, and the length is doing one job: the cap has to be
 * far enough away that the fog takes it. At 22 m it did not, and the end wall
 * came back as the BRIGHTEST surface in the frame — a lit rectangle at the end
 * of the tunnel, which says daylight, which is the exact thing pulling the
 * shaft out of the canyon was meant to stop saying. Nobody walks this passage,
 * so its only cost is a few rects, and what it buys is a hole that goes dark.
 */
const SPRINGS_THROAT_LENGTH = 60;

/**
 * One outer boundary for the whole rock half, rather than each space's own
 * inner width plus a slab.
 *
 * The back three spaces have wildly different inner widths — 48 m, then 7, then
 * 52 — and if each one's wall were only ROCK_THICKNESS deep, the volume between
 * the throat and the canyon's outer face would be a 20 m void the canyon looks
 * straight into at its far end. Every wall back here therefore runs from its
 * own inner face out to the SAME plane. The extra rock is never seen and never
 * costs anything: it is a box, and it is inside a mountain.
 */
const BACK_OUTER_HALF_W =
  Math.max(CANYON_HALF_W, SPRINGS_HALF_W) + ROCK_THICKNESS;
/** And one top plane, for the same reason, so no seam opens above a roof. */
const BACK_OUTER_TOP_Y = CANYON_ROOF_Y + ROCK_THICKNESS;

const HALL_THICKNESS = 3;
/** The lowest floor anywhere. Walls are built down to it so none of them float. */
const HALL_BASE_Y = SEA_FLOOR_Y - 2;

/**
 * The near face of the head-wall portal — where the chamber's 16 m of roof
 * actually becomes the mouth's 8 m. Declared here rather than beside the other
 * springs constants because it needs HALL_THICKNESS, which is declared below
 * them: a const cannot read a const written later in the file.
 */
const SPRINGS_MOUTH_START_Z = SPRING_END_Z - HALL_THICKNESS / 2;

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
 * Where the sump is along its own run, 0 at the canyon and 1 at the springs.
 * Clamped, so callers can hand it any world Z without guarding first.
 */
function sumpT(z: number): number {
  return Math.max(0, Math.min(1, (z - SUMP_START_Z) / (SUMP_END_Z - SUMP_START_Z)));
}

/** The sump floor: one straight fall from the canyon's floor to the chamber's. */
function sumpFloorYAt(z: number): number {
  return (
    CANYON_FLOOR_END_Y + (SUMP_FLOOR_END_Y - CANYON_FLOOR_END_Y) * sumpT(z)
  );
}

/**
 * Half-width of the sump at world Z.
 *
 * Pure arithmetic over constants, for the same reason `caveHalfWAt` is: the
 * FLOOR has to know how wide the passage is, and it cannot ask a function that
 * asks the floor where it is.
 */
function sumpHalfWAt(z: number): number {
  const k = 1 - sumpT(z);
  return (
    SUMP_THROAT_HALF_W +
    (CANYON_HALF_W - SUMP_THROAT_HALF_W) * Math.pow(k, SUMP_WALL_EASE)
  );
}

/**
 * Roof of the sump at world Z.
 *
 * Expressed as CLEARANCE over the floor rather than as an absolute height,
 * because the thing being authored is how much room is over the visitor's head
 * — and the floor is falling at the same time. Eased hard: linear from 58 m
 * leaves the ceiling unmistakably canyon-height for three quarters of the run
 * and then drops it in the last five metres, which reads as a bug rather than
 * as a room closing.
 *
 * The interesting number is where this crosses y = 0. That is the metre at
 * which the rock roof meets the water surface, and past it there is no surface
 * anywhere in the piece — which is why the sump has no water plane over the
 * back of it. It is not that the water stops; it is that the air does.
 */
function sumpRoofYAt(z: number): number {
  const k = 1 - sumpT(z);
  const canyonClearance = CANYON_ROOF_Y - CANYON_FLOOR_END_Y;
  const clearance =
    SUMP_THROAT_CLEARANCE +
    (canyonClearance - SUMP_THROAT_CLEARANCE) * Math.pow(k, SUMP_ROOF_EASE);
  return sumpFloorYAt(z) + clearance;
}

/**
 * The Z at which the sump's roof reaches the waterline — the last metre of the
 * traverse that has a water SURFACE in it.
 *
 * Solved by bisection rather than algebra because the roof is the sum of a
 * linear floor and an eased clearance term, and inverting that closed-form
 * would bake the two exponents into a formula that silently stops being true
 * the moment somebody retunes them. Twenty-eight iterations is exact to well
 * under a millimetre and runs once.
 */
function solveSumpSurfaceEndZ(): number {
  let lo = SUMP_START_Z;
  let hi = SUMP_END_Z;
  if (sumpRoofYAt(hi) > WATERLINE_Y) return hi;
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2;
    if (sumpRoofYAt(mid) > WATERLINE_Y) lo = mid;
    else hi = mid;
  }
  return lo;
}
const SUMP_SURFACE_END_Z = solveSumpSurfaceEndZ();

/**
 * The canyon: two rock walls and a roof, for 22 m.
 *
 * Solid slabs rather than the broken ridge blocks the open legs use. A ridge
 * is a skyline seen against something beyond it; a canyon wall has nothing
 * beyond it, and gaps between blocks would show the hall the room is trying
 * not to be.
 *
 * It has no end wall and no roof hole. Its far end is the sump, and the sump
 * closes it.
 */
function buildCanyon(): WallRect[] {
  const walls: WallRect[] = [];

  for (const side of [-1, 1] as const) {
    walls.push({
      id: `canyon-${side < 0 ? "west" : "east"}`,
      rect: rect(
        side < 0 ? -BACK_OUTER_HALF_W : CANYON_HALF_W,
        CAVE_END_Z,
        side < 0 ? -CANYON_HALF_W : BACK_OUTER_HALF_W,
        SUMP_START_Z
      ),
      baseY: HALL_BASE_Y,
      topY: BACK_OUTER_TOP_Y,
    });
  }

  walls.push({
    id: "canyon-roof",
    rect: rect(-CANYON_HALF_W, CAVE_END_Z, CANYON_HALF_W, SUMP_START_Z),
    baseY: CANYON_ROOF_Y,
    topY: BACK_OUTER_TOP_Y,
  });

  return walls;
}

/**
 * The sump: twelve slices of a passage that is closing on every axis at once.
 *
 * Twelve rather than the cave's six because this profile is curved, not
 * straight, and a stepped approximation of a curve needs steps small enough
 * that the eye reads them as strata instead of as a staircase.
 *
 * Each slice's roof is taken at its FAR end — the tighter end — so the number
 * a slice advertises is the worst case inside it. Its walls are taken at the
 * far end too, for the same reason. A slice that quoted its own entrance would
 * be describing the last room every time.
 */
function buildSump(): WallRect[] {
  const walls: WallRect[] = [];
  const span = SUMP_END_Z - SUMP_START_Z;

  for (let i = 0; i < SUMP_SLICES; i += 1) {
    const minZ = SUMP_START_Z + (span * i) / SUMP_SLICES;
    const maxZ = SUMP_START_Z + (span * (i + 1)) / SUMP_SLICES;
    const halfW = sumpHalfWAt(maxZ);
    const roofY = sumpRoofYAt(maxZ);

    for (const side of [-1, 1] as const) {
      walls.push({
        id: `sump-${side < 0 ? "west" : "east"}-${i}`,
        rect: rect(
          side < 0 ? -BACK_OUTER_HALF_W : halfW,
          minZ,
          side < 0 ? -halfW : BACK_OUTER_HALF_W,
          // Overlap the next slice slightly. Butt-jointed slabs on a curve
          // leave hairline gaps you can see daylight through at a grazing
          // angle, which in a sealed passage is the one thing that cannot
          // happen.
          maxZ + 0.5
        ),
        baseY: HALL_BASE_Y,
        topY: BACK_OUTER_TOP_Y,
      });
    }

    walls.push({
      id: `sump-roof-${i}`,
      rect: rect(-halfW, minZ, halfW, maxZ + 0.5),
      baseY: roofY,
      topY: BACK_OUTER_TOP_Y,
    });
  }

  return walls;
}

/**
 * The springs chamber: a flare, a room, and a door.
 *
 * The flare is six metres of wall going from the throat's 7 m to the chamber's
 * 52. That is a sevenfold opening inside two paces, and it has to be a flare
 * rather than a step because a step is a doorway — and the visitor is supposed
 * to be spat out of a hole, not shown through one.
 *
 * The far end is the doorway, and it is the only one in the piece: a portal in
 * the head wall with a flooded throat behind it. The walk's last step lands in
 * that opening, so the final frame of the water room is a look down the first
 * passage of the fire one.
 */
function buildSprings(): WallRect[] {
  const walls: WallRect[] = [];
  const roof = (id: string, r: WorldRect, baseY: number) =>
    walls.push({
      id: `springs-roof-${id}`,
      rect: r,
      baseY,
      topY: BACK_OUTER_TOP_Y,
    });

  const FLARE_SLICES = 3;
  for (let i = 0; i < FLARE_SLICES; i += 1) {
    const minZ = SUMP_END_Z + (SPRINGS_FLARE_LENGTH * i) / FLARE_SLICES;
    const maxZ = SUMP_END_Z + (SPRINGS_FLARE_LENGTH * (i + 1)) / FLARE_SLICES;
    const t = (i + 1) / FLARE_SLICES;
    const halfW =
      SUMP_THROAT_HALF_W + (SPRINGS_HALF_W - SUMP_THROAT_HALF_W) * t;
    const roofY =
      sumpRoofYAt(SUMP_END_Z) + (SPRINGS_ROOF_Y - sumpRoofYAt(SUMP_END_Z)) * t;
    for (const side of [-1, 1] as const) {
      walls.push({
        id: `springs-flare-${side < 0 ? "west" : "east"}-${i}`,
        rect: rect(
          side < 0 ? -BACK_OUTER_HALF_W : halfW,
          minZ,
          side < 0 ? -halfW : BACK_OUTER_HALF_W,
          maxZ + 0.5
        ),
        baseY: HALL_BASE_Y,
        topY: BACK_OUTER_TOP_Y,
      });
    }
    roof(`flare-${i}`, rect(-halfW, minZ, halfW, maxZ + 0.5), roofY);
  }

  const roomStart = SUMP_END_Z + SPRINGS_FLARE_LENGTH;
  for (const side of [-1, 1] as const) {
    walls.push({
      id: `springs-${side < 0 ? "west" : "east"}`,
      rect: rect(
        side < 0 ? -BACK_OUTER_HALF_W : SPRINGS_HALF_W,
        roomStart,
        side < 0 ? -SPRINGS_HALF_W : BACK_OUTER_HALF_W,
        SPRING_END_Z
      ),
      baseY: HALL_BASE_Y,
      topY: BACK_OUTER_TOP_Y,
    });
  }
  roof(
    "room",
    rect(-SPRINGS_HALF_W, roomStart, SPRINGS_HALF_W, SPRING_END_Z),
    SPRINGS_ROOF_Y
  );

  // The head wall, with the mouth cut out of it. Jambs and lintel run out to
  // the same outer plane as everything else back here, so the 52 m face is
  // solid rock either side of a 14 m hole and there is no seam to find.
  walls.push(
    ...buildPortal(
      "springs-head",
      SPRING_END_Z,
      BACK_OUTER_HALF_W,
      BACK_OUTER_TOP_Y,
      SPRINGS_MOUTH_HALF_W,
      SPRINGS_MOUTH_TOP_Y
    )
  );

  // And the throat behind it: SPRINGS_THROAT_LENGTH of flooded passage at the
  // mouth's own section, capped far enough back that the fog eats the cap
  // rather than lighting it. It exists to be looked down, not
  // walked — the walk stops in the opening. What it has to do is be DEEP, so
  // the hole reads as a passage rather than as a niche in a wall.
  const throatEnd = SPRING_END_Z + SPRINGS_THROAT_LENGTH;
  for (const side of [-1, 1] as const) {
    walls.push({
      id: `springs-throat-${side < 0 ? "west" : "east"}`,
      rect: rect(
        side < 0 ? -BACK_OUTER_HALF_W : SPRINGS_MOUTH_HALF_W,
        SPRING_END_Z,
        side < 0 ? -SPRINGS_MOUTH_HALF_W : BACK_OUTER_HALF_W,
        throatEnd
      ),
      baseY: HALL_BASE_Y,
      topY: BACK_OUTER_TOP_Y,
    });
  }
  roof(
    "throat",
    rect(-SPRINGS_MOUTH_HALF_W, SPRING_END_Z, SPRINGS_MOUTH_HALF_W, throatEnd),
    SPRINGS_MOUTH_TOP_Y
  );

  walls.push({
    id: "springs-throat-head",
    rect: rect(
      -SPRINGS_MOUTH_HALF_W,
      throatEnd,
      SPRINGS_MOUTH_HALF_W,
      throatEnd + ROCK_THICKNESS
    ),
    baseY: HALL_BASE_Y,
    topY: BACK_OUTER_TOP_Y,
  });

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
    /**
     * The canyon's shallows. Six metres of standing waist-deep, which is the
     * whole reason this bit is flat: the visitor has to get one good look at a
     * space 48 m across and 58 m tall while the water is still only at their
     * hip. Everything after this is the floor taking that away.
     *
     * Reaches the canyon walls, not the old valley's 40 m. A floor that stops
     * short of the room it is in leaves a slot down to nothing along the base
     * of each wall; over-reach is buried in rock and costs nothing.
     */
    flat(
      "canyon-shallow",
      rect(
        -CANYON_HALF_W - ROCK_THICKNESS,
        ASCENT_END_Z,
        CANYON_HALF_W + ROCK_THICKNESS,
        CANYON_SHALLOW_Z
      ),
      SPRING_FLOOR_Y
    ),
    /**
     * The dive. 16 m of ramp that puts the eye under the line about three
     * paces in and 4.4 m below it by the end, with the canyon walls still the
     * full 48 m apart the whole way. That combination is the beat: the room
     * does not get smaller here, the visitor gets lower — so the last thing
     * they see before the passage starts closing is how much space they are
     * leaving behind.
     */
    ramp(
      "canyon-dive",
      rect(
        -CANYON_HALF_W - ROCK_THICKNESS,
        CANYON_SHALLOW_Z,
        CANYON_HALF_W + ROCK_THICKNESS,
        SUMP_START_Z
      ),
      SPRING_FLOOR_Y,
      CANYON_FLOOR_END_Y
    ),
  ];

  /**
   * The sump floor, sliced to match its walls.
   *
   * Width from the WIDE end of each piece — which here is the NEAR end, since
   * the passage narrows as it goes. (The cave took its width from the far end
   * for the mirror-image reason: it widened.) Getting this backwards leaves a
   * gap between floor and wall at exactly the point the visitor is closest to
   * both of them.
   */
  const sumpSpan = SUMP_END_Z - SUMP_START_Z;
  for (let i = 0; i < SUMP_SLICES; i += 1) {
    const minZ = SUMP_START_Z + (sumpSpan * i) / SUMP_SLICES;
    const maxZ = SUMP_START_Z + (sumpSpan * (i + 1)) / SUMP_SLICES;
    const halfW = sumpHalfWAt(minZ) + ROCK_THICKNESS;
    floorRects.push(
      ramp(
        `sump-floor-${i}`,
        rect(-halfW, minZ, halfW, maxZ),
        sumpFloorYAt(minZ),
        sumpFloorYAt(maxZ)
      )
    );
  }

  /**
   * The springs chamber floor. Flat, and 19 m under a surface that is no
   * longer anywhere — the visitor arrives at the bottom of the piece.
   *
   * Runs the length of the throat as well. Nobody walks there, but everybody
   * looks down it from the mouth, and a passage whose floor stops short would
   * show its own edge at exactly the moment it is meant to read as continuing.
   */
  floorRects.push(
    flat(
      "springs-floor",
      rect(
        -SPRINGS_HALF_W - ROCK_THICKNESS,
        SUMP_END_Z,
        SPRINGS_HALF_W + ROCK_THICKNESS,
        SPRING_END_Z + SPRINGS_THROAT_LENGTH
      ),
      SPRINGS_FLOOR_Y
    )
  );

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
  // Then the rock: a flooded passage that climbs, the room it opens into, the
  // passage that closes over the far end of that room, and the flooded chamber
  // it lets out into.
  wallRects.push(
    ...buildCave(),
    ...buildCanyon(),
    ...buildSump(),
    ...buildSprings()
  );

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
  // against. The far end is the springs chamber's head wall, built with the
  // springs, and deliberately far past the last step.
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
    /**
     * The canyon is flooded wall to wall. It used to be a 9 m hot stream with
     * dry banks either side, which was a stream in a room; now the floor is
     * under the line for every metre of the back half, so the water is simply
     * what the canyon has instead of a ground plane.
     *
     * Seen from below as well as above, because the visitor goes under it
     * about nine metres into the dive and spends the rest of the walk there.
     */
    {
      id: "canyon-water",
      ...rect(-CANYON_HALF_W, ASCENT_END_Z, CANYON_HALF_W, SUMP_START_Z),
      surfaceY: WATERLINE_Y,
      state: "spring",
      seenFromBelow: true,
    },
  ];

  /**
   * The last of the surface, tapering with the passage that holds it.
   *
   * One plane per sump slice, each as wide as its slice, stopping at the metre
   * where the roof comes down to the waterline. Past that there is no plane at
   * all — not a darker one, not a lower one. The piece has exactly one water
   * surface and this is where it runs out of room to exist.
   */
  const sumpSurfaceSpan = SUMP_END_Z - SUMP_START_Z;
  for (let i = 0; i < SUMP_SLICES; i += 1) {
    const minZ = SUMP_START_Z + (sumpSurfaceSpan * i) / SUMP_SLICES;
    if (minZ >= SUMP_SURFACE_END_Z) break;
    const maxZ = Math.min(
      SUMP_START_Z + (sumpSurfaceSpan * (i + 1)) / SUMP_SLICES,
      SUMP_SURFACE_END_Z
    );
    const halfW = sumpHalfWAt(minZ);
    waterPlanes.push({
      id: `sump-water-${i}`,
      ...rect(-halfW, minZ, halfW, maxZ),
      surfaceY: WATERLINE_Y,
      state: "spring",
      seenFromBelow: true,
    });
  }

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
    /**
     * Deep in the springs chamber, not on the old plain. Its former mark —
     * ASCENT_END_Z + 30 — is now inside the sump, where the passage is under
     * 12 m across and the visitor is squeezing past; a performer there would
     * be furniture in a corridor.
     *
     * Placed 18 m into the chamber, which is far enough that the flare has
     * fully opened behind them and the figure is read against the room rather
     * than against the hole they both came out of. Twelve was the first mark
     * and it does not survive the offset below: 11 m to the side of something
     * only 6 m ahead sits 61° off the centreline, which is outside the frame.
     * At 18 m the same offset is 31° — the left third of the shot, opposite
     * the vent, with the door between them.
     *
     * And 11 m off the centreline, which the other two are not. Two reasons,
     * and the second one only appeared once the far end became a door: on the
     * line, the visitor walks THROUGH the performer, and from anywhere in the
     * back half the performer stands squarely in the mouth — a figure blocking
     * the one opening the room is built to hand you to. Off to the left, they
     * are something you pass, with the vent answering them on the right and the
     * way on between the two. See the graybox frame at z 258.
     */
    {
      id: "steam-performer",
      leg: "spring",
      letter: "C",
      effectId: "smoke",
      x: -11,
      z: SUMP_END_Z + 18,
      y: SPRINGS_FLOOR_Y,
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
      SPRING_END_Z + SPRINGS_THROAT_LENGTH + ROCK_THICKNESS
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
      spring: rect(-SPRINGS_HALF_W, ASCENT_END_Z, SPRINGS_HALF_W, SPRING_END_Z),
    },
    surfaceBreak: { x: 0, z: ascent.breakZ, y: SURFACE_BREAK_Y },
    /**
     * The vent column: heat coming off the chamber floor and hitting rock.
     *
     * It used to be a steam plume standing in a shaft of daylight and going up
     * through the roof — the piece's one long sightline, visible from the
     * first step through two portals. That is gone, and both halves of the
     * loss are the point. A column you can see for the whole walk is a
     * promise; a room you cannot see into until you are inside it is a reveal.
     * And a plume that exits through the ceiling asks the visitor to look UP
     * and out, which is an exit — the last thing this room should offer, when
     * its whole job is handing them to the volcano through the far wall.
     *
     * So it starts on the floor 19 m down and stops dead at the roof, because
     * that is what a vent under 19 m of water actually does: the heat has
     * nowhere to go. Set off the centreline so the visitor walks PAST it
     * rather than into it, and so it reads against the far dark rather than
     * against the performer.
     */
    plume: {
      x: 10,
      z: SUMP_END_Z + 20,
      baseY: SPRINGS_FLOOR_Y,
      height: SPRINGS_ROOF_Y - SPRINGS_FLOOR_Y,
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
  if (z < SUMP_START_Z) return "canyon";
  if (z < SUMP_END_Z) return "sump";
  return "springs";
}

/** Where the visitor's head is relative to the one waterline. */
export type WaterRelation = "on" | "in" | "under";

/**
 * On it, in it, or under it — asked of the EYE and the FLOOR, not of the leg.
 *
 * The readout used to key off `legAt`, which is a fact about the route rather
 * than about the person walking it, and it was wrong at both ends of the sea
 * leg: it still said "under the water" for 22 m after the head broke the
 * surface at z 165, and it said "in the water" while the visitor stood 0.7 m
 * above the line. Two positions answer it exactly, and they are both already
 * on hand.
 *
 * The floor test uses the ANALYTIC floor, so the seabed's sculpted relief
 * cannot flip the answer as the visitor crosses a dune.
 */
export function relationToWater(eyeY: number, z: number): WaterRelation {
  if (eyeY < WATERLINE_Y) return "under";
  // Epsilon so the frozen river — walked ON, at exactly the waterline — does
  // not read as wading through itself.
  return baseFloorYAt(z) < WATERLINE_Y - 0.05 ? "in" : "on";
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
  // Continuous, not per-slice: the sump's roof is the number that has to be
  // watched falling, and quantising it to the slice count would report the same
  // headroom for three metres at a time through the one stretch of the walk
  // where the change IS the event.
  if (region === "sump") return sumpRoofYAt(z);
  if (region === "springs") {
    // Under the lintel and beyond it, the mouth's own roof. The walk's last
    // step is inside the opening, so the readout has to report the doorway the
    // visitor is standing in rather than the room behind them.
    return z >= SPRINGS_MOUTH_START_Z ? SPRINGS_MOUTH_TOP_Y : SPRINGS_ROOF_Y;
  }
  return CHAMBER_CEILING[region];
}

/** Half the distance between the walls at this Z. */
export function hallHalfWidthAt(z: number): number {
  const region = regionAt(z);
  if (region === "cave") return caveSliceAt(z).halfW;
  if (region === "canyon") return CANYON_HALF_W;
  if (region === "sump") return sumpHalfWAt(z);
  if (region === "springs") {
    if (z >= SPRINGS_MOUTH_START_Z) return SPRINGS_MOUTH_HALF_W;
    // The flare, then the room. Reported honestly through the opening, since
    // "7 m across" and "52 m across" six paces apart is the whole payoff.
    const t = Math.min(1, (z - SUMP_END_Z) / SPRINGS_FLARE_LENGTH);
    return SUMP_THROAT_HALF_W + (SPRINGS_HALF_W - SUMP_THROAT_HALF_W) * t;
  }
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
