/**
 * Measured room-local geometry for the revived First Fire Torch Procession
 * (design 2026-08-06, revived 2026-08-09).
 *
 * The origin is the north-west interior corner. X runs from Water to Earth and
 * Z runs north to south. One continuous S-route walks Water -> DJ -> EK -> FL
 * -> Earth. Each shrine is a habitat ringed by a fire trench with a 240-degree
 * horseshoe orbit: the visitor enters on one side and leaves on another, so
 * ordinary forward movement completes the encounter.
 *
 * Three corrections carried into the revival from Austen's 2026-08-09 review of
 * the rejected hub interior:
 *
 * 1. Torches are a lane, not a field. Every stem flanks the route or a shrine
 *    perimeter; none are scattered as atmosphere.
 * 2. Connecting corridors are 4.5 m, not 3 m. The old transfers read as
 *    claustrophobic.
 * 3. The green Earth path is walled off behind the east rib and only exists as
 *    a guide path in the `extinguished` state, so it cannot draw the eye before
 *    the three performers have been seen.
 *
 * Fire is always a visual guide. It never owns collision.
 */
import type { MuseumGrid } from "../domain/museum-grid-types";
import {
  doorSpan,
  widenSpan,
  interiorWorldRect,
  type Point2,
  type Span,
  type WorldRect,
} from "./drowned-gallery-terrain";

export const FIRST_FIRE_PROCESSION_ROOM_ID = "cave-fire";

export const FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES = {
  width: 58,
  depth: 44,
} as const;

/**
 * `computeRoomDimensions` multiplies integer authoring units by 1.5 before
 * converting tiles to metres. Width 77 compiles to exactly 58 m. No integer
 * height compiles to exactly 44 m: 58 yields 43.5 m, while 59 yields 44.5 m.
 * The extra 0.5 m is symmetric north/south rock margin, not stretched art.
 */
export const FIRST_FIRE_PROCESSION_AUTHORING_MINIMUM = {
  width: 77,
  height: 59,
} as const;

export const FIRST_FIRE_SHRINE_ORDER = ["dj", "ek", "fl"] as const;
export type FirstFireShrineId = (typeof FIRST_FIRE_SHRINE_ORDER)[number];

export interface FirstFireProcessionFrame {
  room: WorldRect;
  westDoor: Span;
  eastDoor: Span;
}

export type FireProcessionPathKind =
  | "steam-threshold"
  | "ember-bridge"
  | "shrine-approach"
  | "shrine-mouth"
  | "shrine-orbit"
  | "transfer"
  | "growth-path";

export interface FireProcessionPathSection {
  id: string;
  kind: FireProcessionPathKind;
  shrineId?: FirstFireShrineId;
  width: number;
  points: Point2[];
}

export interface FireProcessionBasaltMass {
  id: string;
  kind: "rock-rib";
  polygon: Point2[];
  /** Bounding box retained for existing graybox consumers. */
  rect: WorldRect;
  minimumHeight: number;
}

/** Backward-compatible name used by the existing Blender bridge. */
export type FireProcessionOccluder = FireProcessionBasaltMass;

export interface FireProcessionActivationZone {
  id: string;
  startDegrees: number;
  sweepDegrees: number;
}

/**
 * The mouth a shrine is entered through. `approach` is the last point on the
 * connecting corridor before the ring gap; the performer reveal begins only
 * after `courtThreshold`.
 */
export interface FireProcessionGate {
  id: string;
  shrineId: FirstFireShrineId;
  width: number;
  centre: Point2;
  beacon: Point2;
  approach: Point2;
  courtThreshold: Point2;
}

/**
 * The three shrines share one prehistoric material language. What separates
 * them is flame behaviour, per the approved design's three fire grammars.
 */
export type FireGrammar = "broad-sweeps" | "curling-crown" | "divided";

export interface FireProcessionShrine {
  id: FirstFireShrineId;
  label: string;
  performerId: string;
  sequenceId: string;
  fireGrammar: FireGrammar;
  centre: Point2;
  /** Walkable court floor: everything inside the rim ring. */
  courtPolygon: Point2[];
  gateId: string;
  habitatRadius: number;
  trenchInnerRadius: number;
  trenchOuterRadius: number;
  orbitRadius: number;
  orbitWidth: number;
  orbitStartDegrees: number;
  orbitSweepDegrees: number;
  /** Entry and exit sit on different sides — the horseshoe, not a loop. */
  entry: Point2;
  exit: Point2;
  activationZones: FireProcessionActivationZone[];
}

export interface FireProcessionGuidePath {
  id: string;
  kind: "torch-lane" | "fire-wall" | "coal-memory" | "green-growth";
  state: "always" | "dj" | "ek" | "fl" | "extinguished";
  collision: false;
  width: number;
  points: Point2[];
}

export interface FirstFireProcessionPlan {
  room: WorldRect;
  centre: Point2;
  westDoor: Span;
  eastDoor: Span;
  /**
   * The stamped door tiles' real extent when the plan was built from a grid.
   * The route treats each doorway as a 4 m mouth centred on the door; the
   * museum's own doorway inside it is narrower, and the shell carve and the
   * colliders both use THIS span so rock fills the difference.
   */
  doorTileSpans?: { west: Span; east: Span };
  /** The ember-bridge clearing just inside Water. The room's only open plaza. */
  threshold: WorldRect;
  /** The carved walkable floor (corridors + court floors); everything else is rock. */
  carved: {
    corridors: Array<{ id: string; width: number; points: Point2[] }>;
  };
  shrines: FireProcessionShrine[];
  gates: FireProcessionGate[];
  basaltMasses: FireProcessionBasaltMass[];
  /** Alias retained while existing graybox consumers migrate to basaltMasses. */
  occluders: FireProcessionOccluder[];
  guidePaths: FireProcessionGuidePath[];
  pathSections: FireProcessionPathSection[];
  walkPath: Point2[];
  /**
   * Every stem is on the route. `laneStems` flank the corridors; the perimeter
   * stems are the ones that ignite behind the visitor during an orbit.
   */
  torchBudget: {
    laneStems: number;
    perimeterStemsPerShrine: number;
    maximumDetailedShrines: number;
  };
}

const NOMINAL_WIDTH = FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES.width;
const NOMINAL_DEPTH = FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES.depth;

const HABITAT_RADIUS = 2.2;
const TRENCH_INNER_RADIUS = 2.7;
const TRENCH_OUTER_RADIUS = 3.4;
const ORBIT_RADIUS = 5;
const ORBIT_WIDTH = 3;
const ORBIT_SWEEP_DEGREES = 240;
const ORBIT_SAMPLE_COUNT = 32;
const COURT_FLOOR_RADIUS = 7;
const COURT_WALL_OUTER = 8.4;
const COURT_WALL_HEIGHT = 6;
const COURT_GATE_HALF_DEGREES = 18;
const TRANSFER_WIDTH = 4.5;
const GROWTH_WIDTH = 4;
const WALL_BAND_THICKNESS = 1.2;
const ROCK_HEIGHT = 5.5;

interface ShrineDefinition {
  id: FirstFireShrineId;
  label: string;
  performerId: string;
  sequenceId: string;
  fireGrammar: FireGrammar;
  centre: Point2;
  /** Entry azimuth in degrees; 0 = east, 90 = south, -90 = north. */
  entryDegrees: number;
  sweepDegrees: number;
}

const SHRINE_DEFINITIONS: readonly ShrineDefinition[] = [
  {
    id: "dj",
    label: "DJ",
    performerId: "cave-fire-automaton-dj",
    sequenceId: "cave-fire-seq-dj",
    fireGrammar: "broad-sweeps",
    centre: { x: 13, z: 10 },
    entryDegrees: 90,
    sweepDegrees: ORBIT_SWEEP_DEGREES,
  },
  {
    id: "ek",
    label: "EK",
    performerId: "cave-fire-automaton-ek",
    sequenceId: "cave-fire-seq-ek",
    fireGrammar: "curling-crown",
    centre: { x: 29, z: 34 },
    // Mirrored walk direction: the second shrine must not feel like the first.
    entryDegrees: -90,
    sweepDegrees: -ORBIT_SWEEP_DEGREES,
  },
  {
    id: "fl",
    label: "FL",
    performerId: "cave-fire-automaton-fl",
    sequenceId: "cave-fire-seq-fl",
    fireGrammar: "divided",
    centre: { x: 45, z: 11 },
    entryDegrees: 165,
    sweepDegrees: ORBIT_SWEEP_DEGREES,
  },
] as const;

function pointOnCircle(centre: Point2, radius: number, degrees: number): Point2 {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: centre.x + Math.cos(radians) * radius,
    z: centre.z + Math.sin(radians) * radius,
  };
}

function shrineEntry(definition: ShrineDefinition): Point2 {
  return pointOnCircle(definition.centre, ORBIT_RADIUS, definition.entryDegrees);
}

function shrineExit(definition: ShrineDefinition): Point2 {
  return pointOnCircle(
    definition.centre,
    ORBIT_RADIUS,
    definition.entryDegrees + definition.sweepDegrees
  );
}

function sampleArc(
  centre: Point2,
  radius: number,
  startDegrees: number,
  sweepDegrees: number
): Point2[] {
  return Array.from({ length: ORBIT_SAMPLE_COUNT + 1 }, (_, index) =>
    pointOnCircle(
      centre,
      radius,
      startDegrees + (sweepDegrees * index) / ORBIT_SAMPLE_COUNT
    )
  );
}

/**
 * Four 75-degree dwell zones advancing every 55 degrees across the 240-degree
 * walk. The 20-degree overlaps remove the single-trigger failure mode: reaching
 * a later zone implicitly satisfies the earlier ones, so one missed boundary
 * event can never strand the visitor mid-orbit.
 */
function activationZones(
  shrineId: FirstFireShrineId,
  startDegrees: number,
  sweepDegrees: number
): FireProcessionActivationZone[] {
  const direction = Math.sign(sweepDegrees);
  return Array.from({ length: 4 }, (_, index) => ({
    id: `${shrineId}-orbit-${index + 1}`,
    startDegrees: startDegrees + direction * index * 55,
    sweepDegrees: direction * 75,
  }));
}

function regularPolygon(centre: Point2, radius: number, count = 16): Point2[] {
  return Array.from({ length: count }, (_, index) =>
    pointOnCircle(centre, radius, (index * 360) / count)
  );
}

function translatePoint(point: Point2, x: number, z: number): Point2 {
  return { x: point.x + x, z: point.z + z };
}

function translateRect(rect: WorldRect, x: number, z: number): WorldRect {
  return {
    minX: rect.minX + x,
    maxX: rect.maxX + x,
    minZ: rect.minZ + z,
    maxZ: rect.maxZ + z,
  };
}

function polygonBounds(polygon: readonly Point2[]): WorldRect {
  return {
    minX: Math.min(...polygon.map((point) => point.x)),
    maxX: Math.max(...polygon.map((point) => point.x)),
    minZ: Math.min(...polygon.map((point) => point.z)),
    maxZ: Math.max(...polygon.map((point) => point.z)),
  };
}

function rectPolygon(rect: WorldRect): Point2[] {
  return [
    { x: rect.minX, z: rect.minZ },
    { x: rect.maxX, z: rect.minZ },
    { x: rect.maxX, z: rect.maxZ },
    { x: rect.minX, z: rect.maxZ },
  ];
}

/**
 * One continuous mitred wall strip flanking a whole corridor on one side. The
 * mitre join keeps the floor edge exactly `halfWidth` from every segment — no
 * band ever juts across a bend's floor and no wedge gap opens on the outside.
 */
function corridorSideStrip(
  points: readonly Point2[],
  halfWidth: number,
  side: 1 | -1,
  thickness = WALL_BAND_THICKNESS
): Point2[] {
  const unit = (from: Point2, to: Point2) => {
    const length = Math.hypot(to.x - from.x, to.z - from.z) || 1;
    return { x: (to.x - from.x) / length, z: (to.z - from.z) / length };
  };
  const perp = (d: { x: number; z: number }) => ({ x: -d.z * side, z: d.x * side });
  const inner: Point2[] = [];
  const outer: Point2[] = [];
  for (let index = 0; index < points.length; index++) {
    const at = points[index]!;
    const before = index > 0 ? perp(unit(points[index - 1]!, at)) : null;
    const after = index < points.length - 1 ? perp(unit(at, points[index + 1]!)) : null;
    let normal = before ?? after!;
    let scale = 1;
    if (before && after) {
      const sum = { x: before.x + after.x, z: before.z + after.z };
      const sumLength = Math.hypot(sum.x, sum.z) || 1e-6;
      normal = { x: sum.x / sumLength, z: sum.z / sumLength };
      scale = 1 / Math.max(0.35, normal.x * before.x + normal.z * before.z);
    }
    inner.push({
      x: at.x + normal.x * halfWidth * scale,
      z: at.z + normal.z * halfWidth * scale,
    });
    outer.push({
      x: at.x + normal.x * (halfWidth + thickness) * scale,
      z: at.z + normal.z * (halfWidth + thickness) * scale,
    });
  }
  return [...inner, ...outer.reverse()];
}

/**
 * Mitred parallel offset of a polyline — used to keep fire lanes off the walk
 * centreline (recorded decision: flame never overlaps the centreline).
 */
function offsetPolyline(points: readonly Point2[], offset: number): Point2[] {
  const unit = (from: Point2, to: Point2) => {
    const length = Math.hypot(to.x - from.x, to.z - from.z) || 1;
    return { x: (to.x - from.x) / length, z: (to.z - from.z) / length };
  };
  const perp = (d: { x: number; z: number }) => ({ x: -d.z, z: d.x });
  return points.map((at, index) => {
    const before = index > 0 ? perp(unit(points[index - 1]!, at)) : null;
    const after = index < points.length - 1 ? perp(unit(at, points[index + 1]!)) : null;
    let normal = before ?? after!;
    let scale = 1;
    if (before && after) {
      const sum = { x: before.x + after.x, z: before.z + after.z };
      const sumLength = Math.hypot(sum.x, sum.z) || 1e-6;
      normal = { x: sum.x / sumLength, z: sum.z / sumLength };
      scale = 1 / Math.max(0.35, normal.x * before.x + normal.z * before.z);
    }
    return { x: at.x + normal.x * offset * scale, z: at.z + normal.z * offset * scale };
  });
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/**
 * Annulus arc segments between gap azimuths. Each returned polygon is one arc
 * band from an inner to an outer radius. Gaps must not overlap.
 */
function annulusSegments(
  idPrefix: string,
  centre: Point2,
  innerRadius: number,
  outerRadius: number,
  gaps: ReadonlyArray<{ azimuthDegrees: number; halfDegrees: number }>,
  minimumHeight: number
): Array<{ id: string; polygon: Point2[]; minimumHeight: number }> {
  const sorted = [...gaps].sort(
    (a, b) => normalizeDegrees(a.azimuthDegrees) - normalizeDegrees(b.azimuthDegrees)
  );
  const segments: Array<{ id: string; polygon: Point2[]; minimumHeight: number }> = [];
  for (let index = 0; index < sorted.length; index++) {
    const current = sorted[index]!;
    const next = sorted[(index + 1) % sorted.length]!;
    const start = normalizeDegrees(current.azimuthDegrees) + current.halfDegrees;
    let end = normalizeDegrees(next.azimuthDegrees) - next.halfDegrees;
    if (end <= start) end += 360;
    const sweep = end - start;
    if (sweep < 2) continue;
    const steps = Math.max(2, Math.ceil(sweep / 12));
    const innerArc = Array.from({ length: steps + 1 }, (_, step) =>
      pointOnCircle(centre, innerRadius, start + (sweep * step) / steps)
    );
    const outerArc = Array.from({ length: steps + 1 }, (_, step) =>
      pointOnCircle(centre, outerRadius, end - (sweep * step) / steps)
    );
    segments.push({
      id: `${idPrefix}-arc-${index + 1}`,
      polygon: [...innerArc, ...outerArc],
      minimumHeight,
    });
  }
  return segments;
}

const THRESHOLD: WorldRect = { minX: 0, maxX: 7.5, minZ: 19.5, maxZ: 24.5 };

/**
 * Corridor centrelines. Widths are deliberately generous: the rejected interior
 * used 3 m transfers and read as claustrophobic in first person.
 */
const CORRIDOR_DEFINITIONS = [
  {
    id: "water-to-dj",
    width: TRANSFER_WIDTH,
    points: [
      { x: 0, z: 22 },
      { x: 7, z: 22 },
      { x: 11, z: 19 },
      { x: 13, z: 19.5 },
      { x: 13, z: 17.7 },
    ],
  },
  {
    id: "dj-to-ek",
    width: TRANSFER_WIDTH,
    points: [
      { x: 19.669, z: 6.15 },
      { x: 21.66, z: 5 },
      { x: 23, z: 12 },
      { x: 22, z: 20 },
      { x: 24.5, z: 24 },
      { x: 29, z: 24.5 },
      { x: 29, z: 26.3 },
    ],
  },
  {
    id: "ek-to-fl",
    width: TRANSFER_WIDTH,
    points: [
      { x: 35.669, z: 37.85 },
      { x: 37.66, z: 39 },
      { x: 42, z: 38 },
      { x: 44, z: 30 },
      { x: 41, z: 22 },
      { x: 37, z: 18 },
      { x: 35.5, z: 14 },
      { x: 37.563, z: 12.993 },
    ],
  },
  {
    id: "earth-growth",
    width: GROWTH_WIDTH,
    points: [
      { x: 50.445, z: 16.445 },
      { x: 52.5, z: 19 },
      { x: 54, z: 24 },
      { x: 55.5, z: 30 },
      { x: 58, z: 34 },
    ],
  },
] as const;

/**
 * Solid uncarved regions modelled explicitly so sightline maths is honest. The
 * east rib (`east-green-rib`) is the one that keeps the green Earth path out of
 * view until the visitor has walked all three shrines.
 */
const FILLER_ROCKS: ReadonlyArray<{ id: string; rect: WorldRect }> = [
  { id: "north-west", rect: { minX: 0.4, maxX: 4, minZ: 0.4, maxZ: 19.4 } },
  { id: "west-south", rect: { minX: 0.4, maxX: 9, minZ: 24.7, maxZ: 43.6 } },
  { id: "south-west-mid", rect: { minX: 9, maxX: 19.5, minZ: 24.7, maxZ: 43.6 } },
  { id: "dj-south-shoulder", rect: { minX: 14, maxX: 19.5, minZ: 19.5, maxZ: 24.7 } },
  { id: "north-central", rect: { minX: 26, maxX: 36.8, minZ: 0.4, maxZ: 12 } },
  { id: "north-central-south", rect: { minX: 26, maxX: 33.5, minZ: 12, maxZ: 22 } },
  { id: "mid-central", rect: { minX: 33, maxX: 38, minZ: 22, maxZ: 28 } },
  { id: "north-east-strip", rect: { minX: 36, maxX: 58, minZ: 0.4, maxZ: 2.2 } },
  { id: "east-flank", rect: { minX: 54.5, maxX: 58, minZ: 2.2, maxZ: 14 } },
  { id: "east-green-rib", rect: { minX: 47, maxX: 50, minZ: 20, maxZ: 33 } },
  { id: "south-east", rect: { minX: 46, maxX: 53, minZ: 33, maxZ: 43.6 } },
  { id: "south-east-corner", rect: { minX: 53, maxX: 58, minZ: 36.5, maxZ: 43.6 } },
  { id: "south-east-mid", rect: { minX: 53, maxX: 55, minZ: 33, maxZ: 36.5 } },
] as const;

interface LocalBasalt {
  id: string;
  polygon: Point2[];
  minimumHeight: number;
}

function buildLocalBasalt(): LocalBasalt[] {
  const masses: LocalBasalt[] = [];

  for (const corridor of CORRIDOR_DEFINITIONS) {
    for (const side of [1, -1] as const) {
      masses.push({
        id: `${corridor.id}-wall-${side === 1 ? "s" : "n"}`,
        polygon: corridorSideStrip(corridor.points, corridor.width / 2, side),
        minimumHeight: ROCK_HEIGHT,
      });
    }
  }

  // Each shrine's rim ring has exactly two gaps: the entry mouth and the exit
  // mouth. The 120-degree un-walked sector is solid, which is what stops one
  // shrine's court from ever seeing into another.
  for (const definition of SHRINE_DEFINITIONS) {
    const exitDegrees = definition.entryDegrees + definition.sweepDegrees;
    masses.push(
      ...annulusSegments(
        `${definition.id}-court-rim`,
        definition.centre,
        COURT_FLOOR_RADIUS,
        COURT_WALL_OUTER,
        [
          { azimuthDegrees: definition.entryDegrees, halfDegrees: COURT_GATE_HALF_DEGREES },
          { azimuthDegrees: exitDegrees, halfDegrees: COURT_GATE_HALF_DEGREES },
        ],
        COURT_WALL_HEIGHT
      )
    );
  }

  masses.push(
    ...FILLER_ROCKS.map((rock) => ({
      id: `fill-${rock.id}`,
      polygon: rectPolygon(rock.rect),
      minimumHeight: ROCK_HEIGHT,
    }))
  );

  return masses;
}

function flattenPath(sections: readonly FireProcessionPathSection[]): Point2[] {
  const points: Point2[] = [];
  for (const section of sections) {
    for (const point of section.points) {
      const previous = points.at(-1);
      if (previous && Math.hypot(previous.x - point.x, previous.z - point.z) < 1e-9) continue;
      points.push(point);
    }
  }
  return points;
}

function assertPlanFits(frame: FirstFireProcessionFrame): void {
  const width = frame.room.maxX - frame.room.minX;
  const depth = frame.room.maxZ - frame.room.minZ;
  if (width + 1e-9 < NOMINAL_WIDTH || depth + 1e-9 < NOMINAL_DEPTH) {
    throw new Error(
      `First Fire Torch Procession requires a ${NOMINAL_WIDTH} m by ${NOMINAL_DEPTH} m interior; ` +
        `compiled cave-fire is ${width.toFixed(1)} m by ${depth.toFixed(1)} m`
    );
  }
  for (const [side, door] of [["west", frame.westDoor], ["east", frame.eastDoor]] as const) {
    if (door.min < frame.room.minZ || door.max > frame.room.maxZ) {
      throw new Error(`First Fire ${side} door falls outside the room interior`);
    }
    if (door.max - door.min + 1e-9 < 4) {
      throw new Error(`First Fire ${side} door requires a 4 m clear span`);
    }
  }
}

export function buildFirstFireProcessionPlan(
  frame: FirstFireProcessionFrame
): FirstFireProcessionPlan {
  assertPlanFits(frame);
  const x0 = frame.room.minX;
  const z0 = frame.room.minZ + (frame.room.maxZ - frame.room.minZ - NOMINAL_DEPTH) / 2;
  const localPoint = (point: Point2) => translatePoint(point, x0, z0);
  const localRect = (rect: WorldRect) => translateRect(rect, x0, z0);
  const p = (x: number, z: number) => localPoint({ x, z });

  const shrines: FireProcessionShrine[] = SHRINE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    performerId: definition.performerId,
    sequenceId: definition.sequenceId,
    fireGrammar: definition.fireGrammar,
    centre: localPoint(definition.centre),
    courtPolygon: regularPolygon(localPoint(definition.centre), COURT_FLOOR_RADIUS),
    gateId: `${definition.id}-gate`,
    habitatRadius: HABITAT_RADIUS,
    trenchInnerRadius: TRENCH_INNER_RADIUS,
    trenchOuterRadius: TRENCH_OUTER_RADIUS,
    orbitRadius: ORBIT_RADIUS,
    orbitWidth: ORBIT_WIDTH,
    orbitStartDegrees: definition.entryDegrees,
    orbitSweepDegrees: definition.sweepDegrees,
    entry: localPoint(shrineEntry(definition)),
    exit: localPoint(shrineExit(definition)),
    activationZones: activationZones(
      definition.id,
      definition.entryDegrees,
      definition.sweepDegrees
    ),
  }));
  const shrineById = Object.fromEntries(shrines.map((shrine) => [shrine.id, shrine])) as Record<
    FirstFireShrineId,
    FireProcessionShrine
  >;

  const corridorById = Object.fromEntries(
    CORRIDOR_DEFINITIONS.map((corridor) => [
      corridor.id,
      corridor.points.map((point) => localPoint(point)),
    ])
  ) as Record<(typeof CORRIDOR_DEFINITIONS)[number]["id"], Point2[]>;

  const basaltMasses: FireProcessionBasaltMass[] = buildLocalBasalt().map((mass) => {
    const polygon = mass.polygon.map((point) => localPoint(point));
    return {
      id: mass.id,
      kind: "rock-rib" as const,
      polygon,
      rect: polygonBounds(polygon),
      minimumHeight: mass.minimumHeight,
    };
  });

  const gates: FireProcessionGate[] = SHRINE_DEFINITIONS.map((definition, index) => {
    const approachCorridor =
      definition.id === "dj"
        ? corridorById["water-to-dj"]
        : definition.id === "ek"
          ? corridorById["dj-to-ek"]
          : corridorById["ek-to-fl"];
    const mouth = localPoint(
      pointOnCircle(
        definition.centre,
        (COURT_FLOOR_RADIUS + COURT_WALL_OUTER) / 2,
        definition.entryDegrees
      )
    );
    return {
      id: `${definition.id}-gate`,
      shrineId: definition.id,
      width: TRANSFER_WIDTH,
      centre: mouth,
      beacon: mouth,
      // The last corridor vertex from which the performer is still hidden.
      // Everything after it is the blind turn into the mouth.
      approach:
        [...approachCorridor]
          .reverse()
          .find((point) =>
            isProcessionSightlineBlocked(point, localPoint(definition.centre), basaltMasses)
          ) ?? approachCorridor[0]!,
      courtThreshold: shrines[index]!.entry,
    };
  });

  const orbitPoints = (definition: ShrineDefinition) =>
    sampleArc(
      localPoint(definition.centre),
      ORBIT_RADIUS,
      definition.entryDegrees,
      definition.sweepDegrees
    );

  const westDoorCentre = (frame.westDoor.min + frame.westDoor.max) / 2;
  const eastDoorCentre = (frame.eastDoor.min + frame.eastDoor.max) / 2;

  const mouthStub = (
    id: string,
    shrineId: FirstFireShrineId,
    points: Point2[]
  ): FireProcessionPathSection => ({ id, kind: "shrine-mouth", shrineId, width: ORBIT_WIDTH, points });

  const pathSections: FireProcessionPathSection[] = [
    {
      id: "water-steam-threshold",
      kind: "steam-threshold",
      width: TRANSFER_WIDTH,
      points: [{ x: frame.room.minX, z: westDoorCentre }, p(4, 22)],
    },
    {
      id: "ember-bridge",
      kind: "ember-bridge",
      width: TRANSFER_WIDTH,
      points: [p(4, 22), p(7, 22)],
    },
    {
      id: "torch-lane-to-dj",
      kind: "shrine-approach",
      width: TRANSFER_WIDTH,
      points: [p(7, 22), p(11, 19), p(13, 19.5), p(13, 17.7)],
    },
    mouthStub("dj-mouth-in", "dj", [p(13, 17.7), shrineById.dj.entry]),
    {
      id: "dj-orbit",
      kind: "shrine-orbit",
      shrineId: "dj",
      width: ORBIT_WIDTH,
      points: orbitPoints(SHRINE_DEFINITIONS[0]!),
    },
    mouthStub("dj-mouth-out", "dj", [shrineById.dj.exit, p(19.669, 6.15)]),
    {
      id: "dj-to-ek",
      kind: "transfer",
      width: TRANSFER_WIDTH,
      points: [p(19.669, 6.15), p(21.66, 5), p(23, 12), p(22, 20), p(24.5, 24), p(29, 24.5), p(29, 26.3)],
    },
    mouthStub("ek-mouth-in", "ek", [p(29, 26.3), shrineById.ek.entry]),
    {
      id: "ek-orbit",
      kind: "shrine-orbit",
      shrineId: "ek",
      width: ORBIT_WIDTH,
      points: orbitPoints(SHRINE_DEFINITIONS[1]!),
    },
    mouthStub("ek-mouth-out", "ek", [shrineById.ek.exit, p(35.669, 37.85)]),
    {
      id: "ek-to-fl",
      kind: "transfer",
      width: TRANSFER_WIDTH,
      points: [
        p(35.669, 37.85),
        p(37.66, 39),
        p(42, 38),
        p(44, 30),
        p(41, 22),
        p(37, 18),
        p(35.5, 14),
        p(37.563, 12.993),
      ],
    },
    mouthStub("fl-mouth-in", "fl", [p(37.563, 12.993), shrineById.fl.entry]),
    {
      id: "fl-orbit",
      kind: "shrine-orbit",
      shrineId: "fl",
      width: ORBIT_WIDTH,
      points: orbitPoints(SHRINE_DEFINITIONS[2]!),
    },
    mouthStub("fl-mouth-out", "fl", [shrineById.fl.exit, p(50.445, 16.445)]),
    {
      id: "earth-growth-path",
      kind: "growth-path",
      width: GROWTH_WIDTH,
      points: [
        p(50.445, 16.445),
        p(52.5, 19),
        p(54, 24),
        p(55.5, 30),
        { x: frame.room.maxX, z: eastDoorCentre },
      ],
    },
  ];

  const perimeterLane = (definition: ShrineDefinition) =>
    sampleArc(
      localPoint(definition.centre),
      ORBIT_RADIUS + 1.9,
      definition.entryDegrees,
      definition.sweepDegrees
    );

  const guidePaths: FireProcessionGuidePath[] = [
    {
      id: "ember-bridge-lane",
      kind: "torch-lane",
      state: "always",
      collision: false,
      width: 0.6,
      points: offsetPolyline([p(4, 22), p(7, 22), p(11, 19)], 1.6),
    },
    // The mechanic Austen named: these ignite behind the visitor's steps as the
    // orbit advances, and collapse to coals when the shrine completes.
    {
      id: "dj-perimeter",
      kind: "fire-wall",
      state: "dj",
      collision: false,
      width: 0.8,
      points: perimeterLane(SHRINE_DEFINITIONS[0]!),
    },
    {
      id: "ek-perimeter",
      kind: "fire-wall",
      state: "ek",
      collision: false,
      width: 0.8,
      points: perimeterLane(SHRINE_DEFINITIONS[1]!),
    },
    {
      id: "fl-perimeter",
      kind: "fire-wall",
      state: "fl",
      collision: false,
      width: 0.8,
      points: perimeterLane(SHRINE_DEFINITIONS[2]!),
    },
    {
      id: "walked-route-coals",
      kind: "coal-memory",
      state: "extinguished",
      collision: false,
      width: 0.5,
      points: offsetPolyline(corridorById["dj-to-ek"], -1.6),
    },
    // State `extinguished` only. The green route does not exist as a visible
    // cue until every red source is out, so it cannot pull the visitor past a
    // performer they have not met.
    {
      id: "earth-growth",
      kind: "green-growth",
      state: "extinguished",
      collision: false,
      width: 1,
      points: pathSections.at(-1)!.points,
    },
  ];

  return {
    room: frame.room,
    centre: { x: frame.room.minX + NOMINAL_WIDTH / 2, z: z0 + NOMINAL_DEPTH / 2 },
    westDoor: frame.westDoor,
    eastDoor: frame.eastDoor,
    threshold: localRect(THRESHOLD),
    carved: {
      corridors: CORRIDOR_DEFINITIONS.map((corridor) => ({
        id: corridor.id,
        width: corridor.width,
        points: corridor.points.map((point) => localPoint(point)),
      })),
    },
    shrines,
    gates,
    basaltMasses,
    occluders: basaltMasses,
    guidePaths,
    pathSections,
    walkPath: flattenPath(pathSections),
    torchBudget: {
      laneStems: 24,
      perimeterStemsPerShrine: 12,
      maximumDetailedShrines: 1,
    },
  };
}

export function buildNominalFirstFireProcessionPlan(): FirstFireProcessionPlan {
  return buildFirstFireProcessionPlan({
    room: { minX: 0, maxX: 58, minZ: 0, maxZ: 44 },
    westDoor: { min: 20, max: 24 },
    eastDoor: { min: 32, max: 36 },
  });
}

/** The route meets each museum doorway through a mouth this wide. */
export const FIRST_FIRE_DOOR_MOUTH_METRES = 4;

/**
 * The plan laid on the compiled cave-fire room. The room is sized by
 * FIRST_FIRE_PROCESSION_AUTHORING_MINIMUM so the fit check always passes; the
 * doors are read from the stamped tiles, and each is widened to the route's
 * 4 m mouth around its real centre (the museum stamps 2 m doorways).
 */
export function buildFirstFireProcessionPlanForGrid(
  grid: MuseumGrid
): FirstFireProcessionPlan | null {
  const wing = grid.wings.find((candidate) => candidate.id === FIRST_FIRE_PROCESSION_ROOM_ID);
  if (!wing) return null;
  const westTiles = doorSpan(grid, FIRST_FIRE_PROCESSION_ROOM_ID, "west");
  const eastTiles = doorSpan(grid, FIRST_FIRE_PROCESSION_ROOM_ID, "east");
  if (!westTiles || !eastTiles)
    throw new Error("First Fire Torch Procession requires west and east doors");
  const room = interiorWorldRect(wing.bounds);
  const mouth = (span: Span) =>
    widenSpan(span, FIRST_FIRE_DOOR_MOUTH_METRES, room.minZ, room.maxZ);
  return {
    ...buildFirstFireProcessionPlan({
      room,
      westDoor: mouth(westTiles),
      eastDoor: mouth(eastTiles),
    }),
    doorTileSpans: { west: westTiles, east: eastTiles },
  };
}

export function pointInProcessionPolygon(
  point: Point2,
  polygon: readonly Point2[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const crosses = (a.z > point.z) !== (b.z > point.z) &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function cross(a: Point2, b: Point2, c: Point2): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

function onSegment(a: Point2, b: Point2, point: Point2): boolean {
  return Math.abs(cross(a, b, point)) < 1e-9 &&
    point.x >= Math.min(a.x, b.x) - 1e-9 && point.x <= Math.max(a.x, b.x) + 1e-9 &&
    point.z >= Math.min(a.z, b.z) - 1e-9 && point.z <= Math.max(a.z, b.z) + 1e-9;
}

function segmentsIntersect(a: Point2, b: Point2, c: Point2, d: Point2): boolean {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
      ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

export function segmentIntersectsPolygon(
  from: Point2,
  to: Point2,
  polygon: readonly Point2[]
): boolean {
  if (pointInProcessionPolygon(from, polygon) || pointInProcessionPolygon(to, polygon)) return true;
  return polygon.some((point, index) =>
    segmentsIntersect(from, to, point, polygon[(index + 1) % polygon.length]!)
  );
}

export function segmentIntersectsRect(from: Point2, to: Point2, rect: WorldRect): boolean {
  return segmentIntersectsPolygon(from, to, rectPolygon(rect));
}

export function isProcessionSightlineBlocked(
  from: Point2,
  to: Point2,
  occluders: readonly FireProcessionOccluder[]
): boolean {
  return occluders.some((occluder) => segmentIntersectsPolygon(from, to, occluder.polygon));
}

export function sampleProcessionPath(
  plan: FirstFireProcessionPlan,
  spacing = 0.2,
  direction: "forward" | "reverse" = "forward"
): Point2[] {
  const samples: Point2[] = [];
  for (const section of plan.pathSections) {
    for (let index = 0; index < section.points.length - 1; index++) {
      const from = section.points[index]!;
      const to = section.points[index + 1]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / spacing));
      for (let step = 0; step < steps; step++) {
        const t = step / steps;
        samples.push({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t });
      }
    }
  }
  samples.push(plan.walkPath.at(-1)!);
  return direction === "forward" ? samples : samples.reverse();
}
