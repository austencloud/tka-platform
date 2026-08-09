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
const SPRING_RIDGE_TOP = SPRING_BANK_Y + 20;

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
const SEA_END_Z = 144;
const ASCENT_END_Z = 190;
const SPRING_END_Z = 244;

export const TOTAL_LENGTH_M = SPRING_END_Z;

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
  const LANDING_LENGTH = 4;
  const rise = SPRING_FLOOR_Y - SEA_FLOOR_Y;
  const toBreak = SURFACE_BREAK_Y - SEA_FLOOR_Y;
  const span = ASCENT_END_Z - SEA_END_Z - LANDING_LENGTH;
  // Split the horizontal run in proportion to how much of the climb happens
  // either side of the break, so both ramps hold the same grade.
  const lowerRun = span * (toBreak / rise);
  const lowerEndZ = SEA_END_Z + lowerRun;
  const landingEndZ = lowerEndZ + LANDING_LENGTH;
  const r = rect(-VALLEY_HALF_W, 0, VALLEY_HALF_W, 0);

  return {
    breakZ: (lowerEndZ + landingEndZ) / 2,
    floors: [
      ramp(
        "ascent-lower",
        { ...r, minZ: SEA_END_Z, maxZ: lowerEndZ },
        SEA_FLOOR_Y,
        SURFACE_BREAK_Y
      ),
      flat(
        "ascent-landing",
        { ...r, minZ: lowerEndZ, maxZ: landingEndZ },
        SURFACE_BREAK_Y
      ),
      ramp(
        "ascent-upper",
        { ...r, minZ: landingEndZ, maxZ: ASCENT_END_Z },
        SURFACE_BREAK_Y,
        SPRING_FLOOR_Y
      ),
    ],
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
 * Ridge legs: [id, from Z, to Z, base, nominal top].
 */
const RIDGE_LEGS: [string, number, number, number, number, number][] = [
  ["snow", SNOW_START_Z, SNOW_END_Z, SNOW_Y, SNOW_RIDGE_TOP, SNOW_HALF_W],
  ["descent", SNOW_END_Z, DESCENT_END_Z, SEA_FLOOR_Y, DESCENT_RIDGE_TOP, SEA_HALF_W],
  ["sea", DESCENT_END_Z, SEA_END_Z, SEA_FLOOR_Y, SEA_RIDGE_TOP, SEA_HALF_W],
  ["ascent", SEA_END_Z, ASCENT_END_Z, SEA_FLOOR_Y, SEA_RIDGE_TOP, SEA_HALF_W],
  ["spring", ASCENT_END_Z, SPRING_END_Z, SPRING_FLOOR_Y, SPRING_RIDGE_TOP, SPRING_HALF_W],
];

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
  halfWidth: number
): WallRect[] {
  const BLOCK = 17;
  const count = Math.max(2, Math.round((maxZ - minZ) / BLOCK));
  const step = (maxZ - minZ) / count;
  const walls: WallRect[] = [];

  for (const side of [-1, 1] as const) {
    for (let i = 0; i < count; i += 1) {
      const seed = (id.length * 31 + i) * (side < 0 ? 1 : 7.3) + i * 2.7;
      const height = nominalTop - baseY;
      const top = baseY + height * (0.62 + jitter(seed) * 0.95);
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

export function buildWaterTraverseLayout(): WaterTraverseLayout {
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
    flat(
      "spring-plain",
      rect(-SPRING_HALF_W, ASCENT_END_Z, SPRING_HALF_W, SPRING_END_Z),
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
          side < 0 ? -SPRING_HALF_W : CHANNEL_HALF_W + 2.5,
          ASCENT_END_Z + 6,
          side < 0 ? -CHANNEL_HALF_W - 2.5 : SPRING_HALF_W,
          SPRING_END_Z - 8
        ),
        SPRING_BANK_Y
      )
    );
  }

  const wallRects: WallRect[] = [];
  for (const [id, minZ, maxZ, baseY, topY, halfWidth] of RIDGE_LEGS) {
    wallRects.push(...buildRidge(id, minZ, maxZ, baseY, topY, halfWidth));
  }
  // Close both ends. The walk is forward-only; there is nothing behind you and
  // nothing past the last pool.
  wallRects.push({
    id: "cap-start",
    rect: rect(-SNOW_HALF_W, SNOW_START_Z - RIDGE_THICKNESS, SNOW_HALF_W, SNOW_START_Z),
    baseY: SNOW_Y,
    topY: SNOW_RIDGE_TOP,
  });
  wallRects.push({
    id: "cap-end",
    rect: rect(-SPRING_HALF_W, SPRING_END_Z, SPRING_HALF_W, SPRING_END_Z + RIDGE_THICKNESS),
    baseY: SPRING_FLOOR_Y,
    topY: SPRING_RIDGE_TOP,
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
      ...rect(-SEA_HALF_W, SNOW_END_Z, SEA_HALF_W, ASCENT_END_Z),
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
    bounds: rect(
      -VALLEY_HALF_W - RIDGE_THICKNESS,
      SNOW_START_Z - RIDGE_THICKNESS,
      VALLEY_HALF_W + RIDGE_THICKNESS,
      SPRING_END_Z + RIDGE_THICKNESS
    ),
    floorRects,
    wallRects,
    waterPlanes,
    performers,
    route,
    legs: {
      snowfield: rect(-SNOW_HALF_W, SNOW_START_Z, SNOW_HALF_W, DESCENT_END_Z),
      sea: rect(-SEA_HALF_W, DESCENT_END_Z, SEA_HALF_W, ASCENT_END_Z),
      spring: rect(-SPRING_HALF_W, ASCENT_END_Z, SPRING_HALF_W, SPRING_END_Z),
    },
    surfaceBreak: { x: 0, z: ascent.breakZ, y: SURFACE_BREAK_Y },
    /**
     * The steam column. It stands at the far end and rises well above the
     * snowfield's ridges, so the end of the walk is visible from its
     * beginning — the sightline that carries "all three states are everywhere"
     * without staging anything.
     */
    plume: {
      x: 0,
      z: ASCENT_END_Z + 30,
      baseY: WATERLINE_Y,
      height: 46,
    },
    spawn: { x: 0, y: SNOW_Y + 1.0, z: SNOW_START_Z + 6, yaw: 0 },
  };
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
