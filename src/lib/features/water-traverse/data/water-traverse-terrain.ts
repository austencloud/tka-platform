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

// buildSeabedMesh deliberately not imported: the seabed is gated off at
// chamber scale until its height field is re-baked (see the note in
// buildWaterTraverseLayout). Only the mesh TYPE is still part of the contract.
import type { SeabedMesh } from "./water-traverse-seabed";

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
  /** Standing surface elevation for this anchor — the dais top. */
  y: number;
  /**
   * The floor of the ring AROUND the dais — where the visitor stands to
   * watch. Since the reverence stations these are different numbers, and
   * anything marking "stop here" belongs at ringY, not y.
   */
  ringY: number;
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
  /**
   * The hand-path station: where Water's teaching starts, BEFORE the first
   * performer. Water's primitive is the split-same hand path itself, so the
   * room opens by showing the path, not a figure doing A — the figure at
   * ICE_PERFORMER_Z then embodies what this already taught. Staged in
   * dual-wheel mode, per Austen (2026-08-11): split-same reads as dual wheels,
   * the exception being sequences that retrace themselves without the arms
   * clipping. This is a DATA anchor only — the scene decides how to draw it,
   * and the graybox draws nothing here yet.
   */
  handPathStation: {
    x: number;
    z: number;
    /** The frozen river's surface — the ice is the natural display plane. */
    y: number;
    /** Radians. Faces back down the route, like the performers. */
    facingAngle: number;
    /** Radius of each wheel of the dual-wheel display, in world metres. */
    wheelRadius: number;
    /** Centre-to-centre spacing of the two wheels, in world metres. */
    wheelGap: number;
  };
  /** Centreline samples along the route, for path checks and camera aims. */
  route: { x: number; z: number; y: number }[];
  legs: Record<Leg, WorldRect>;
  /**
   * Where the visitor's eye breaks a water surface — the piece's one emergence.
   *
   * It used to sit at z 165, on a landing halfway up a cave that climbed out of
   * the sea. That climb is gone (see CAVE_FLOOR_END_Y) and this moved with it:
   * it is now the metre in the springs chamber where the rising floor lifts the
   * eye through the pool, and its `y` is the POOL's surface, not the sea's.
   */
  surfaceBreak: { x: number; z: number; y: number };
  /**
   * The springs: vents on the chamber floor, with the heat standing over each.
   *
   * Plural, and that is the whole correction. One column in the middle of a
   * room is a monument; a scatter of them coming off a floor that is climbing
   * past you is a source.
   */
  vents: {
    x: number;
    z: number;
    baseY: number;
    height: number;
    radius: number;
    /**
     * The grade of the floor the vent's mouth lies in, in radians.
     *
     * Carried in the data rather than recomputed by the renderer because the
     * floor's shape is the terrain's business and a mouth that lies FLAT in a
     * floor tilted 18° buries half of itself and floats the other half — which
     * is the exact clipping the graybox is meant to be free of.
     */
    floorPitch: number;
  }[];
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

/**
 * ── The size of the world ───────────────────────────────────────────────────
 *
 * One factor on every dimension in this file — a GROW knob, not the design.
 *
 * The design is now authored at chamber scale: 58 m nose to door, the length
 * of the Fire court, per Austen (2026-08-11): "make the 3-element walk much
 * smaller, like the same length as fire and earth." The first authored size
 * was 284 m; a 0.6 scale pass proved the walk at 170 m and proved with it that
 * 170 m of one room is a hike, not a chamber. This rewrite moves the shrink
 * out of the knob and into the base metres, because a 3× compression is not a
 * scale — the visitor's eye does not shrink, so depths, clearances and grades
 * all had to be re-derived against a full-sized person in a one-room world.
 *
 * So at 1.0 every metre in this file is an honest metre. The knob remains for
 * the day the room earns growth ("we'll fill it in later and maybe expand it").
 * Uniform scale UP preserves every relation verified here; scale DOWN runs
 * into the two eye-height floors, both derived on SPRINGS_WATER_Y.
 *
 * TWO THINGS DO NOT SCALE, and they are the two that are not part of the world:
 *
 *   WATERLINE_Y      the datum everything is measured from, and 0 × anything
 *                    is 0. Named here because it looks like an omission.
 *   EYE_ABOVE_FLOOR  the visitor. A person does not get smaller because the
 *                    room did. Walking speed (WaterTraverseWalkScene) is the
 *                    same kind of constant and is left alone for the same
 *                    reason.
 */
export const WORLD_SCALE = 1.0;

/** Metres, scaled. Every dimension in this file is authored through it. */
function m(metres: number): number {
  return metres * WORLD_SCALE;
}

/** Snow sits a little proud of the ice so the river reads as a cut ribbon. */
export const SNOW_Y = WATERLINE_Y + m(0.28);
/**
 * The sea floor. Deep enough that the surface overhead reads as a sky:
 * 3.4 m of water over the eye, which is the least this room can carry and
 * still put the surface out of reach.
 */
export const SEA_FLOOR_Y = -m(5);
/**
 * Floor at the cave's far end. The passage DESCENDS — under a metre over
 * nine, a grade you feel underfoot without ever seeing it as a ramp.
 *
 * It used to CLIMB seventeen metres, to −0.9, and put the visitor's head back
 * out of the water at z 165 on a flat landing. That was the piece's centrepiece
 * for as long as the walk ended above the line. Once the far end became a door
 * at −19 the climb stopped being a summit and became a detour, and the profile
 * read as a W: down eighteen, up seventeen, down twenty-nine, up eleven. Walked,
 * the middle of that is "why am I climbing out of the sea in order to be put
 * back into it."
 *
 * The surface break was not deleted. It was moved to the room it belongs in —
 * see SPRINGS_WATER_Y — so the walk now goes down once and comes up once, and
 * the coming up is the last thing that happens.
 */
export const CAVE_FLOOR_END_Y = WATERLINE_Y - m(5.8);

// ── Plan ────────────────────────────────────────────────────────────────────

/**
 * Half-width of the walkable floor, per leg. Three landscapes have to be three
 * SHAPES, not one corridor with three palettes: the snowfield is a wide basin
 * you cross, the trench is a defile you are down inside, and the geothermal
 * plain opens out again. The narrowing at the descent is what makes the drop
 * feel like a gorge closing before it lets go.
 */
const SNOW_HALF_W = m(9);
const SEA_HALF_W = m(8);
/** Widest of the three; only used for whole-route bounds. */
const VALLEY_HALF_W = m(9);
/** Ridge walls that contain the walk without ever being the subject. */
const RIDGE_THICKNESS = m(2.5);
const SNOW_RIDGE_TOP = SNOW_Y + m(5);
/**
 * The seabed ridges top out BELOW the waterline on purpose. Built to the same
 * height as the snowfield's they made a roofed canyon: from the trench floor the
 * entire upper frame was unlit rock, the surface was never visible, and the
 * middle leg read as a slot you were trapped in rather than the floor of a
 * sea. Keeping them under the line means every upward glance down there ends
 * in open water and the light coming through it.
 */
const SEA_RIDGE_TOP = WATERLINE_Y - m(1.2);
/** The gorge walls at the descent: high enough to funnel, too low to roof. */
const DESCENT_RIDGE_TOP = SNOW_Y + m(3);

/** The watercourse: one ribbon, constant width, centred on x = 0 throughout. */
export const CHANNEL_HALF_W = m(2.2);

/**
 * The ring stations (reverence decision, 2026-08-11): each performer stands on
 * a platform in the middle of the pathway, and the path splits around it and
 * rejoins. The same shape three times is what makes it a grammar — by the
 * third ring, walking around a platform MEANS "a letter lives here."
 *
 * The rise is the enforcement. The character controller autosteps 0.45 m, so
 * a 0.9 m riser cannot be climbed or ignored — walking around is the only way
 * past, which is exactly what "unmissable" asks for. Platform footprints share
 * one size; what differs per station is the water each dais stands in.
 */
const STATION_DAIS_HALF_W = m(1.2);
const STATION_DAIS_RISE = m(0.9);
/**
 * Station A's frozen pool: the river cut widens from ±2.2 to ±4.5 around the
 * dais, leaving a 3.3 m ice ring on either side. Starts past the hand-path
 * station's wheels (they reach z 4.4) and ends clear of the ice→sea portal.
 */
const STATION_A_POOL_MIN_Z = m(4.5);
const STATION_A_POOL_MAX_Z = m(8.5);
const STATION_A_POOL_HALF_W = m(4.5);

/**
 * Leg lengths, at chamber scale: 58 m nose to door, the Fire court's length.
 * Every leg is now a STATION rather than a stretch — the walk is 14 seconds
 * of holding W, and the time the room takes is the time spent stopping. The
 * descent's grade is the number that resisted compression hardest: 5.3 m of
 * drop over 10 m of run is 28°, and shortening the ramp further turns the
 * gorge into a cliff face with a path drawn on it.
 */
const SNOW_START_Z = 0;
const SNOW_END_Z = m(10);
const DESCENT_END_Z = m(20);
const SEA_END_Z = m(27);
/**
 * The last step. Written out at full size rather than derived from SUMP_END_Z
 * because that constant is declared with the rest of the sump, below, and a
 * module-scope const cannot read one that has not been initialised yet. The
 * arithmetic it stands for: 48 (sump end) + 10 m of springs chamber, before
 * scale. Both ends go through m(), so the seam stays exact at any WORLD_SCALE.
 */
const SPRING_END_Z = m(58);

/**
 * The cave: from the sea hall's end wall to the canyon's near one.
 *
 * Its far end used to be called ASCENT_END_Z, which was accurate while this run
 * was a climb. The name went with the climb.
 */
const CAVE_START_Z = SEA_END_Z;
const CAVE_END_Z = m(36);

export const TOTAL_LENGTH_M = SPRING_END_Z;

/**
 * ── Six spaces ──────────────────────────────────────────────────────────────
 *
 * The route used to climb down into the sea and climb straight back out into
 * an open geothermal plain: three rooms in a row, each bigger than the last,
 * no compression anywhere, and 24 m of empty ground after the payoff.
 *
 * It now goes down ONCE and stays down. The floor falls from the frozen river
 * to the sea, keeps falling through the cave, keeps falling across the canyon,
 * and bottoms out in the sump — and the only climb anywhere in the piece is the
 * one that carries the visitor out of the water at the very end:
 *
 *   snowfield   a basin you cross             wide, roofed, man-made
 *   sea         a hangar you are down inside  vast, roofed, man-made
 *   cave        a flooded passage that sinks  tight and dark
 *   canyon      the one big look              vast, all rock, all under water
 *   sump        the roof comes down to meet the water and then goes under it
 *   springs     a pool, a shore, and a door   where the heat is
 *
 * The shape is big → big → small → BIG → smallest → big. Two squeezes, and the
 * second one is worse than the first: the cave you could stand up in, the sump
 * you cannot, and the sump is nearly nine metres under a surface you have not
 * seen since the canyon. Coming out of that into the springs is the payoff the room
 * is built for — and the springs are where the head finally comes back up.
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
  snowfield: WATERLINE_Y + m(7),
  sea: WATERLINE_Y + m(13),
};
/**
 * Hall half-width per chamber. These sit OUTSIDE the ridge blocks, which reach
 * roughly 74 m at their deepest, so the peaks stand inside the room rather
 * than punching through its walls.
 */
export const CHAMBER_HALF_W: Record<HallRegion, number> = {
  snowfield: m(14),
  sea: m(18),
};
/** Chamber extents along Z. The seams are where the portals stand. */
const CHAMBER_Z: Record<HallRegion, [number, number]> = {
  snowfield: [SNOW_START_Z, SNOW_END_Z],
  sea: [SNOW_END_Z, CAVE_START_Z],
};

// ── The cave ────────────────────────────────────────────────────────────────

/**
 * Sixty-six metres inside rock, flooded to the roof for every one of them.
 *
 * The trench's far wall closes into a face with a hole at its foot, and the
 * walk goes into it. Nothing about the cave asks to be looked at: the floor
 * sinks three metres, the walls open from 12 m across to 24, and the roof is
 * never more than twelve metres over the visitor's head. It is the corridor
 * between the last man-made room and the first natural one, and its whole job
 * is to be under water the entire way — no surface, no air, no relief.
 */
const CAVE_SLICES = 6;
/**
 * Half-width at the mouth and at the canyon end. The passage doubles as it
 * runs, so the release starts before the canyon does.
 *
 * The first attempt used 13 → 21, giving a passage 31 m wide and 13 m tall.
 * Walked, that is a road tunnel: at a 40 m sightline a 13 m roof sits only 18
 * degrees above the eye, which puts it in the top fifth of the frame where it
 * exerts no pressure at all. Tightness is an ANGLE, not a metre count — the
 * roof and walls have to be far enough into peripheral vision to be felt. At
 * 12 m across the channel itself is 9 of them, which is the right relationship
 * for a flooded slot: the water fills the passage and you wade up it.
 */
const CAVE_HALF_W_MOUTH = m(2.2);
const CAVE_HALF_W_INNER = m(3.5);
/**
 * Headroom at the mouth and at the canyon end, measured at each slice's FAR
 * end so the number is the worst case in that slice rather than the best. Six
 * metres, under a hall that is seventy, is the squeeze the walk was missing.
 */
const CAVE_CLEARANCE_MOUTH = m(3);
const CAVE_CLEARANCE_INNER = m(4.6);
const ROCK_THICKNESS = m(3);

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
const CANYON_HALF_W = m(4.5);
const CANYON_ROOF_Y = WATERLINE_Y + m(12);
/**
 * Floor at the canyon's far end: the descent carrying on, half a metre over
 * five, with the walls the full 9 m apart the whole way.
 *
 * It was −6, the bottom of a dive that began waist-deep at −0.9, and both of
 * those numbers belonged to the version where the cave climbed out of the sea.
 * The visitor now arrives here through a 7 m hole in the near wall, and the
 * canyon's one job is the look UP: 12 m of rock overhead, and the sea's
 * surface nearly five metres of water above the eye — visible, lit, and
 * completely out of reach.
 */
const CANYON_FLOOR_END_Y = WATERLINE_Y - m(6.3);

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
 *
 * And the sump is the BOTTOM. Everything from here rises again — see the
 * springs. The first cut ran the back half dead flat at −19 from the pinch to
 * the door, which is a descent followed by a corridor, and a corridor is not a
 * spring. The pinch is the low point of the walk; the chamber climbs out of it.
 */
const SUMP_START_Z = m(41);
const SUMP_END_Z = m(48);
/**
 * Floor at the pinch: 8.8 m under the line, and the deepest metre of the piece.
 *
 * It was 19, which was chosen when the chamber beyond it was flat and 19 was
 * therefore also the floor of every remaining metre. Once the chamber climbs,
 * this number stops being a depth and becomes an AMPLITUDE — how far down you
 * go in order to have somewhere to come back up from. Eleven metres of rise
 * over the chamber is enough to read on the depth readout and in the grade
 * underfoot; less than that and the climb is deniable.
 *
 * It cannot be bought at the other end instead. The whole back half is under
 * a waterline at y = 0 and has to stay there, so raising the door raises the
 * mouth's lintel into the surface. The rise has to be paid for by going deeper.
 */
const SUMP_FLOOR_END_Y = WATERLINE_Y - m(8.8);
/**
 * The pinch. 7 m across with 3.5 m of headroom, tighter than the cave's 12 × 6,
 * because the cave already spent that card: a second squeeze that is not worse
 * than the first one is not a squeeze, it is a repeat.
 */
const SUMP_THROAT_HALF_W = m(2);
/**
 * The one dimension in this file with a floor under it, and the exception
 * proves the rule that produced it.
 *
 * Every other measure here is compared against another measure, so uniform
 * scale preserves it. This one is compared against the VISITOR, who does not
 * scale — and the visitor is a camera at eye height with no crouch, so the
 * roof's whole job is to be low without being in their face.
 *
 * Pure scaling got that wrong once already (0.5 m over the eye at the old 0.6
 * pass): 0.5 m of air over a camera is not a squeeze you feel, it is a black
 * slab across the top half of the frame with the springs opening hidden behind
 * it. Screenshot from that pass: unlit ceiling filling 45% of the view, the
 * room beyond invisible. Claustrophobia you cannot see out of is a blind spot.
 *
 * So the clearance is whichever is larger: the scaled value, or enough air to
 * stoop under. PINCH_OVER_EYE is that second term — a metre, which reads as
 * duck-your-head and still leaves a letterbox onto what comes next.
 *
 * At chamber scale the two terms MEET: the authored clearance is the eye
 * floor, 2.6 m, duck-your-head with a letterbox onto what comes next. Grow the
 * world and the scaled term takes over; shrink it and the floor holds.
 */
const PINCH_OVER_EYE = 1.0;
const SUMP_THROAT_CLEARANCE = Math.max(
  m(2.6),
  EYE_ABOVE_FLOOR + PINCH_OVER_EYE
);
/**
 * How hard the closing is front-loaded. Both are eased rather than linear
 * because linear from 18 m of roof spends three quarters of the run still
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
 * Slices. Set by step size, not by count: axis-aligned slabs approximating a
 * curve read as strata when each step is under half a metre and as a STAIRCASE
 * when each step is five. Sixteen over the 7 m run keeps the step a hair under
 * 0.45 m — the same stratum size the 284 m original proved out at 24 slices
 * over its 38 m fall.
 */
const SUMP_SLICES = 16;

/**
 * ── The springs ─────────────────────────────────────────────────────────────
 *
 * The sump lets out into a chamber 16 m across with a pool in the near half of
 * it and a shore in the far half. The vents are on its floor — some under the
 * water, some out of it — and the heat goes UP into rock instead of out into
 * sky.
 *
 * And the floor CLIMBS. That is the half this room was missing, and it is the
 * half that makes the word "springs" true. A spring is not a body of water, it
 * is a direction: something arriving from below. If the visitor walks in on
 * the flat, the only thing rising in the room is a decoration, and the room is
 * a flooded hall that happens to have a column in it.
 *
 * So the shape of the back half is a U. Down through the canyon, down through
 * the sump, the pinch at the bottom of it, and then ten metres of climb out —
 * with the vents coming up off that rising floor alongside you and the roof
 * staying flat overhead, which is the only reference you have down here that
 * the ground is moving and you are moving with it.
 *
 * And the climb crosses a SURFACE, which is the thing the first cut of this
 * room could not do. Four and a half metres of rise under a roof is a number
 * on a readout; four and a half metres of rise that takes your head out of the
 * water, at a line you can see, with the far half of the walk in air, is the
 * ending. See SPRINGS_WATER_Y.
 *
 * The roof stays put on purpose. If the ceiling climbed too, the section would
 * be constant and the ascent would be invisible: no horizon, no sky, nothing
 * to measure against. A flat roof that the floor comes up to meet turns the
 * climb into something you can SEE, as the 27 m of headroom at the flare
 * closes to 16 at the door.
 *
 * This chamber is the volcano's first room, and the door is at the top of the
 * climb — so the handoff happens already ascending, and Fire carries it on up.
 */
const SPRINGS_HALF_W = m(8);
const SPRINGS_ROOF_Y = WATERLINE_Y - m(1.4);
/**
 * Floor at the DOOR — the top of the climb, not the level of the room.
 *
 * 1.4 m above the pool, so the walk finishes on dry rock with the water it
 * just left visibly below and behind. The last metres before the door are the
 * only dry floor in the back half of the piece.
 */
const SPRINGS_FLOOR_Y = WATERLINE_Y - m(4.2);

/**
 * The pool: a SECOND water surface, 5.6 m under the first one, and the only
 * place in the piece where the visitor's head comes back out.
 *
 * Beyond a sump the passage is sealed and the air already inside the mountain
 * has nowhere to go, so the chamber past it holds its own standing level under
 * its own air bell. That is ordinary karst, and here it is the ONLY thing that
 * can give this room an emergence: the chamber's roof is at −1.4, so no amount
 * of climbing inside it could ever cross y = 0.
 *
 * −5.6 is placed by two constraints and nothing else, both measured against a
 * visitor who does not scale:
 *
 *   It has to DROWN the sump's exit. The roof at the pinch is the floor plus
 *   the eye clearance: −8.8 + 2.6 = −6.2. The pool sits 0.6 m over that, so
 *   the visitor comes through the hole still fully under water with no seam
 *   to notice.
 *
 *   It has to put the crossing MID-ROOM rather than at either wall. Leaving
 *   the sump the eye is at −7.2 — 1.6 m under the pool — the break lands at
 *   z ≈ 51.5, a third of the way up the chamber; the shore at z ≈ 55; and the
 *   walk finishes 1.4 m above the pool at the door. Wade between break and
 *   shore: about three and a half metres.
 *
 * These margins are authored at WORLD_SCALE 1 and both GROW with the world.
 * Shrinking below 1 shrinks the water while SUMP_THROAT_CLEARANCE's eye floor
 * holds the roof up — the 0.6 m drown margin closes fast. Do not scale this
 * world down; grow it or re-derive it.
 */
const SPRINGS_WATER_Y = WATERLINE_Y - m(5.6);

/** Where the springs floor reaches a given elevation. Inverse of springsFloorYAt. */
function springsZAtFloorY(y: number): number {
  const t = (y - SUMP_FLOOR_END_Y) / (SPRINGS_FLOOR_Y - SUMP_FLOOR_END_Y);
  return SUMP_END_Z + t * (SPRING_END_Z - SUMP_END_Z);
}

/**
 * The two metres that matter in this room, both solved rather than authored.
 *
 * The break is where the EYE crosses the pool — the walk's one emergence, and
 * the moment the readout stops saying "under". The shore is where the FLOOR
 * crosses it, which is the last step out of the water and the far edge of the
 * pool's own plane. The gap between them is how far the visitor wades.
 */
const SPRINGS_BREAK_Z = springsZAtFloorY(SPRINGS_WATER_Y - EYE_ABOVE_FLOOR);
const SPRINGS_SHORE_Z = springsZAtFloorY(SPRINGS_WATER_Y);

/** The flare: how far it takes to go from the throat to the full chamber. */
const SPRINGS_FLARE_LENGTH = m(2);
/** Steps the flare's walls, roof and pool are all cut into. */
const SPRINGS_FLARE_SLICES = 3;

/**
 * The far end is not a taper. It is a door.
 *
 * What this replaces converged the walls past the last step and capped them a
 * few metres beyond it — the trick the canyon's head wall gets away with,
 * because there the cap is a small rectangle low in a very tall frame. It does
 * not survive being moved here. This chamber is under 3 m from floor to roof
 * at the door, so a near cap fills the frame: at the last step it is not a
 * distant continuation, it is a WALL, and the frame reads as the back of a
 * room. Which is the one thing the far end cannot say, because the far end is
 * the handoff.
 *
 * So the chamber ends in a face with a mouth in it — 5 m across and 2.6 m
 * tall, human-scaled at last, sitting on the floor of a wall 16 m wide — and a
 * flooded throat runs on into the dark behind it. A hole reads as somewhere to
 * go in a way no taper does, and the last step of the water walk lands in it.
 * It is also the first DOORWAY the visitor has fit since the lobby, which is
 * the right note to hand to Fire on.
 */
const SPRINGS_MOUTH_HALF_W = m(2.5);
const SPRINGS_MOUTH_TOP_Y = SPRINGS_FLOOR_Y + m(2.6);
/**
 * Twenty-five metres of throat, and the length is doing one job: the cap has
 * to be far enough away that the fog takes it, or the end wall comes back as
 * the BRIGHTEST surface in the frame — a lit rectangle at the end of the
 * tunnel, which says daylight. Through a 2.6 m mouth the sightline is short
 * and low, so 25 m buys the same darkness 60 bought the full-size door.
 * Nobody walks this passage; its only cost is a few rects.
 */
const SPRINGS_THROAT_LENGTH = m(25);

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

const HALL_THICKNESS = m(2);
/**
 * The lowest floor anywhere. Walls are built down to it so none of them float.
 *
 * Keyed to the sump's pinch rather than to the sea floor, because the pinch is
 * now 12 m deeper than the sea and every wall in the back half stands in the
 * same trench. Keyed to the sea it would have left the springs chamber's walls
 * starting 10 m above their own floor — a band of open nothing running the
 * length of a room the visitor walks the whole way down.
 */
const HALL_BASE_Y = SUMP_FLOOR_END_Y - m(2);

/**
 * The near face of the head-wall portal — where the chamber's roof actually
 * becomes the mouth's 2.6 m. Declared here rather than beside the other
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
 * axis-aligned box and the floor beneath it is on a grade. Six stepped slices
 * give a roof that follows the floor without a single one of them lying about
 * the clearance: each slice's roof is set from the floor at its HIGH end, so
 * the stated headroom is the tightest point in that slice and every other point
 * in it has more.
 *
 * The high end is now the NEAR one. It used to be the far one, because this run
 * used to climb; taking the roof off `maxZ` after the floor was turned around
 * would have quoted each slice's most generous metre as its worst, and every
 * slice would have been half a metre tighter than it claimed.
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
    roofY: baseFloorYAt(minZ) + clearance,
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

/** The cave tube: rock either side and rock overhead, for 9 m. */
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
 * The springs floor: the climb out, and the second half of the U.
 *
 * One straight grade from the pinch at −8.8 to the door at −4.2 — 4.6 m of
 * rise over 10 m, about 25°. Steep enough to be felt underfoot and to move
 * the depth readout a metre every couple of paces, shallow enough that it is a
 * floor rather than a ramp you notice as an object.
 *
 * Clamped past the door, so the throat behind the mouth runs on flat. The
 * visitor never stands there; what matters is that the floor they are looking
 * down does not keep tilting away, which would turn a passage into a chute.
 */
function springsFloorYAt(z: number): number {
  const t = Math.max(
    0,
    Math.min(1, (z - SUMP_END_Z) / (SPRING_END_Z - SUMP_END_Z))
  );
  return SUMP_FLOOR_END_Y + (SPRINGS_FLOOR_Y - SUMP_FLOOR_END_Y) * t;
}

/**
 * Half-width of the springs chamber at world Z: the flare, then the room, then
 * the mouth.
 *
 * One owner for a number three different things need — the chamber's walls, the
 * HUD's hall-width readout, and the pool's own extent. It was written out twice
 * before the pool needed it a third time, which is exactly the point at which a
 * duplicated formula becomes a bug waiting for somebody to retune one copy.
 */
function springsHalfWAt(z: number): number {
  if (z >= SPRINGS_MOUTH_START_Z) return SPRINGS_MOUTH_HALF_W;
  const t = Math.max(0, Math.min(1, (z - SUMP_END_Z) / SPRINGS_FLARE_LENGTH));
  return SUMP_THROAT_HALF_W + (SPRINGS_HALF_W - SUMP_THROAT_HALF_W) * t;
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
 * — and the floor is falling at the same time. Eased hard: linear from 18 m
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
 * The canyon: two rock walls and a roof, for 5 m.
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

  for (let i = 0; i < SPRINGS_FLARE_SLICES; i += 1) {
    const minZ = SUMP_END_Z + (SPRINGS_FLARE_LENGTH * i) / SPRINGS_FLARE_SLICES;
    const maxZ =
      SUMP_END_Z + (SPRINGS_FLARE_LENGTH * (i + 1)) / SPRINGS_FLARE_SLICES;
    const t = (i + 1) / SPRINGS_FLARE_SLICES;
    const halfW = springsHalfWAt(maxZ);
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
  // the same outer plane as everything else back here, so the 16 m face is
  // solid rock either side of a 5 m hole and there is no seam to find.
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
 * A vent on the springs floor.
 *
 * Its base comes off the climbing floor rather than off a constant, and its
 * height is a FRACTION of the clearance over it rather than a number of metres.
 * Both for the same reason: the ground under this room moves 4.6 m between its
 * near end and its far one. An absolute column authored at the flare is a
 * full-height plume there and pokes through the ceiling once the floor has
 * climbed to meet it.
 */
/**
 * Position, spread and radius are authored in chamber-scale metres and scaled
 * here, so the seven call sites below stay legible against their own comments
 * ("x ±3.6", "z 56.5", "~8 m ahead") whatever WORLD_SCALE is. `rise` is a
 * FRACTION of the gap to the roof, so it is already scale-free and must not be
 * touched.
 */
function vent(x: number, z: number, rise: number, radius: number) {
  const worldZ = m(z);
  const baseY = springsFloorYAt(worldZ);
  // Sampled over a real metre. The springs floor is a straight ramp, so one
  // metre of run reports its exact grade at any scale.
  const ahead = springsFloorYAt(worldZ + 1) - baseY;
  return {
    x: m(x),
    z: worldZ,
    baseY,
    radius: m(radius),
    height: (SPRINGS_ROOF_Y - baseY) * rise,
    floorPitch: Math.atan2(ahead, 1),
  };
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
const RIDGE_HEADROOM = m(1.5);

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
  const BLOCK = m(5);
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
      // instead of running at one width for the whole leg.
      const inset = m(-1 + jitter(seed + 11) * 3.5);
      const depth = RIDGE_THICKNESS + m(jitter(seed + 23) * 5);
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
  const full = rect(-SEA_HALF_W, 0, SEA_HALF_W, 0);

  const floorRects: FloorRect[] = [
    // The frozen river is a CUT, not a stripe painted on the snow: banks stand
    // proud of it, and the walkable ice is the waterline itself. Without the
    // cut the surface disappears under the snow slab and the first landscape
    // loses the only thing it is about.
    //
    // At station A the cut widens into a pool, so each snow slab is three
    // rects — bank, bank pulled back beside the pool, bank again — and the ice
    // bed is three to match. The 0.28 m the snow stands proud becomes the
    // pool's rim for free.
    flat(
      "snowfield-west-in",
      rect(-SNOW_HALF_W, SNOW_START_Z, -CHANNEL_HALF_W, STATION_A_POOL_MIN_Z),
      SNOW_Y
    ),
    flat(
      "snowfield-west-pool",
      rect(
        -SNOW_HALF_W,
        STATION_A_POOL_MIN_Z,
        -STATION_A_POOL_HALF_W,
        STATION_A_POOL_MAX_Z
      ),
      SNOW_Y
    ),
    flat(
      "snowfield-west-out",
      rect(-SNOW_HALF_W, STATION_A_POOL_MAX_Z, -CHANNEL_HALF_W, SNOW_END_Z),
      SNOW_Y
    ),
    flat(
      "snowfield-east-in",
      rect(CHANNEL_HALF_W, SNOW_START_Z, SNOW_HALF_W, STATION_A_POOL_MIN_Z),
      SNOW_Y
    ),
    flat(
      "snowfield-east-pool",
      rect(
        STATION_A_POOL_HALF_W,
        STATION_A_POOL_MIN_Z,
        SNOW_HALF_W,
        STATION_A_POOL_MAX_Z
      ),
      SNOW_Y
    ),
    flat(
      "snowfield-east-out",
      rect(CHANNEL_HALF_W, STATION_A_POOL_MAX_Z, SNOW_HALF_W, SNOW_END_Z),
      SNOW_Y
    ),
    flat(
      "frozen-river-bed-in",
      rect(-CHANNEL_HALF_W, SNOW_START_Z, CHANNEL_HALF_W, STATION_A_POOL_MIN_Z),
      WATERLINE_Y
    ),
    flat(
      "frozen-pool-bed",
      rect(
        -STATION_A_POOL_HALF_W,
        STATION_A_POOL_MIN_Z,
        STATION_A_POOL_HALF_W,
        STATION_A_POOL_MAX_Z
      ),
      WATERLINE_Y
    ),
    flat(
      "frozen-river-bed-out",
      rect(-CHANNEL_HALF_W, STATION_A_POOL_MAX_Z, CHANNEL_HALF_W, SNOW_END_Z),
      WATERLINE_Y
    ),
    ramp(
      "descent",
      { ...full, minZ: SNOW_END_Z, maxZ: DESCENT_END_Z },
      SNOW_Y,
      SEA_FLOOR_Y
    ),
    flat("sea-floor", { ...full, minZ: DESCENT_END_Z, maxZ: SEA_END_Z }, SEA_FLOOR_Y),
    /**
     * The cave: one ramp, sixty-six metres, three metres down.
     *
     * One rect and not six, for the same reason the springs chamber is one: a
     * `ramp-z` IS the slope. The cave used to be cut at the union of its slice
     * boundaries and a three-segment elevation profile, because the profile had
     * a flat landing in the middle of it. There is no landing any more, so
     * there is nothing to cut for.
     *
     * Width taken at the passage's WIDEST, plus the rock. The extra metres at
     * the mouth end are buried inside the wall and cost nothing; falling short
     * would leave a slot along the base of the passage to drop through.
     */
    ramp(
      "cave-floor",
      rect(
        -CAVE_HALF_W_INNER - ROCK_THICKNESS,
        CAVE_START_Z,
        CAVE_HALF_W_INNER + ROCK_THICKNESS,
        CAVE_END_Z
      ),
      SEA_FLOOR_Y,
      CAVE_FLOOR_END_Y
    ),
    /**
     * The canyon: the same descent, still going, across the one room in the
     * piece with any air in it.
     *
     * It used to be two rects — six flat metres of standing waist-deep, then a
     * 16 m dive that put the visitor under. Both of those existed to spend the
     * altitude the cave's climb had just bought. Nothing is bought and nothing
     * is spent now: the floor keeps doing the single thing it has done since
     * the snowfield, and the room's whole event is what is overhead.
     *
     * Reaches the canyon walls, not the old valley's 40 m. A floor that stops
     * short of the room it is in leaves a slot down to nothing along the base
     * of each wall; over-reach is buried in rock and costs nothing.
     */
    ramp(
      "canyon-floor",
      rect(
        -CANYON_HALF_W - ROCK_THICKNESS,
        CAVE_END_Z,
        CANYON_HALF_W + ROCK_THICKNESS,
        SUMP_START_Z
      ),
      CAVE_FLOOR_END_Y,
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
   * The springs chamber floor: one ramp, climbing 4.6 m from the pinch to the
   * door. The visitor arrives at the bottom of the piece and walks back up out
   * of it.
   *
   * One rect and not a stack of slices, because a `ramp-z` IS the slope — the
   * sump is sliced only because its WIDTH changes down the run and an
   * axis-aligned rect cannot taper. This chamber is the same 16 m wide the
   * whole way, so slicing it would buy a staircase where a plane already fits.
   */
  floorRects.push(
    ramp(
      "springs-floor",
      rect(
        -SPRINGS_HALF_W - ROCK_THICKNESS,
        SUMP_END_Z,
        SPRINGS_HALF_W + ROCK_THICKNESS,
        SPRING_END_Z
      ),
      springsFloorYAt(SUMP_END_Z),
      springsFloorYAt(SPRING_END_Z)
    )
  );

  /**
   * And the throat's floor, flat at the door's level.
   *
   * Nobody walks there, but everybody looks down it from the mouth, and a
   * passage whose floor stops short would show its own edge at exactly the
   * moment it is meant to read as continuing. Flat rather than still climbing
   * because a floor that keeps tilting away past the doorway reads as a chute,
   * and the next room is meant to be somewhere you walk into.
   */
  floorRects.push(
    flat(
      "springs-throat-floor",
      rect(
        -SPRINGS_HALF_W - ROCK_THICKNESS,
        SPRING_END_Z,
        SPRINGS_HALF_W + ROCK_THICKNESS,
        SPRING_END_Z + SPRINGS_THROAT_LENGTH
      ),
      SPRINGS_FLOOR_Y
    )
  );

  return floorRects;
}

export function buildWaterTraverseLayout(): WaterTraverseLayout {
  const floorRects: FloorRect[] = buildBaseFloorRects();

  // GATED OFF at chamber scale: the baked height field runs z 52 → 189.7 at
  // ±42 m — coordinates from the old 170 m open-water trench. On the 58 m walk
  // that entire field lies BEYOND the springs head wall, so loading it would
  // drape phantom dune relief through solid rock and over nothing the visitor
  // can reach. An empty mesh keeps the layout shape stable while saying so.
  // scripts/traverse_seabed.py has to re-bake against the new SEA leg extents
  // (z 20 → 27) before any art pass turns this back on.
  const seabedMesh: SeabedMesh = {
    vertices: new Float32Array(0),
    indices: new Uint32Array(0),
    triangleCount: 0,
  };

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
      m(6),
      WATERLINE_Y + m(6)
    ),
    // The cave mouth: a 4.4 m hole at the foot of a wall 36 m across. It has
    // to be small enough that the sea hall reads as ending, and it has to sit
    // on the FLOOR — a cave you enter through an arch halfway up a wall is a
    // doorway with rock texture on it.
    ...buildPortal(
      "cave-mouth",
      CAVE_START_Z,
      CHAMBER_HALF_W.sea,
      CHAMBER_CEILING.sea,
      CAVE_HALF_W_MOUTH,
      mouth.roofY
    ),
    // Cave → canyon. The reveal: you leave a 7 m tube through a hole in the
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
   * TWO surfaces, and the second one is the ending.
   *
   * y = 0 is the sea, and it runs from the frozen river the visitor walks on,
   * over the trench they walk under, to the last metre of the sump where the
   * rock roof comes down and meets it. There is no water surface anywhere in
   * the cave: that passage is flooded to its ceiling for all 9 m, which is
   * exactly what makes it a passage rather than a beach.
   *
   * SPRINGS_WATER_Y is the pool in the last room, five and a half metres
   * lower, sealed under its own air bell behind the sump. It is the only
   * surface the visitor's head comes back through, and by construction it is
   * the last thing that happens to them in this piece.
   */
  const waterPlanes: WaterPlane[] = [
    // Ribbon, pool, ribbon — the same split as the ice bed under it, because a
    // single full-length plane would z-fight the wider pool plane where they
    // overlap.
    {
      id: "frozen-river-in",
      ...rect(-CHANNEL_HALF_W, SNOW_START_Z, CHANNEL_HALF_W, STATION_A_POOL_MIN_Z),
      surfaceY: WATERLINE_Y,
      state: "ice",
      seenFromBelow: false,
    },
    {
      id: "frozen-pool",
      ...rect(
        -STATION_A_POOL_HALF_W,
        STATION_A_POOL_MIN_Z,
        STATION_A_POOL_HALF_W,
        STATION_A_POOL_MAX_Z
      ),
      surfaceY: WATERLINE_Y,
      state: "ice",
      seenFromBelow: false,
    },
    {
      id: "frozen-river-out",
      ...rect(-CHANNEL_HALF_W, STATION_A_POOL_MAX_Z, CHANNEL_HALF_W, SNOW_END_Z),
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
    /**
     * The canyon, flooded wall to wall, with its surface nearly five metres
     * over the visitor's head and 12 m of rock over that.
     *
     * There is no plane over the cave between these two. The cave's roof runs
     * from −2.0 at the mouth to −1.2 at the far end, so the passage is under
     * the line for its whole length and has no surface to draw — the sea does
     * not stop there, the AIR does. Which makes this plane the first water the
     * visitor has seen since z 27, arriving overhead through a 7 m hole, at
     * the exact moment the room they are in becomes tall.
     */
    {
      id: "canyon-water",
      ...rect(-CANYON_HALF_W, CAVE_END_Z, CANYON_HALF_W, SUMP_START_Z),
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
   * The pool: the near half of the springs chamber, from the sump's mouth to
   * the metre where the climbing floor comes up through it.
   *
   * Sliced across the flare for the same reason the flare's walls are — the
   * room opens from 4 m across to 16 in two paces, and a single rect at the
   * full width would leave metres of water plane hanging inside solid rock on
   * either side of the throat.
   *
   * Seen from below AND above, and that is the whole point of it: the visitor
   * arrives underneath this plane with 1.6 m of water over their eye, watches
   * it come down to meet them as the floor climbs, and walks out through it.
   */
  for (let i = 0; i < SPRINGS_FLARE_SLICES; i += 1) {
    const minZ = SUMP_END_Z + (SPRINGS_FLARE_LENGTH * i) / SPRINGS_FLARE_SLICES;
    const maxZ =
      SUMP_END_Z + (SPRINGS_FLARE_LENGTH * (i + 1)) / SPRINGS_FLARE_SLICES;
    waterPlanes.push({
      id: `springs-pool-flare-${i}`,
      ...rect(-springsHalfWAt(maxZ), minZ, springsHalfWAt(maxZ), maxZ),
      surfaceY: SPRINGS_WATER_Y,
      state: "spring",
      seenFromBelow: true,
    });
  }
  waterPlanes.push({
    id: "springs-pool",
    ...rect(
      -SPRINGS_HALF_W,
      SUMP_END_Z + SPRINGS_FLARE_LENGTH,
      SPRINGS_HALF_W,
      SPRINGS_SHORE_Z
    ),
    surfaceY: SPRINGS_WATER_Y,
    state: "spring",
    seenFromBelow: true,
  });

  /**
   * One performer per leg. A is pro/pro — unified, locked, ice. C is the
   * hybrid and the only one carrying both rotations — liquid. B is anti/anti,
   * the same motion as A inverted, which is what steam is to ice.
   * Verified against the Flow Arts MCP 2026-08-09.
   */
  const ICE_PERFORMER_Z = (SNOW_START_Z + SNOW_END_Z) / 2 + m(1.5);
  const SEA_PERFORMER_Z = (DESCENT_END_Z + SEA_END_Z) / 2;
  /**
   * ON the shoreline, not past it. The dais straddles the metre where the
   * climbing floor meets the pool's surface, so the figure stands exactly on
   * the boundary the room is about — and the still water doubles them.
   */
  const STEAM_PERFORMER_Z = SPRINGS_SHORE_Z;

  /**
   * The three daises, one per performer, each dead on the centreline so the
   * path HAS to fork. See the station constants up top for why 0.9 m of rise
   * is the enforcement and not just staging.
   *
   * A's stands in the frozen pool; the ice ring around it is the walk. B's
   * rises from the trench floor with a guide stone either side — the trench
   * is 16 m wide, and without the stones "walk around it" degrades into
   * "drift past it at a distance"; with them the way through is two 3 m lanes
   * that hold the visitor inside the sequence's reach. C's is a vent platform
   * half in and half out of the springs pool, met head-on in the wade up from
   * the surface break.
   */
  wallRects.push(
    {
      id: "station-a-dais",
      rect: rect(
        -STATION_DAIS_HALF_W,
        ICE_PERFORMER_Z - STATION_DAIS_HALF_W,
        STATION_DAIS_HALF_W,
        ICE_PERFORMER_Z + STATION_DAIS_HALF_W
      ),
      // Sunk half a metre so no seam shows between riser and ice.
      baseY: WATERLINE_Y - m(0.5),
      topY: WATERLINE_Y + STATION_DAIS_RISE,
    },
    {
      id: "station-b-dais",
      rect: rect(
        -STATION_DAIS_HALF_W,
        SEA_PERFORMER_Z - STATION_DAIS_HALF_W,
        STATION_DAIS_HALF_W,
        SEA_PERFORMER_Z + STATION_DAIS_HALF_W
      ),
      baseY: SEA_FLOOR_Y - m(0.5),
      topY: SEA_FLOOR_Y + STATION_DAIS_RISE,
    },
    // The guide stones: shoulder-high rock masses from x ±4.2 to the trench
    // walls. Their tops sit just above the standing eye (−3.4), so they read
    // as masses to move between rather than steps to climb — and from the
    // descent ramp, where the eye is still high, the visitor sees over them
    // to the dais they frame.
    {
      id: "station-b-stone-west",
      rect: rect(
        -SEA_HALF_W,
        SEA_PERFORMER_Z - m(1),
        -m(4.2),
        SEA_PERFORMER_Z + m(1)
      ),
      baseY: SEA_FLOOR_Y - m(0.5),
      topY: SEA_FLOOR_Y + m(1.8),
    },
    {
      id: "station-b-stone-east",
      rect: rect(
        m(4.2),
        SEA_PERFORMER_Z - m(1),
        SEA_HALF_W,
        SEA_PERFORMER_Z + m(1)
      ),
      baseY: SEA_FLOOR_Y - m(0.5),
      topY: SEA_FLOOR_Y + m(1.8),
    },
    // C's rise is measured from the WATER, not the floor: 1.2 m over the pool
    // puts the platform clear of the surface while the wading floor beside it
    // (−5.1 to −6.0 across the dais's span) stays 0.7–1.6 m below the top —
    // still past the autostep from every side.
    {
      id: "station-c-dais",
      rect: rect(
        -STATION_DAIS_HALF_W,
        STEAM_PERFORMER_Z - m(1),
        STATION_DAIS_HALF_W,
        STEAM_PERFORMER_Z + m(1)
      ),
      baseY: SPRINGS_WATER_Y - m(2),
      topY: SPRINGS_WATER_Y + m(1.2),
    }
  );

  const performers: PerformerAnchor[] = [
    /**
     * A, then B, then C, in that order along the walk. The first mapping put
     * the hybrid letter on the liquid leg because liquid is the hybrid state,
     * which was a nice idea nobody walking the route could ever read: what a
     * visitor actually reads is the alphabet counting up as they go.
     *
     * All three stand on their daises now (2026-08-11 reverence decision):
     * y is the dais top, x is the centreline. The old off-centre C placement
     * — chosen so the figure was "something you pass" — is the exact thing
     * the decision overrules: nobody is passed at walking speed any more.
     */
    {
      id: "ice-performer",
      leg: "snowfield",
      letter: "A",
      effectId: "sparkles",
      x: 0,
      z: ICE_PERFORMER_Z,
      y: WATERLINE_Y + STATION_DAIS_RISE,
      ringY: WATERLINE_Y,
      facingAngle: Math.PI,
    },
    {
      id: "sea-performer",
      leg: "sea",
      letter: "B",
      effectId: "goo",
      x: 0,
      z: SEA_PERFORMER_Z,
      y: SEA_FLOOR_Y + STATION_DAIS_RISE,
      ringY: SEA_FLOOR_Y,
      facingAngle: Math.PI,
    },
    {
      id: "steam-performer",
      leg: "spring",
      letter: "C",
      effectId: "smoke",
      x: 0,
      z: STEAM_PERFORMER_Z,
      y: SPRINGS_WATER_Y + m(1.2),
      // The wading floor at the shoreline, which is where the ring is walked.
      ringY: springsFloorYAt(STEAM_PERFORMER_Z),
      facingAngle: Math.PI,
    },
  ];

  /**
   * The route bends around each dais — east at A, west at B, east at C, so
   * the walk sways instead of zigzagging the same shoulder three times. Half
   * a sine per detour keeps the polyline honest for camera aims; the visitor
   * themselves is steered by the colliders, not this line.
   */
  const ringDetours = [
    {
      minZ: STATION_A_POOL_MIN_Z,
      maxZ: STATION_A_POOL_MAX_Z,
      reach: m(2.6),
    },
    // Lane centre between the dais edge (1.2) and the stone edge (4.2).
    { minZ: SEA_PERFORMER_Z - m(2.2), maxZ: SEA_PERFORMER_Z + m(2.2), reach: -m(2.7) },
    { minZ: STEAM_PERFORMER_Z - m(2.5), maxZ: STEAM_PERFORMER_Z + m(2.5), reach: m(2.6) },
  ];
  const route: { x: number; z: number; y: number }[] = [];
  for (let z = SNOW_START_Z + m(1); z <= SPRING_END_Z - m(1); z += m(1.5)) {
    let x = 0;
    for (const detour of ringDetours) {
      if (z > detour.minZ && z < detour.maxZ) {
        x =
          detour.reach *
          Math.sin((Math.PI * (z - detour.minZ)) / (detour.maxZ - detour.minZ));
      }
    }
    route.push({ x, z, y: floorYAt(floorRects, z) });
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
    // A couple of paces in, on the ice, before the A performer at z 6.5: the
    // path first, then the person doing it. Wheel sizing is arm-scaled — two
    // 1.2 m wheels with a 1.7 m gap sit inside the 4.4 m river channel.
    handPathStation: {
      x: 0,
      z: m(3.2),
      y: WATERLINE_Y,
      facingAngle: Math.PI,
      wheelRadius: m(1.2),
      wheelGap: m(1.7),
    },
    route,
    legs: {
      snowfield: rect(-SNOW_HALF_W, SNOW_START_Z, SNOW_HALF_W, DESCENT_END_Z),
      sea: rect(-SEA_HALF_W, DESCENT_END_Z, SEA_HALF_W, CAVE_END_Z),
      spring: rect(-SPRINGS_HALF_W, CAVE_END_Z, SPRINGS_HALF_W, SPRING_END_Z),
    },
    surfaceBreak: { x: 0, z: SPRINGS_BREAK_Z, y: SPRINGS_WATER_Y },
    /**
     * The vents: heat coming off the chamber floor and hitting rock.
     *
     * There used to be one, and it used to stand in a shaft of daylight and go
     * up through the roof — the piece's one long sightline, visible from the
     * first step through two portals. That is gone, and both halves of the loss
     * are the point. A column you can see for the whole walk is a promise; a
     * room you cannot see into until you are inside it is a reveal. And a plume
     * that exits through the ceiling asks the visitor to look UP and out, which
     * is an exit — the last thing this room should offer, when its whole job is
     * handing them to the volcano through the far wall.
     *
     * What was still wrong after that: ONE of them, standing in the middle of
     * the floor, is a monument to a spring rather than a spring. Six of them,
     * scattered across a floor that is rising past you, are a source — and the
     * room stops being a flooded hall with a column in it.
     *
     * Two are full height and stop dead at the roof, because the air bell is
     * barely more than head-high: the heat has nowhere to go. The other five
     * peter out, which is what keeps the tall two reading as tall. Ranged in Z
     * so the room reveals them in sequence rather than all at once, and one
     * (at z 48.9) sits close enough to the centreline to be PASSED — the
     * difference between watching springs across a room and walking through
     * them.
     */
    vents: [
      // The pair that flanks the door, and the two that carry the room.
      //
      // Full height, hard against the mouth's shoulders at x ±3.6 — the
      // opening is 5 m across, so they stand just outside it and frame it
      // without covering it. They are here rather than in the middle of the
      // floor because they are the only vents visible for the WHOLE climb:
      // from the pinch they are ~8 m ahead and 3.6 m off, which is 24° —
      // inside the forward cone — and they stay in it every metre. The last
      // thing the room shows before handing over is its heat standing either
      // side of the way out.
      vent(-3.6, 56.5, 1, 1.0),
      vent(3.7, 56.2, 1, 0.95),
      // The middle pair, close enough to the centreline to be in frame from
      // the entrance and to be walked BETWEEN halfway up. Lateral offset only
      // means anything against forward distance: a wide vent right beside you
      // is off the side of the screen; the same offset a few metres ahead is
      // the edge of the picture. Vents ranged by distance instead of spread by
      // width would leave the middle of the walk with nothing in front of it.
      vent(-2.1, 53.6, 0.5, 0.7),
      vent(2.6, 52.4, 0.45, 0.65),
      // And the wide, early ones — met in the first few steps out of the sump,
      // passed close, and gone. They are peripheral on purpose: something has
      // to go by at arm's length or the room is a thing watched from a path.
      vent(-6.2, 49.8, 0.35, 0.8),
      vent(6.6, 50.6, 0.3, 0.85),
      vent(2.3, 48.9, 0.25, 0.5),
    ],
    spawn: { x: 0, y: SNOW_Y + 1.0, z: SNOW_START_Z + m(2), yaw: 0 },
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

/** Where the visitor's head is relative to whichever surface is over them. */
export type WaterRelation = "on" | "in" | "under" | "above";

/**
 * The water surface at a world Z.
 *
 * There are two of them and they are 23 m apart, so nothing that reasons about
 * depth may reach for WATERLINE_Y directly any more. That constant is the SEA;
 * this function is "the water here."
 *
 * Everything before the springs answers with the sea, including the sump, whose
 * back half has no surface at all — but a visitor nearly nine metres down under
 * a roofed passage is under the sea by any measure, so the answer is still right.
 * The springs chamber answers with its own pool, and that single substitution is
 * what lets the last climb register as an emergence instead of as four metres
 * of getting marginally less drowned.
 */
export function waterLevelAt(z: number): number {
  return regionAt(z) === "springs" ? SPRINGS_WATER_Y : WATERLINE_Y;
}

/**
 * Under it, in it, on it, or above it — asked of the EYE and the FLOOR, not of
 * the leg.
 *
 * The readout used to key off `legAt`, which is a fact about the route rather
 * than about the person walking it. Two positions answer it exactly, and they
 * are both already on hand.
 *
 * "Above" is the fourth answer and it exists because of the springs shore: the
 * visitor finishes the walk four metres over the pool, on dry rock, and the old
 * three-way collapsed that into "on the water" — the same word the frozen river
 * gets, where the floor IS the surface. Those are not the same fact and the one
 * the walk ends on is the one it had no word for.
 *
 * The floor test uses the ANALYTIC floor, so the seabed's sculpted relief
 * cannot flip the answer as the visitor crosses a dune.
 */
export function relationToWater(eyeY: number, z: number): WaterRelation {
  const level = waterLevelAt(z);
  if (eyeY < level) return "under";
  const floor = baseFloorYAt(z);
  // Epsilon so the frozen river — walked ON, at exactly the waterline — does
  // not read as wading through itself.
  if (floor < level - 0.05) return "in";
  // Half a metre of tolerance, so the snowfield's banks (0.28 m proud of the
  // ice they are cut into) still read as standing on the river rather than
  // above it.
  return floor > level + 0.5 ? "above" : "on";
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
 * steps six times inside one leg. A readout that answered "18 m to ceiling"
 * while the visitor stood in a three-metre tube would be reporting the room
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
  // The flare, then the room, then the mouth. Reported honestly through the
  // opening, since "4 m across" and "16 m across" two paces apart is the whole
  // payoff.
  if (region === "springs") return springsHalfWAt(z);
  return CHAMBER_HALF_W[region];
}

/** Which leg a world Z belongs to. */
export function legAt(z: number): Leg {
  // The leg changes where the WATER changes, not where the floor levels out.
  // The descent ramp is already under the surface for most of its run, so
  // calling it snowfield until the bottom would have the readout say "on the
  // water" to someone standing nine metres beneath it.
  //
  // The sea leg ends where the cave does, at the canyon's near wall. It read
  // ASCENT_END_Z until the back half stopped climbing; same metre, honest name.
  if (z < SNOW_END_Z) return "snowfield";
  if (z < CAVE_END_Z) return "sea";
  return "spring";
}
