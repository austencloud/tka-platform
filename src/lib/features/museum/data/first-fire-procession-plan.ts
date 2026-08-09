/**
 * Measured room-local geometry for the approved First Fire Cinder Court
 * navigation reset (2026-08-09): "one lit path at a time".
 *
 * The origin is the north-west interior corner. X runs from Water to Earth and
 * Z runs north to south. The room is solid basalt with carved corridors: a
 * circular hub (ember cairn) with four rim gates, and three deliberately
 * different courts — DJ canyon slot, EK sunken bowl, FL chimney rotunda.
 * Blender and runtime contracts derive from this owner; fire remains visual
 * guides and never becomes collision geometry.
 */
import type { MuseumGrid } from "../domain/museum-grid-types";
import {
  doorSpan,
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
  | "water-approach"
  | "shrine-approach"
  | "shrine-orbit"
  | "shrine-return"
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

export interface FireProcessionGate {
  id: string;
  shrineId: FirstFireShrineId;
  width: number;
  centre: Point2;
  beacon: Point2;
  hubApproach: Point2;
  /** The performer reveal begins only after this court-side point. */
  courtThreshold: Point2;
}

export type FireCourtSilhouette = "canyon-slot" | "sunken-bowl" | "chimney-rotunda";

export interface FireProcessionShrine {
  id: FirstFireShrineId;
  label: string;
  performerId: string;
  sequenceId: string;
  /** The three courts are deliberately different footprints and silhouettes. */
  silhouette: FireCourtSilhouette;
  centre: Point2;
  courtPolygon: Point2[];
  gateId: string;
  habitatRadius: number;
  trenchInnerRadius: number;
  trenchOuterRadius: number;
  orbitRadius: number;
  orbitWidth: number;
  orbitStartDegrees: number;
  orbitSweepDegrees: number;
  /** Entry and exit intentionally coincide at the one shared throat. */
  entry: Point2;
  exit: Point2;
  activationZones: FireProcessionActivationZone[];
}

export interface FireProcessionGuidePath {
  id: string;
  kind: "torch-field" | "fire-wall" | "coal-memory" | "green-growth";
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
  hub: WorldRect;
  hubCircle: { centre: Point2; radius: number };
  /** The carved walkable floor (corridors + hub + courts); everything else is rock. */
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
  torchBudget: {
    fieldStems: number;
    perimeterStemsPerShrine: number;
    maximumDetailedShrines: number;
  };
}

const NOMINAL_WIDTH = FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES.width;
const NOMINAL_DEPTH = FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES.depth;

const HUB_CENTRE: Point2 = { x: 20, z: 22 };
const HUB_RADIUS = 6.5;
const HUB: WorldRect = {
  minX: HUB_CENTRE.x - HUB_RADIUS,
  maxX: HUB_CENTRE.x + HUB_RADIUS,
  minZ: HUB_CENTRE.z - HUB_RADIUS,
  maxZ: HUB_CENTRE.z + HUB_RADIUS,
};
const HUB_RING_OUTER = 9;
const HABITAT_RADIUS = 2.0;
const TRENCH_INNER_RADIUS = 2.2;
const TRENCH_OUTER_RADIUS = 2.8;
const ORBIT_WIDTH = 2.4;
const ORBIT_SAMPLE_COUNT = 32;
const GATE_WIDTH = 3.5;
const WALL_BAND_THICKNESS = 1.2;
const ROCK_HEIGHT = 5.5;

interface CourtDefinition {
  id: FirstFireShrineId;
  label: string;
  performerId: string;
  sequenceId: string;
  silhouette: FireCourtSilhouette;
  centre: Point2;
  entry: Point2;
  orbitRadius: number;
  orbitStartDegrees: number;
  orbitSweepDegrees: number;
  gateCentre: Point2;
  hubApproach: Point2;
}

const COURT_DEFINITIONS: readonly CourtDefinition[] = [
  {
    id: "dj",
    label: "DJ",
    performerId: "cave-fire-automaton-dj",
    sequenceId: "cave-fire-seq-dj",
    silhouette: "canyon-slot",
    centre: { x: 6, z: 6.1 },
    entry: { x: 11.6, z: 8.7 },
    orbitRadius: 4.3,
    orbitStartDegrees: 22,
    orbitSweepDegrees: -50,
    gateCentre: { x: 15.62, z: 17.62 },
    hubApproach: { x: 17.5, z: 19.5 },
  },
  {
    id: "ek",
    label: "EK",
    performerId: "cave-fire-automaton-ek",
    sequenceId: "cave-fire-seq-ek",
    silhouette: "sunken-bowl",
    centre: { x: 18, z: 38 },
    // Tangential entry: the bowl mouth faces north-west, away from the hub,
    // so no straight ray can run gate → mouth → performer.
    entry: { x: 14.03, z: 36.23 },
    orbitRadius: 4.35,
    orbitStartDegrees: -156,
    orbitSweepDegrees: 360,
    gateCentre: { x: 20, z: 28.2 },
    hubApproach: { x: 20, z: 25.5 },
  },
  {
    id: "fl",
    label: "FL",
    performerId: "cave-fire-automaton-fl",
    sequenceId: "cave-fire-seq-fl",
    silhouette: "chimney-rotunda",
    centre: { x: 42, z: 10 },
    // Tangential entry: the rotunda mouth faces south-south-west into solid
    // rock, so its sight cone never reaches the hub or another corridor.
    entry: { x: 40.16, z: 13.94 },
    orbitRadius: 4.35,
    orbitStartDegrees: 115,
    orbitSweepDegrees: -360,
    gateCentre: { x: 24.38, z: 17.62 },
    hubApproach: { x: 22.5, z: 19.5 },
  },
] as const;

const DJ_COURT_RECT: WorldRect = { minX: 3, maxX: 12, minZ: 2.9, maxZ: 9.3 };
const EK_COURT = { centre: { x: 18, z: 38 }, floorRadius: 5.5, wallOuter: 6.8, mouthAzimuth: -156 };
const FL_COURT = { centre: { x: 42, z: 10 }, floorRadius: 5.6, wallOuter: 8, mouthAzimuth: 115 };
const EARTH_GATE: Point2 = { x: 24.38, z: 26.38 };

/** Corridor centrelines; walls derive from perpendicular offsets. */
const CORRIDOR_DEFINITIONS = [
  { id: "entry", width: 4, points: [{ x: 0, z: 22 }, { x: 13.5, z: 22 }] },
  {
    id: "dj",
    width: 3.5,
    points: [
      { x: 15.62, z: 17.62 },
      { x: 14.2, z: 12.4 },
      { x: 12.6, z: 9.8 },
    ],
  },
  {
    id: "ek",
    width: 3.5,
    points: [
      { x: 20, z: 28.2 },
      { x: 19.6, z: 30.2 },
      { x: 17, z: 30.2 },
      { x: 14.4, z: 30.8 },
      { x: 12.2, z: 32.2 },
      // The last wall segment bends with the walk toward the mouth so the
      // strip end-cap never crosses the exit; walls stop well outside the
      // rim-walk ring (r 4.35), whose flanks are the bowl gap's own edges.
      { x: 10.95, z: 34.0 },
      { x: 12.08, z: 35.2 },
    ],
  },
  {
    id: "fl",
    width: 3.5,
    points: [
      { x: 24.38, z: 17.62 },
      { x: 29, z: 16.2 },
      { x: 34.5, z: 16.6 },
      { x: 37.3, z: 17.2 },
      // Last wall segment bends with the walk into the mouth wedge; the
      // rotunda gap flanks take over as walls from here.
      { x: 39, z: 16 },
    ],
  },
  {
    id: "earth",
    width: 3.2,
    points: [
      { x: 24.38, z: 26.38 },
      { x: 30, z: 30 },
      { x: 40, z: 33 },
      { x: 50, z: 34 },
      { x: 58, z: 34 },
    ],
  },
] as const;

/** Solid uncarved regions modelled explicitly so sightline maths is honest. */
const FILLER_ROCKS: ReadonlyArray<{ id: string; rect: WorldRect }> = [
  { id: "north-field", rect: { minX: 18, maxX: 35.5, minZ: 0.4, maxZ: 8.7 } },
  { id: "north-east-strip", rect: { minX: 36, maxX: 58, minZ: 0.4, maxZ: 2.3 } },
  { id: "east-flank", rect: { minX: 49.8, maxX: 58, minZ: 2.3, maxZ: 31.5 } },
  { id: "west-mid", rect: { minX: 0.4, maxX: 10, minZ: 9.6, maxZ: 19.4 } },
  { id: "west-south", rect: { minX: 0.4, maxX: 9.0, minZ: 24.6, maxZ: 43.6 } },
  { id: "north-dj-east", rect: { minX: 14.5, maxX: 18, minZ: 0.4, maxZ: 8.7 } },
  { id: "west-ek-flank", rect: { minX: 9.0, maxX: 12.6, minZ: 24.6, maxZ: 30.0 } },
  { id: "bowl-west-flank", rect: { minX: 9.0, maxX: 11.2, minZ: 36.0, maxZ: 43.6 } },
  { id: "south-central", rect: { minX: 23.6, maxX: 38, minZ: 36.6, maxZ: 43.6 } },
  { id: "south-east", rect: { minX: 38, maxX: 49.8, minZ: 36.2, maxZ: 43.6 } },
  { id: "mid-east-a", rect: { minX: 29.5, maxX: 34, minZ: 19.4, maxZ: 27.4 } },
  { id: "mid-east-b", rect: { minX: 34, maxX: 49.5, minZ: 18.2, maxZ: 30.1 } },
  { id: "bowl-east-flank", rect: { minX: 21.9, maxX: 25.4, minZ: 30.6, maxZ: 33.0 } },
  { id: "earth-south-a", rect: { minX: 24.2, maxX: 27.5, minZ: 31.6, maxZ: 36.6 } },
  { id: "earth-south-b", rect: { minX: 27.5, maxX: 29.2, minZ: 32.5, maxZ: 36.6 } },
  { id: "earth-south-c", rect: { minX: 29.2, maxX: 36, minZ: 34.6, maxZ: 36.6 } },
  { id: "hub-north-shoulder", rect: { minX: 18, maxX: 29, minZ: 8.9, maxZ: 11.8 } },
  { id: "hub-north-east-pocket", rect: { minX: 21, maxX: 29.5, minZ: 11.8, maxZ: 14.6 } },
] as const;

function pointOnCircle(centre: Point2, radius: number, degrees: number): Point2 {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: centre.x + Math.cos(radians) * radius,
    z: centre.z + Math.sin(radians) * radius,
  };
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
 * Four overlapping dwell zones scaled to the court's viewing sweep. For a full
 * 360-degree walk the zones step 85 degrees with 105-degree sweeps (20-degree
 * overlaps); shallower arcs scale proportionally.
 */
function activationZones(
  shrineId: FirstFireShrineId,
  startDegrees: number,
  sweepDegrees: number
): FireProcessionActivationZone[] {
  const direction = Math.sign(sweepDegrees);
  const scale = Math.abs(sweepDegrees) / 360;
  return Array.from({ length: 4 }, (_, index) => ({
    id: `${shrineId}-orbit-${index + 1}`,
    startDegrees: startDegrees + direction * index * 85 * scale,
    sweepDegrees: direction * 105 * scale,
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
 * band from an inner to an outer radius.
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

function azimuthDegrees(centre: Point2, point: Point2): number {
  return (Math.atan2(point.z - centre.z, point.x - centre.x) * 180) / Math.PI;
}

interface LocalBasalt {
  id: string;
  polygon: Point2[];
  minimumHeight: number;
}

function buildLocalBasalt(): LocalBasalt[] {
  const masses: LocalBasalt[] = [];

  // One mitred wall strip per corridor side. EK's strips are thin because
  // they back onto the bowl's annulus band, which must stay outside the
  // bowl floor radius.
  for (const corridor of CORRIDOR_DEFINITIONS) {
    const thickness = corridor.id === "ek" || corridor.id === "fl" ? 0.6 : WALL_BAND_THICKNESS;
    for (const side of [1, -1] as const) {
      masses.push({
        id: `${corridor.id}-wall-${side === 1 ? "s" : "n"}`,
        polygon: corridorSideStrip(corridor.points, corridor.width / 2, side, thickness),
        minimumHeight: ROCK_HEIGHT,
      });
    }
  }

  // Hub ring with five openings: entry mouth plus four gates.
  const hubGaps = [
    { azimuthDegrees: 180, halfDegrees: 19 },
    ...COURT_DEFINITIONS.map((court) => ({
      // EK's gap is wider and biased west (95° ± 29°) so its corridor can
      // wrap through the hub-ring/bowl-wall channel. It must stay disjoint
      // from the Earth gate's gap or the arc segmentation corrupts.
      azimuthDegrees:
        court.id === "ek" ? 95 : azimuthDegrees(HUB_CENTRE, court.gateCentre),
      halfDegrees: court.id === "ek" ? 29 : 18,
    })),
    { azimuthDegrees: azimuthDegrees(HUB_CENTRE, EARTH_GATE), halfDegrees: 18 },
  ];
  masses.push(
    ...annulusSegments("hub-ring", HUB_CENTRE, HUB_RADIUS, HUB_RING_OUTER, hubGaps, ROCK_HEIGHT)
  );

  // DJ canyon slot: high walls on north, south and west; jambs at the mouth.
  const dj = DJ_COURT_RECT;
  const djWalls: Array<{ id: string; rect: WorldRect }> = [
    { id: "dj-court-north", rect: { minX: 0.9, maxX: 14.5, minZ: 0.9, maxZ: dj.minZ } },
    { id: "dj-court-south", rect: { minX: 0.9, maxX: 10.5, minZ: dj.maxZ, maxZ: 11.6 } },
    { id: "dj-court-west", rect: { minX: 0.9, maxX: dj.minX, minZ: 0.9, maxZ: 11.6 } },
    { id: "dj-court-jamb-north", rect: { minX: dj.maxX, maxX: 14.5, minZ: dj.minZ, maxZ: 7.3 } },
  ];
  masses.push(
    ...djWalls.map((wall) => ({
      id: wall.id,
      polygon: rectPolygon(wall.rect),
      minimumHeight: 7.5,
    }))
  );

  // EK sunken bowl: a low rim ring; the mouth faces north-west, away from the hub.
  masses.push(
    ...annulusSegments(
      "ek-court-rim",
      EK_COURT.centre,
      EK_COURT.floorRadius,
      EK_COURT.wallOuter,
      [{ azimuthDegrees: EK_COURT.mouthAzimuth, halfDegrees: 22 }],
      3
    )
  );

  // FL chimney rotunda: a tall cylinder; the mouth faces south-south-west into rock.
  masses.push(
    ...annulusSegments(
      "fl-court-shaft",
      FL_COURT.centre,
      FL_COURT.floorRadius,
      FL_COURT.wallOuter,
      [{ azimuthDegrees: FL_COURT.mouthAzimuth, halfDegrees: 20 }],
      12
    )
  );

  // Solid uncarved interior regions.
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
      `First Fire Cinder Court requires a ${NOMINAL_WIDTH} m by ${NOMINAL_DEPTH} m interior; ` +
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

  const gates: FireProcessionGate[] = [
    ...COURT_DEFINITIONS.map((definition) => ({
      id: `${definition.id}-gate`,
      shrineId: definition.id,
      width: GATE_WIDTH,
      centre: localPoint(definition.gateCentre),
      beacon: localPoint(definition.gateCentre),
      hubApproach: localPoint(definition.hubApproach),
      courtThreshold: localPoint(definition.entry),
    })),
  ];

  const shrines: FireProcessionShrine[] = COURT_DEFINITIONS.map((definition) => {
    const centre = localPoint(definition.centre);
    const entry = localPoint(definition.entry);
    const courtPolygon =
      definition.id === "dj"
        ? rectPolygon(localRect(DJ_COURT_RECT))
        : definition.id === "ek"
          ? regularPolygon(localPoint(EK_COURT.centre), EK_COURT.floorRadius)
          : regularPolygon(localPoint(FL_COURT.centre), FL_COURT.floorRadius);
    return {
      id: definition.id,
      label: definition.label,
      performerId: definition.performerId,
      sequenceId: definition.sequenceId,
      silhouette: definition.silhouette,
      centre,
      courtPolygon,
      gateId: `${definition.id}-gate`,
      habitatRadius: HABITAT_RADIUS,
      trenchInnerRadius: TRENCH_INNER_RADIUS,
      trenchOuterRadius: TRENCH_OUTER_RADIUS,
      orbitRadius: definition.orbitRadius,
      orbitWidth: ORBIT_WIDTH,
      orbitStartDegrees: definition.orbitStartDegrees,
      orbitSweepDegrees: definition.orbitSweepDegrees,
      entry,
      exit: { ...entry },
      activationZones: activationZones(
        definition.id,
        definition.orbitStartDegrees,
        definition.orbitSweepDegrees
      ),
    };
  });
  const shrineById = Object.fromEntries(shrines.map((shrine) => [shrine.id, shrine])) as Record<
    FirstFireShrineId,
    FireProcessionShrine
  >;
  const p = (x: number, z: number) => localPoint({ x, z });
  const orbitPoints = (shrine: FireProcessionShrine, definition: CourtDefinition) => {
    const points = sampleArc(
      localPoint(definition.centre),
      shrine.orbitRadius,
      shrine.orbitStartDegrees,
      shrine.orbitSweepDegrees
    );
    points[0] = shrine.entry;
    points[points.length - 1] = shrine.exit;
    return points;
  };
  const definitionById = Object.fromEntries(
    COURT_DEFINITIONS.map((definition) => [definition.id, definition])
  ) as Record<FirstFireShrineId, CourtDefinition>;

  const pathSections: FireProcessionPathSection[] = [
    {
      id: "water-to-hub",
      kind: "water-approach",
      width: 4,
      points: [
        { x: frame.room.minX, z: (frame.westDoor.min + frame.westDoor.max) / 2 },
        p(8, 22),
        p(13.5, 22),
        p(18, 22),
      ],
    },
    {
      id: "hub-to-dj",
      kind: "shrine-approach",
      shrineId: "dj",
      width: 3,
      points: [p(18, 22), p(17.5, 19.5), p(15.62, 17.62), p(14.2, 12.4), p(12.6, 9.8), shrineById.dj.entry],
    },
    {
      id: "dj-orbit",
      kind: "shrine-orbit",
      shrineId: "dj",
      width: ORBIT_WIDTH,
      points: orbitPoints(shrineById.dj, definitionById.dj),
    },
    {
      id: "dj-return-to-hub",
      kind: "shrine-return",
      shrineId: "dj",
      width: 3,
      points: [shrineById.dj.exit, p(12.6, 9.8), p(14.2, 12.4), p(15.62, 17.62), p(17.5, 19.5), p(18, 21)],
    },
    {
      id: "hub-to-ek",
      kind: "shrine-approach",
      shrineId: "ek",
      width: 3,
      points: [p(18, 21), p(20, 25.5), p(20, 28.2), p(19.6, 30.2), p(17, 30.2), p(14.4, 30.8), p(12.2, 32.2), p(10.95, 34.0), p(12.08, 35.2), shrineById.ek.entry],
    },
    {
      id: "ek-orbit",
      kind: "shrine-orbit",
      shrineId: "ek",
      width: ORBIT_WIDTH,
      points: orbitPoints(shrineById.ek, definitionById.ek),
    },
    {
      id: "ek-return-to-hub",
      kind: "shrine-return",
      shrineId: "ek",
      width: 3,
      points: [shrineById.ek.exit, p(12.08, 35.2), p(10.95, 34.0), p(12.2, 32.2), p(14.4, 30.8), p(17, 30.2), p(19.6, 30.2), p(20, 28.2), p(20, 25.5), p(21, 23)],
    },
    {
      id: "hub-to-fl",
      kind: "shrine-approach",
      shrineId: "fl",
      width: 3,
      points: [p(21, 23), p(22.5, 19.5), p(24.38, 17.62), p(29, 16.2), p(34.5, 16.6), p(37.3, 17.2), p(39, 16), shrineById.fl.entry],
    },
    {
      id: "fl-orbit",
      kind: "shrine-orbit",
      shrineId: "fl",
      width: ORBIT_WIDTH,
      points: orbitPoints(shrineById.fl, definitionById.fl),
    },
    {
      id: "fl-return-to-hub",
      kind: "shrine-return",
      shrineId: "fl",
      width: 3,
      points: [shrineById.fl.exit, p(39, 16), p(37.3, 17.2), p(34.5, 16.6), p(29, 16.2), p(24.38, 17.62), p(22.5, 19.5), p(24, 24)],
    },
    {
      id: "earth-growth-path",
      kind: "growth-path",
      width: 3.2,
      points: [
        p(24, 24),
        p(24.38, 26.38),
        p(30, 30),
        p(40, 33),
        p(50, 34),
        { x: frame.room.maxX, z: (frame.eastDoor.min + frame.eastDoor.max) / 2 },
      ],
    },
  ];

  const basaltMasses: FireProcessionBasaltMass[] = buildLocalBasalt().map((mass) => {
    const polygon = mass.polygon.map((point) => localPoint(point));
    return {
      id: mass.id,
      kind: "rock-rib",
      polygon,
      rect: polygonBounds(polygon),
      minimumHeight: mass.minimumHeight,
    };
  });

  const guidePaths: FireProcessionGuidePath[] = [
    {
      id: "hub-cairn",
      kind: "torch-field",
      state: "always",
      collision: false,
      width: 0.4,
      points: regularPolygon(localPoint(HUB_CENTRE), 1.2, 8),
    },
    {
      id: "dj-live-lane",
      kind: "fire-wall",
      state: "dj",
      collision: false,
      width: 0.8,
      // Offset 1.1 m off the walk centreline — flame flanks the path, never sits on it.
      points: offsetPolyline(
        [p(17.5, 19.5), p(15.62, 17.62), p(14.2, 12.4), p(12.6, 9.8)],
        1.1
      ),
    },
    {
      id: "ek-live-lane",
      kind: "fire-wall",
      state: "ek",
      collision: false,
      width: 0.8,
      points: offsetPolyline(
        [p(20, 25.5), p(20, 28.2), p(19.6, 30.2), p(17, 30.2), p(14.4, 30.8), p(12.2, 32.2), p(10.95, 34.0)],
        1.1
      ),
    },
    {
      id: "fl-live-lane",
      kind: "fire-wall",
      state: "fl",
      collision: false,
      width: 0.8,
      points: offsetPolyline(
        [p(22.5, 19.5), p(24.38, 17.62), p(29, 16.2), p(34.5, 16.6), p(37.3, 17.2)],
        1.1
      ),
    },
    {
      id: "completed-lanes",
      kind: "coal-memory",
      state: "extinguished",
      collision: false,
      width: 0.5,
      points: offsetPolyline(
        [p(12.6, 9.8), p(14.2, 12.4), p(15.62, 17.62), p(20, 28.2), p(19.6, 30.2), p(14.4, 30.8)],
        -1.1
      ),
    },
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
    hub: localRect(HUB),
    hubCircle: { centre: localPoint(HUB_CENTRE), radius: HUB_RADIUS },
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
    torchBudget: { fieldStems: 72, perimeterStemsPerShrine: 18, maximumDetailedShrines: 1 },
  };
}

export function buildNominalFirstFireProcessionPlan(): FirstFireProcessionPlan {
  return buildFirstFireProcessionPlan({
    room: { minX: 0, maxX: 58, minZ: 0, maxZ: 44 },
    westDoor: { min: 20, max: 24 },
    eastDoor: { min: 32, max: 36 },
  });
}

/**
 * The current live 46.5 by 20.5 m Fire shell must reject this isolated Gate 2
 * proposal. World placement and adjacent-room integration belong to Gate 5.
 */
export function buildFirstFireProcessionPlanForGrid(
  grid: MuseumGrid
): FirstFireProcessionPlan | null {
  const wing = grid.wings.find((candidate) => candidate.id === FIRST_FIRE_PROCESSION_ROOM_ID);
  if (!wing) return null;
  const westDoor = doorSpan(grid, FIRST_FIRE_PROCESSION_ROOM_ID, "west");
  const eastDoor = doorSpan(grid, FIRST_FIRE_PROCESSION_ROOM_ID, "east");
  if (!westDoor || !eastDoor) throw new Error("First Fire Cinder Court requires west and east doors");
  return buildFirstFireProcessionPlan({ room: interiorWorldRect(wing.bounds), westDoor, eastDoor });
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
  return segmentIntersectsPolygon(from, to, [
    { x: rect.minX, z: rect.minZ },
    { x: rect.maxX, z: rect.minZ },
    { x: rect.maxX, z: rect.maxZ },
    { x: rect.minX, z: rect.maxZ },
  ]);
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
