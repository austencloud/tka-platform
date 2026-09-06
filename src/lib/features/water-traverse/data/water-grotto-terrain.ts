/**
 * The Water Grotto — terrain program.
 *
 * ── Why this replaces the traverse ─────────────────────────────────────────
 *
 * The traverse was a 56.5 m ribbon: 1,155 m² of walkable floor, every square
 * metre of it route, all three performers on one line, and the first of them
 * 1.5 seconds from the spawn point. Reverence had nowhere to live, so it came
 * out as a dais standing in the only path — a roadblock, which is what Austen
 * saw on 2026-08-11: "smack dab in the middle of the path. No, this looks
 * terrible."
 *
 * Fire is a ROOM (58 × 44 m) whose plan carries a checked property called
 * performersHiddenUntilTheMouth. You cannot see a Fire performer until you
 * have entered their court. That is where its reverence comes from, and a
 * corridor cannot have it.
 *
 * So Water becomes a room too — but one room, not three, because the piece
 * already had the right idea and put it in a hallway. Its own spec says: "a
 * hot spring in a cold place is ice at the edges, liquid in the basin, steam
 * at the interface." That describes ONE POOL. So: one basin, frozen at the
 * north end, deep in the middle, steaming at the south. Three performers, one
 * water surface, three relationships to it — kept exactly — and an apron ring
 * you walk first, seeing all of it across the water before you go down into
 * any of it.
 *
 * ── The three encounters ───────────────────────────────────────────────────
 *
 * Each is a different verb, and none of them is "get around the obstacle":
 *
 *   A · ice    — you step DOWN off the apron onto frozen water and stand on
 *                the same surface they do. 22 × 7 m of shelf; A is off the
 *                ramp axis so you meet them at an angle, not head-on.
 *   B · basin  — you walk down under the surface. The one place the visitor is
 *                fully submerged inside the room, and B is down there with
 *                them.
 *   C · shallows — you wade. Same water, thigh deep, 22 × 6 m of it.
 *
 * ── What this file is not ──────────────────────────────────────────────────
 *
 * Boring on purpose. Walls, floor, ceiling. No water surface, no vents, no
 * steam, no performers rendered, no palette. Austen (2026-08-11): "Gray box
 * it. I'm talking like boring af just walls floor, ceiling." The volume gets
 * judged before anything is spent dressing it — which is the lesson the
 * traverse taught the expensive way.
 */

import {
  contains,
  floorRectYAt,
  type FloorRect,
  type WallRect,
  type WorldRect,
} from "./rect-colliders";

export type { FloorRect, WallRect, WorldRect };


/** The pool's surface. Every elevation in this file is relative to it. */
export const WATERLINE_Y = 0;

/** Standing eye height. Every clearance is derived against a real person. */
export const EYE_ABOVE_FLOOR = 1.6;

/** The dry walkway ringing the pool. High enough to look down INTO the water. */
export const APRON_Y = 1.2;

/** Parapet top. Waist-high from the apron: a place to stand and look over. */
export const PARAPET_TOP_Y = APRON_Y + 0.9;


/** The sump floor. Eye lands 1.6 m under the surface — properly submerged. */
export const SUMP_FLOOR_Y = -3.2;
/** The sump roof. 1.0 m over the eye: tight, which is the whole point of it. */
export const SUMP_ROOF_Y = -0.6;

/** Thigh-deep. Waterline at 0, so this is 1.2 m of water to wade. */
export const SHALLOWS_Y = -1.2;
/** The deep end. Eye at -1.9 — under, with the surface visibly overhead. */
export const BASIN_Y = -3.5;
/** The frozen north end. The ice IS the waterline; you walk on the water. */
export const ICE_Y = WATERLINE_Y;

/** The grotto roof. One flat slab — a dome is an art-pass problem. */
export const CEILING_Y = 14;


/** The pool, in plan. 22 × 28 m — squarish, which is what keeps it a room. */
export const POOL_MIN_X = -11;
export const POOL_MAX_X = 11;
export const POOL_MIN_Z = 10;
export const POOL_MAX_Z = 38;

/** The apron's outer edge. */
export const ROOM_MIN_X = -19;
export const ROOM_MAX_X = 19;
export const ROOM_MIN_Z = 4;
export const ROOM_MAX_Z = 45;

/** The sump corridor, entering from the south in line with the west apron. */
export const SUMP_MIN_X = -17;
export const SUMP_MAX_X = -13;
export const SUMP_START_Z = -14;
/**
 * Where the roof stops. Deliberately well before the eye surfaces: the ceiling
 * opening overhead while you are still underwater is the reveal, and it needs
 * room to land. At 2 m of separation it was a blink.
 */
export const SUMP_ROOF_END_Z = -6;
/** Where the surfacing ramp tops out onto the apron. */
export const SUMP_RAMP_END_Z = 4;

/** Pool bands, south to north. */
export const SHALLOWS_END_Z = 15;
export const BASIN_RAMP_END_Z = 20;
export const BASIN_END_Z = 26;
export const ICE_RAMP_END_Z = 33;

/** The mouth cut through the north parapet, where you step onto the ice. */
export const ICE_MOUTH_HALF_W = 3;
export const ICE_MOUTH_START_Z = 38;
export const ICE_MOUTH_END_Z = 41;

/** The exit bay: a corner of the shallows you climb out of, toward Fire. */
export const EXIT_BAY_MIN_X = 11;
export const EXIT_BAY_MAX_X = 15;
export const EXIT_RAMP_END_Z = 20;


/** Which of the pool's three temperaments a performer stands in. */
export type Station = "ice" | "basin" | "shallows";

export interface GrottoPerformer {
  id: string;
  letter: "A" | "B" | "C";
  station: Station;
  x: number;
  z: number;
  /** The surface they stand on. Always the local floor — no plinths. */
  y: number;
  /** Radians. Faces back toward the mouth the visitor arrives through. */
  facingAngle: number;
}

export interface WaterGrottoLayout {
  bounds: WorldRect;
  floorRects: FloorRect[];
  wallRects: WallRect[];
  performers: GrottoPerformer[];
  /** Centreline samples along the walk, for probes and camera aims. */
  route: { x: number; z: number; y: number }[];
  spawn: { x: number; y: number; z: number; yaw: number };
  /** Where the eye breaks the surface on the way in. */
  surfaceBreak: { x: number; z: number };
}


/**
 * All three sit OFF the axis of the mouth you arrive through.
 *
 * This is the whole correction, and it is one number each. Dead ahead at the
 * bottom of a ramp is the traverse's mistake wearing a different hat: it reads
 * as something placed in your way. Five metres to the side reads as somebody
 * standing in a room you have just walked into.
 */
export const ICE_PERFORMER = { x: -5, z: 36 } as const;
export const BASIN_PERFORMER = { x: -6, z: 23 } as const;
export const SHALLOWS_PERFORMER = { x: 5, z: 13 } as const;


function rect(minX: number, minZ: number, maxX: number, maxZ: number): WorldRect {
  return { minX, minZ, maxX, maxZ };
}

function flat(id: string, r: WorldRect, y: number): FloorRect {
  return { id, rect: r, kind: "flat", fromY: y, toY: y };
}

function ramp(
  id: string,
  r: WorldRect,
  fromY: number,
  toY: number
): FloorRect {
  return { id, rect: r, kind: "ramp-z", fromY, toY };
}

function wall(
  id: string,
  r: WorldRect,
  baseY: number,
  topY: number
): WallRect {
  return { id, rect: r, baseY, topY };
}

function buildFloors(): FloorRect[] {
  const f: FloorRect[] = [];

  // ── The way in: submerged corridor, then a ramp that surfaces you ─────────
  f.push(
    flat(
      "sump-floor",
      rect(SUMP_MIN_X, SUMP_START_Z, SUMP_MAX_X, SUMP_ROOF_END_Z),
      SUMP_FLOOR_Y
    )
  );
  f.push(
    ramp(
      "sump-rise",
      rect(SUMP_MIN_X, SUMP_ROOF_END_Z, SUMP_MAX_X, SUMP_RAMP_END_Z),
      SUMP_FLOOR_Y,
      APRON_Y
    )
  );

  // ── The apron ring, in pieces that do not overlap ────────────────────────
  // Non-overlap is load-bearing: floorAt takes the highest match, and an apron
  // slab lying over the pool would quietly pave the water.
  f.push(flat("apron-south", rect(ROOM_MIN_X, ROOM_MIN_Z, ROOM_MAX_X, POOL_MIN_Z), APRON_Y));
  f.push(flat("apron-west", rect(ROOM_MIN_X, POOL_MIN_Z, POOL_MIN_X, ICE_MOUTH_START_Z), APRON_Y));
  f.push(flat("apron-east-lower", rect(EXIT_BAY_MAX_X, ROOM_MIN_Z, ROOM_MAX_X, EXIT_RAMP_END_Z), APRON_Y));
  f.push(flat("apron-east-upper", rect(POOL_MAX_X, EXIT_RAMP_END_Z, ROOM_MAX_X, ICE_MOUTH_START_Z), APRON_Y));
  f.push(flat("apron-north", rect(ROOM_MIN_X, ICE_MOUTH_END_Z, ROOM_MAX_X, ROOM_MAX_Z), APRON_Y));
  // The north apron's two wings flank the mouth you step through onto the ice.
  f.push(flat("apron-north-west-wing", rect(ROOM_MIN_X, ICE_MOUTH_START_Z, -ICE_MOUTH_HALF_W, ICE_MOUTH_END_Z), APRON_Y));
  f.push(flat("apron-north-east-wing", rect(ICE_MOUTH_HALF_W, ICE_MOUTH_START_Z, ROOM_MAX_X, ICE_MOUTH_END_Z), APRON_Y));

  // ── The pool: one basin, three temperaments, south to north ──────────────
  f.push(flat("pool-shallows", rect(POOL_MIN_X, POOL_MIN_Z, POOL_MAX_X, SHALLOWS_END_Z), SHALLOWS_Y));
  f.push(ramp("pool-basin-ramp", rect(POOL_MIN_X, SHALLOWS_END_Z, POOL_MAX_X, BASIN_RAMP_END_Z), SHALLOWS_Y, BASIN_Y));
  f.push(flat("pool-basin", rect(POOL_MIN_X, BASIN_RAMP_END_Z, POOL_MAX_X, BASIN_END_Z), BASIN_Y));
  f.push(ramp("pool-ice-ramp", rect(POOL_MIN_X, BASIN_END_Z, POOL_MAX_X, ICE_RAMP_END_Z), BASIN_Y, ICE_Y));
  f.push(flat("pool-ice", rect(POOL_MIN_X, ICE_RAMP_END_Z, POOL_MAX_X, POOL_MAX_Z), ICE_Y));
  // The step down from the north apron onto the frozen shelf.
  f.push(ramp("ice-mouth-ramp", rect(-ICE_MOUTH_HALF_W, ICE_MOUTH_START_Z, ICE_MOUTH_HALF_W, ICE_MOUTH_END_Z), ICE_Y, APRON_Y));

  // ── The way out: wade east, climb out toward Fire ────────────────────────
  f.push(flat("exit-bay", rect(EXIT_BAY_MIN_X, POOL_MIN_Z, EXIT_BAY_MAX_X, SHALLOWS_END_Z), SHALLOWS_Y));
  f.push(ramp("exit-ramp", rect(EXIT_BAY_MIN_X, SHALLOWS_END_Z, EXIT_BAY_MAX_X, EXIT_RAMP_END_Z), SHALLOWS_Y, APRON_Y));

  return f;
}

function buildWalls(): WallRect[] {
  const w: WallRect[] = [];

  const OUTER_TOP = CEILING_Y;
  const T = 2; // wall thickness

  // Side walls run all the way to the roof, not just to head height. The low
  // sump ceiling below hides everything above it, but the moment the roof stops
  // and you surface on the ramp, a wall that ended at 3.2 m would open onto
  // void exactly where the room is supposed to reveal itself.
  w.push(wall("sump-wall-west", rect(SUMP_MIN_X - T, SUMP_START_Z, SUMP_MIN_X, SUMP_RAMP_END_Z), SUMP_FLOOR_Y - 2, CEILING_Y));
  w.push(wall("sump-wall-east", rect(SUMP_MAX_X, SUMP_START_Z, SUMP_MAX_X + T, SUMP_RAMP_END_Z), SUMP_FLOOR_Y - 2, CEILING_Y));
  w.push(wall("sump-wall-south", rect(SUMP_MIN_X - T, SUMP_START_Z - T, SUMP_MAX_X + T, SUMP_START_Z), SUMP_FLOOR_Y - 2, CEILING_Y));
  // The roof that makes the sump a sump, and stops before you surface.
  w.push(wall("sump-ceiling", rect(SUMP_MIN_X, SUMP_START_Z, SUMP_MAX_X, SUMP_ROOF_END_Z), SUMP_ROOF_Y, SUMP_ROOF_Y + 0.6));

  w.push(wall("hall-west", rect(ROOM_MIN_X - T, ROOM_MIN_Z, ROOM_MIN_X, ROOM_MAX_Z), 0, OUTER_TOP));
  w.push(wall("hall-east", rect(ROOM_MAX_X, ROOM_MIN_Z, ROOM_MAX_X + T, ROOM_MAX_Z), 0, OUTER_TOP));
  w.push(wall("hall-north", rect(ROOM_MIN_X - T, ROOM_MAX_Z, ROOM_MAX_X + T, ROOM_MAX_Z + T), 0, OUTER_TOP));
  // The south wall, with the gap the sump ramp comes through.
  w.push(wall("hall-south-west", rect(ROOM_MIN_X - T, ROOM_MIN_Z - T, SUMP_MIN_X, ROOM_MIN_Z), 0, OUTER_TOP));
  w.push(wall("hall-south-east", rect(SUMP_MAX_X, ROOM_MIN_Z - T, ROOM_MAX_X + T, ROOM_MIN_Z), 0, OUTER_TOP));
  // The roof reaches back over the sump so the ceiling is continuous. Inside
  // the sump you never see it — the low roof is between you and it — so the
  // effect is the ceiling LIFTING as you surface, which is the reveal.
  w.push(wall("hall-ceiling", rect(ROOM_MIN_X - T, SUMP_START_Z - T, ROOM_MAX_X + T, ROOM_MAX_Z + T), CEILING_Y, CEILING_Y + 1));

  // One rect per edge does two jobs: it contains the water volume from the
  // pool floor up, and its top 0.9 m is the parapet you lean on to look
  // across. Standing at it and seeing a performer framed over still water IS
  // the reverence mechanism — no dais required, nothing in anybody's way.
  const EDGE_BASE = BASIN_Y - 1;
  const E = 0.6;
  w.push(wall("pool-edge-west", rect(POOL_MIN_X - E, POOL_MIN_Z, POOL_MIN_X, POOL_MAX_Z), EDGE_BASE, PARAPET_TOP_Y));
  w.push(wall("pool-edge-east", rect(POOL_MAX_X, SHALLOWS_END_Z, POOL_MAX_X + E, POOL_MAX_Z), EDGE_BASE, PARAPET_TOP_Y));
  w.push(wall("pool-edge-south", rect(POOL_MIN_X, POOL_MIN_Z - E, POOL_MAX_X, POOL_MIN_Z), EDGE_BASE, PARAPET_TOP_Y));
  w.push(wall("pool-edge-north-west", rect(POOL_MIN_X, POOL_MAX_Z, -ICE_MOUTH_HALF_W, POOL_MAX_Z + E), EDGE_BASE, PARAPET_TOP_Y));
  w.push(wall("pool-edge-north-east", rect(ICE_MOUTH_HALF_W, POOL_MAX_Z, POOL_MAX_X, POOL_MAX_Z + E), EDGE_BASE, PARAPET_TOP_Y));
  // The exit bay's own two edges.
  w.push(wall("pool-edge-bay-east", rect(EXIT_BAY_MAX_X, POOL_MIN_Z, EXIT_BAY_MAX_X + E, SHALLOWS_END_Z), EDGE_BASE, PARAPET_TOP_Y));
  w.push(wall("pool-edge-bay-south", rect(EXIT_BAY_MIN_X, POOL_MIN_Z - E, EXIT_BAY_MAX_X, POOL_MIN_Z), EDGE_BASE, PARAPET_TOP_Y));
  w.push(wall("pool-edge-ramp-east", rect(EXIT_BAY_MAX_X, SHALLOWS_END_Z, EXIT_BAY_MAX_X + E, EXIT_RAMP_END_Z), EDGE_BASE, PARAPET_TOP_Y));

  return w;
}

/**
 * The walk, as waypoints.
 *
 * Deliberately a horseshoe: the apron ring FIRST, so every performer is seen
 * across the water before the visitor goes down to any of them, and only then
 * the descent through ice, basin, shallows. Seeing it whole and then entering
 * it is the thing a corridor structurally cannot do.
 */
const ROUTE_WAYPOINTS: { x: number; z: number }[] = [
  { x: -15, z: SUMP_START_Z + 1 },
  { x: -15, z: SUMP_ROOF_END_Z },
  { x: -15, z: SUMP_RAMP_END_Z },
  { x: -15, z: 12 },
  { x: -15, z: 24 },
  { x: -15, z: 36 },
  { x: -14, z: 43 },
  { x: -6, z: 43 },
  { x: 0, z: 43 },
  { x: 0, z: ICE_MOUTH_START_Z },
  { x: -2, z: 37 },
  { x: ICE_PERFORMER.x, z: ICE_PERFORMER.z },
  { x: -2, z: 34 },
  { x: 0, z: BASIN_END_Z },
  { x: -3, z: 24 },
  { x: BASIN_PERFORMER.x, z: BASIN_PERFORMER.z },
  { x: -1, z: 21 },
  { x: 0, z: BASIN_RAMP_END_Z },
  { x: 2, z: 17 },
  { x: SHALLOWS_PERFORMER.x, z: SHALLOWS_PERFORMER.z },
  { x: 10, z: 12 },
  { x: 13, z: 14 },
  { x: 13, z: SHALLOWS_END_Z },
  { x: 13, z: EXIT_RAMP_END_Z },
  { x: 17, z: 22 },
];

export function buildWaterGrottoLayout(): WaterGrottoLayout {
  const floorRects = buildFloors();
  const wallRects = buildWalls();

  const floorAt = (x: number, z: number): number =>
    floorAtIn(floorRects, x, z);

  // Sample the waypoint polyline at 0.5 m so probes get a real walk.
  const route: { x: number; z: number; y: number }[] = [];
  for (let i = 0; i < ROUTE_WAYPOINTS.length - 1; i++) {
    const a = ROUTE_WAYPOINTS[i]!;
    const b = ROUTE_WAYPOINTS[i + 1]!;
    const span = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.round(span / 0.5));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      route.push({ x, z, y: floorAt(x, z) });
    }
  }
  const last = ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1]!;
  route.push({ x: last.x, z: last.z, y: floorAt(last.x, last.z) });

  // Where the eye clears the surface on the way in.
  const rise = floorRects.find((f) => f.id === "sump-rise")!;
  const breakZ =
    SUMP_ROOF_END_Z +
    (SUMP_RAMP_END_Z - SUMP_ROOF_END_Z) *
      ((WATERLINE_Y - EYE_ABOVE_FLOOR - rise.fromY) / (rise.toY - rise.fromY));

  const performers: GrottoPerformer[] = [
    {
      id: "ice-performer",
      letter: "A",
      station: "ice",
      x: ICE_PERFORMER.x,
      z: ICE_PERFORMER.z,
      y: ICE_Y,
      facingAngle: Math.PI,
    },
    {
      id: "basin-performer",
      letter: "B",
      station: "basin",
      x: BASIN_PERFORMER.x,
      z: BASIN_PERFORMER.z,
      y: BASIN_Y,
      facingAngle: Math.PI,
    },
    {
      id: "shallows-performer",
      letter: "C",
      station: "shallows",
      x: SHALLOWS_PERFORMER.x,
      z: SHALLOWS_PERFORMER.z,
      y: SHALLOWS_Y,
      facingAngle: Math.PI,
    },
  ];

  return {
    bounds: rect(ROOM_MIN_X - 2, SUMP_START_Z - 2, ROOM_MAX_X + 2, ROOM_MAX_Z + 2),
    floorRects,
    wallRects,
    performers,
    route,
    spawn: {
      x: -15,
      y: SUMP_FLOOR_Y + EYE_ABOVE_FLOOR,
      z: SUMP_START_Z + 1,
      yaw: 0,
    },
    surfaceBreak: { x: -15, z: breakZ },
  };
}


function floorAtIn(floors: FloorRect[], x: number, z: number): number {
  let best = Number.NEGATIVE_INFINITY;
  for (const f of floors) {
    if (!contains(f.rect, x, z)) continue;
    const y = floorRectYAt(f, z);
    if (y > best) best = y;
  }
  return best === Number.NEGATIVE_INFINITY ? APRON_Y : best;
}

/** Floor elevation anywhere in the room. A room needs both axes, not just z. */
export function grottoFloorAt(x: number, z: number): number {
  return floorAtIn(buildFloors(), x, z);
}

/** Which surface a point stands on, by id. Empty when it stands on nothing. */
export function grottoSurfaceAt(x: number, z: number): string {
  let best = Number.NEGATIVE_INFINITY;
  let id = "";
  for (const f of buildFloors()) {
    if (!contains(f.rect, x, z)) continue;
    const y = floorRectYAt(f, z);
    if (y > best) {
      best = y;
      id = f.id;
    }
  }
  return id;
}

/** Ceiling overhead. The sump has its own; everywhere else is the grotto roof. */
export function grottoCeilingAt(x: number, z: number): number {
  if (
    x >= SUMP_MIN_X &&
    x <= SUMP_MAX_X &&
    z >= SUMP_START_Z &&
    z <= SUMP_ROOF_END_Z
  ) {
    return SUMP_ROOF_Y;
  }
  return CEILING_Y;
}

export type WaterRelation = "on" | "in" | "under" | "above";

/**
 * Where the visitor's eye sits relative to the one water surface.
 *
 * "on" is the ice: standing at the waterline exactly, which is the whole
 * conceit of the north end.
 */
export function grottoRelationToWater(
  eyeY: number,
  x: number,
  z: number
): WaterRelation {
  const inPool =
    (x >= POOL_MIN_X && x <= POOL_MAX_X && z >= POOL_MIN_Z && z <= POOL_MAX_Z) ||
    (x >= EXIT_BAY_MIN_X && x <= EXIT_BAY_MAX_X && z >= POOL_MIN_Z && z <= EXIT_RAMP_END_Z) ||
    (x >= SUMP_MIN_X && x <= SUMP_MAX_X && z <= SUMP_RAMP_END_Z);

  if (!inPool) return "above";
  if (eyeY < WATERLINE_Y) return "under";
  const floor = grottoFloorAt(x, z);
  if (floor >= WATERLINE_Y - 0.01) return "on";
  return "in";
}
