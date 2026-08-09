/**
 * Measured Gate 1 candidate for the Earth Long Terrace.
 *
 * This is a proposed experience plan, not the live Earth terrain. It consumes
 * the compiled cave shell and its real Fire and Air doors, then owns every
 * coordinate used by the floor-plan board and its sightline tests. The rejected
 * Root Observatory remains historical evidence; Blender work must not begin
 * from either candidate until this plan passes Gate 1.
 */
import type { MuseumGrid } from "../domain/museum-grid-types";
import {
  doorSpan,
  interiorWorldRect,
  type Point2,
  type Span,
  type WorldRect,
} from "./drowned-gallery-terrain";

export const EARTH_LONG_TERRACE_ROOM_ID = "cave-earth";
export const EARTH_LONG_TERRACE_NOMINAL_SIZE = {
  width: 34,
  depth: 24,
} as const;
export const EARTH_LONG_TERRACE_ROUTE_WIDTH = 2.4;
export const EARTH_LONG_TERRACE_EYE_HEIGHT = 1.65;
export const EARTH_LONG_TERRACE_TERRACE_Y = -0.6;
export const EARTH_LONG_TERRACE_STAGE_Y = -4.2;
export const EARTH_LONG_TERRACE_CAMERA_VERTICAL_FOV = 75;
export const EARTH_LONG_TERRACE_CAMERA_ASPECT = 16 / 9;
export const EARTH_LONG_TERRACE_SAMPLE_INTERVAL = 0.2;
export const EARTH_LONG_TERRACE_PERFORMER_ORDER = ["g", "h", "i"] as const;

export type EarthLongTerracePerformerId =
  (typeof EARTH_LONG_TERRACE_PERFORMER_ORDER)[number];

export interface EarthLongTerraceRoutePoint extends Point2 {
  elevation: number;
}

export interface EarthLongTerraceStop extends EarthLongTerraceRoutePoint {
  id: string;
  number: number;
  title: string;
  focus: string;
  experience: string;
  roomResponse: string;
}

export interface EarthLongTerracePerformer {
  id: EarthLongTerracePerformerId;
  label: "G" | "H" | "I";
  performerId: string;
  sequenceId: string;
  centre: Point2;
  facing: "south";
  stageElevation: number;
  stageRadius: number;
  bodyHeight: number;
  literalMotion: string;
  traceShape: "twin-rings" | "four-petal" | "ring-and-petal";
  traceMeaning: string;
}

export interface EarthLongTerraceHabitatMass {
  id: string;
  label: string;
  centre: Point2;
  radiusX: number;
  radiusZ: number;
  maximumElevation: number;
  density: "fern" | "moss" | "root-cliff";
}

export interface EarthLongTerracePlan {
  room: WorldRect;
  westDoor: Span;
  southDoor: Span;
  routeWidth: number;
  eyeHeight: number;
  terraceElevation: number;
  stageElevation: number;
  performerClock: {
    timing: "together";
    handPath: "same";
    loop: "continuous";
  };
  performers: EarthLongTerracePerformer[];
  habitatMasses: EarthLongTerraceHabitatMass[];
  walkPath: EarthLongTerraceRoutePoint[];
  stops: EarthLongTerraceStop[];
  revealBlocker: WorldRect;
  publicTerrace: WorldRect;
  viewingRibbon: {
    start: Point2;
    end: Point2;
    width: number;
  };
  terraceViewEdge: {
    start: Point2;
    end: Point2;
    elevation: number;
  };
  finalStand: {
    centre: EarthLongTerraceRoutePoint;
    radius: number;
  };
  finalCamera: {
    position: EarthLongTerraceRoutePoint;
    target: Point2;
    targetElevation: number;
    verticalFovDegrees: number;
    aspect: number;
  };
  interactionZones: Array<{
    performerId: EarthLongTerracePerformerId;
    centre: Point2;
    radius: number;
  }>;
  traceWall: WorldRect;
  canyonShelfElevations: number[];
}

const LOCAL_PERFORMERS = [
  {
    id: "g",
    label: "G",
    performerId: "cave-earth-automaton-g",
    sequenceId: "cave-earth-seq-g",
    centre: { x: 19, z: 9.5 },
    literalMotion:
      "Both hands travel extension-to-extension together; both props rotate pro.",
    traceShape: "twin-rings",
    traceMeaning: "Two continuous rings retain G's matched pro rotations.",
  },
  {
    id: "h",
    label: "H",
    performerId: "cave-earth-automaton-h",
    sequenceId: "cave-earth-seq-h",
    centre: { x: 22.5, z: 9.5 },
    literalMotion:
      "Both hands travel extension-to-extension together; both props rotate anti.",
    traceShape: "four-petal",
    traceMeaning: "A paired petal trace retains H's matched anti rotations.",
  },
  {
    id: "i",
    label: "I",
    performerId: "cave-earth-automaton-i",
    sequenceId: "cave-earth-seq-i",
    centre: { x: 26, z: 9.5 },
    literalMotion:
      "Both hands share the same path and clock; blue is anti while red is pro.",
    traceShape: "ring-and-petal",
    traceMeaning:
      "H's blue petal and G's red ring remain legible inside one shared clock.",
  },
] as const;

const LOCAL_PATH: EarthLongTerraceRoutePoint[] = [
  { x: 0, z: 12, elevation: 0 },
  { x: 5.5, z: 12, elevation: -0.15 },
  { x: 8, z: 16.2, elevation: -0.42 },
  { x: 11.5, z: 19.4, elevation: EARTH_LONG_TERRACE_TERRACE_Y },
  { x: 19, z: 19.4, elevation: EARTH_LONG_TERRACE_TERRACE_Y },
  { x: 22.5, z: 19.4, elevation: EARTH_LONG_TERRACE_TERRACE_Y },
  { x: 26, z: 19.4, elevation: EARTH_LONG_TERRACE_TERRACE_Y },
  { x: 24.5, z: 15.2, elevation: EARTH_LONG_TERRACE_TERRACE_Y },
  { x: 29.5, z: 19, elevation: -0.35 },
  { x: 32.5, z: 24, elevation: 0 },
];

const LOCAL_STOPS = [
  {
    id: "fire-threshold",
    number: 1,
    pathIndex: 0,
    title: "Fire threshold",
    focus: "A cool seam around the blind turn",
    experience: "Fire disappears before Earth is revealed.",
    roomResponse: "Heat, orange light, and ceiling pressure fall away.",
  },
  {
    id: "trio-reveal",
    number: 2,
    pathIndex: 3,
    title: "Daylight reveal",
    focus: "G, H, and I already moving on one clock",
    experience: "The canyon opens as one wide, readable composition.",
    roomResponse: "Cool daylight lands on the performers before the scenery.",
  },
  {
    id: "performer-g",
    number: 3,
    pathIndex: 4,
    title: "G comparison",
    focus: "Matched pro rotations",
    experience: "G is closest, but H and I remain visible beside it.",
    roomResponse: "Twin ring traces begin retaining on the far wall.",
  },
  {
    id: "performer-h",
    number: 4,
    pathIndex: 5,
    title: "H comparison",
    focus: "Matched anti rotations",
    experience:
      "The same hand path now produces a different prop relationship.",
    roomResponse: "Paired petals accumulate beside G's rings.",
  },
  {
    id: "performer-i",
    number: 5,
    pathIndex: 6,
    title: "I synthesis",
    focus: "H's blue behavior plus G's red behavior",
    experience: "The hybrid is understood by comparison, not by a label.",
    roomResponse: "A blue petal and red ring interlock without a climax beat.",
  },
  {
    id: "ensemble-stand",
    number: 6,
    pathIndex: 7,
    title: "Near ensemble",
    focus: "Three bodies, one continuous clock",
    experience:
      "The visitor steps closer and sees the complete relation at once.",
    roomResponse:
      "All retained traces brighten briefly: the room acknowledges sustained attention.",
  },
  {
    id: "air-exit",
    number: 7,
    pathIndex: 9,
    title: "Air threshold",
    focus: "The trio stays visible over the shoulder",
    experience: "The route continues forward without retracing the terrace.",
    roomResponse: "The wall traces remain as Earth gives way to vertical air.",
  },
] as const;

const LOCAL_HABITAT_MASSES = [
  {
    id: "gully-ferns",
    label: "FERN GULLY",
    centre: { x: 4.2, z: 14.7 },
    radiusX: 3.1,
    radiusZ: 1.2,
    maximumElevation: -0.85,
    density: "fern",
  },
  {
    id: "blind-turn-roots",
    label: "ROOT TURN",
    centre: { x: 8.4, z: 12.6 },
    radiusX: 2.4,
    radiusZ: 3.1,
    maximumElevation: 2.8,
    density: "root-cliff",
  },
  {
    id: "north-cliff-moss",
    label: "MOSS CLIFF",
    centre: { x: 18.2, z: 4.5 },
    radiusX: 4.2,
    radiusZ: 2,
    maximumElevation: -5.5,
    density: "moss",
  },
  {
    id: "east-cliff-ferns",
    label: "FERN CLIFF",
    centre: { x: 29.5, z: 8.2 },
    radiusX: 2.4,
    radiusZ: 4.2,
    maximumElevation: -4.9,
    density: "fern",
  },
  {
    id: "terrace-shoulder",
    label: "LOW TERRACE FERNS",
    centre: { x: 18.2, z: 22.1 },
    radiusX: 6.2,
    radiusZ: 0.8,
    maximumElevation: -0.9,
    density: "fern",
  },
] as const;

function translatePoint(point: Point2, room: WorldRect): Point2 {
  return { x: room.minX + point.x, z: room.minZ + point.z };
}

function translateRect(rect: WorldRect, room: WorldRect): WorldRect {
  return {
    minX: room.minX + rect.minX,
    maxX: room.minX + rect.maxX,
    minZ: room.minZ + rect.minZ,
    maxZ: room.minZ + rect.maxZ,
  };
}

function buildPlan(
  room: WorldRect,
  westDoor: Span,
  southDoor: Span
): EarthLongTerracePlan {
  const walkPath = LOCAL_PATH.map((point, index) => {
    const translated = translatePoint(point, room);
    if (index === 0) translated.z = (westDoor.min + westDoor.max) / 2;
    if (index === LOCAL_PATH.length - 1) {
      translated.x = (southDoor.min + southDoor.max) / 2;
      translated.z = room.maxZ;
    }
    return { ...translated, elevation: point.elevation };
  });

  const performers: EarthLongTerracePerformer[] = LOCAL_PERFORMERS.map(
    (performer) => ({
      ...performer,
      centre: translatePoint(performer.centre, room),
      facing: "south",
      stageElevation: EARTH_LONG_TERRACE_STAGE_Y,
      stageRadius: 1.4,
      bodyHeight: 1.75,
    })
  );

  const stops: EarthLongTerraceStop[] = LOCAL_STOPS.map((stop) => ({
    id: stop.id,
    number: stop.number,
    title: stop.title,
    focus: stop.focus,
    experience: stop.experience,
    roomResponse: stop.roomResponse,
    ...walkPath[stop.pathIndex]!,
  }));

  return {
    room,
    westDoor,
    southDoor,
    routeWidth: EARTH_LONG_TERRACE_ROUTE_WIDTH,
    eyeHeight: EARTH_LONG_TERRACE_EYE_HEIGHT,
    terraceElevation: EARTH_LONG_TERRACE_TERRACE_Y,
    stageElevation: EARTH_LONG_TERRACE_STAGE_Y,
    performerClock: {
      timing: "together",
      handPath: "same",
      loop: "continuous",
    },
    performers,
    habitatMasses: LOCAL_HABITAT_MASSES.map((mass) => ({
      ...mass,
      centre: translatePoint(mass.centre, room),
    })),
    walkPath,
    stops,
    revealBlocker: translateRect(
      { minX: 6.2, maxX: 10.8, minZ: 9, maxZ: 16.2 },
      room
    ),
    publicTerrace: translateRect(
      { minX: 10.2, maxX: 30.5, minZ: 13.6, maxZ: 22.8 },
      room
    ),
    viewingRibbon: {
      start: translatePoint({ x: 11.5, z: 19.4 }, room),
      end: translatePoint({ x: 26, z: 19.4 }, room),
      width: EARTH_LONG_TERRACE_ROUTE_WIDTH,
    },
    terraceViewEdge: {
      start: translatePoint({ x: 10.2, z: 18 }, room),
      end: translatePoint({ x: 30.5, z: 18 }, room),
      elevation: EARTH_LONG_TERRACE_TERRACE_Y,
    },
    finalStand: {
      centre: walkPath[7]!,
      radius: 1.75,
    },
    finalCamera: {
      position: walkPath[7]!,
      target: performers[1]!.centre,
      targetElevation: EARTH_LONG_TERRACE_STAGE_Y + 0.875,
      verticalFovDegrees: EARTH_LONG_TERRACE_CAMERA_VERTICAL_FOV,
      aspect: EARTH_LONG_TERRACE_CAMERA_ASPECT,
    },
    interactionZones: performers.map((performer, index) => ({
      performerId: performer.id,
      centre: walkPath[index + 4]!,
      radius: 2.4,
    })),
    traceWall: translateRect(
      { minX: 16.2, maxX: 28.8, minZ: 2.3, maxZ: 3 },
      room
    ),
    canyonShelfElevations: [-7.8, -12.5, -18.5, -25],
  };
}

export function buildNominalEarthLongTerracePlan(): EarthLongTerracePlan {
  return buildPlan(
    { minX: 0, minZ: 0, maxX: 34, maxZ: 24 },
    { min: 11, max: 13 },
    { min: 31.5, max: 33.5 }
  );
}

export function buildEarthLongTerracePlanForGrid(
  grid: MuseumGrid
): EarthLongTerracePlan | null {
  const wing = grid.wings.find(
    (candidate) => candidate.id === EARTH_LONG_TERRACE_ROOM_ID
  );
  if (!wing) return null;
  const westDoor = doorSpan(grid, EARTH_LONG_TERRACE_ROOM_ID, "west");
  const southDoor = doorSpan(grid, EARTH_LONG_TERRACE_ROOM_ID, "south");
  if (!westDoor || !southDoor) {
    throw new Error(
      "Earth Long Terrace requires the compiled Fire and Air doors"
    );
  }
  return buildPlan(interiorWorldRect(wing.bounds), westDoor, southDoor);
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export function earthLongTerraceRouteLength(
  plan: EarthLongTerracePlan
): number {
  return plan.walkPath.slice(1).reduce((total, point, index) => {
    return total + distance(plan.walkPath[index]!, point);
  }, 0);
}

export function earthLongTerraceMaximumGrade(
  plan: EarthLongTerracePlan
): number {
  return Math.max(
    ...plan.walkPath.slice(1).map((point, index) => {
      const previous = plan.walkPath[index]!;
      return (
        Math.abs(point.elevation - previous.elevation) /
        distance(previous, point)
      );
    })
  );
}

function pointInRect(point: Point2, rect: WorldRect): boolean {
  return (
    point.x >= rect.minX &&
    point.x <= rect.maxX &&
    point.z >= rect.minZ &&
    point.z <= rect.maxZ
  );
}

function orientation(a: Point2, b: Point2, c: Point2): number {
  return (b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z);
}

function segmentsIntersect(
  a: Point2,
  b: Point2,
  c: Point2,
  d: Point2
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function isEarthLongTerraceSightlineBlocked(
  plan: EarthLongTerracePlan,
  from: Point2,
  to: Point2
): boolean {
  const blocker = plan.revealBlocker;
  if (pointInRect(from, blocker) || pointInRect(to, blocker)) return true;
  const corners = [
    { x: blocker.minX, z: blocker.minZ },
    { x: blocker.maxX, z: blocker.minZ },
    { x: blocker.maxX, z: blocker.maxZ },
    { x: blocker.minX, z: blocker.maxZ },
  ];
  return corners.some((corner, index) =>
    segmentsIntersect(from, to, corner, corners[(index + 1) % corners.length]!)
  );
}

export function earthLongTerraceViewingSamples(
  plan: EarthLongTerracePlan,
  interval = EARTH_LONG_TERRACE_SAMPLE_INTERVAL
): Point2[] {
  const { start, end, width } = plan.viewingRibbon;
  const length = distance(start, end);
  const alongSteps = Math.ceil(length / interval);
  const acrossSteps = Math.ceil(width / interval);
  const dx = (end.x - start.x) / length;
  const dz = (end.z - start.z) / length;
  const normal = { x: -dz, z: dx };
  const samples: Point2[] = [];
  for (let along = 0; along <= alongSteps; along += 1) {
    const alongFraction = along / alongSteps;
    const centre = {
      x: start.x + (end.x - start.x) * alongFraction,
      z: start.z + (end.z - start.z) * alongFraction,
    };
    for (let across = 0; across <= acrossSteps; across += 1) {
      const lateral = -width / 2 + (width * across) / acrossSteps;
      samples.push({
        x: centre.x + normal.x * lateral,
        z: centre.z + normal.z * lateral,
      });
    }
  }
  return samples;
}

export function earthLongTerraceFloorSightlineMargin(
  plan: EarthLongTerracePlan,
  visitor: Point2,
  performer: EarthLongTerracePerformer
): number {
  const edgeZ = plan.terraceViewEdge.start.z;
  const denominator = performer.centre.z - visitor.z;
  if (Math.abs(denominator) < Number.EPSILON) return Number.NEGATIVE_INFINITY;
  const t = (edgeZ - visitor.z) / denominator;
  if (t < 0 || t > 1) return Number.POSITIVE_INFINITY;
  const eyeY = plan.terraceElevation + plan.eyeHeight;
  const rayY = eyeY + (performer.stageElevation - eyeY) * t;
  return rayY - plan.terraceViewEdge.elevation;
}

export function earthLongTerraceMinimumFloorMargin(
  plan: EarthLongTerracePlan
): number {
  const samples = earthLongTerraceViewingSamples(plan);
  return Math.min(
    ...samples.flatMap((sample) =>
      plan.performers.map((performer) =>
        earthLongTerraceFloorSightlineMargin(plan, sample, performer)
      )
    )
  );
}

export function earthLongTerraceApparentBodyHeightDegrees(
  plan: EarthLongTerracePlan,
  visitor: EarthLongTerraceRoutePoint,
  performer: EarthLongTerracePerformer
): number {
  const horizontalDistance = distance(visitor, performer.centre);
  const eyeY = visitor.elevation + plan.eyeHeight;
  const footAngle = Math.atan2(
    performer.stageElevation - eyeY,
    horizontalDistance
  );
  const headAngle = Math.atan2(
    performer.stageElevation + performer.bodyHeight - eyeY,
    horizontalDistance
  );
  return ((headAngle - footAngle) * 180) / Math.PI;
}

export function earthLongTerraceHorizontalFovDegrees(
  verticalFovDegrees: number,
  aspect: number
): number {
  const verticalRadians = (verticalFovDegrees * Math.PI) / 180;
  return (
    (2 * Math.atan(Math.tan(verticalRadians / 2) * aspect) * 180) / Math.PI
  );
}

function signedAngleDegrees(a: number, b: number): number {
  let difference = ((a - b + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return (difference * 180) / Math.PI;
}

export function isEarthLongTerraceBodyInsideFinalFrame(
  plan: EarthLongTerracePlan,
  performer: EarthLongTerracePerformer
): boolean {
  const camera = plan.finalCamera;
  const eyeY = camera.position.elevation + plan.eyeHeight;
  const targetYaw = Math.atan2(
    camera.target.x - camera.position.x,
    camera.target.z - camera.position.z
  );
  const targetDistance = distance(camera.position, camera.target);
  const targetPitch = Math.atan2(camera.targetElevation - eyeY, targetDistance);
  const bodyYaw = Math.atan2(
    performer.centre.x - camera.position.x,
    performer.centre.z - camera.position.z
  );
  const bodyDistance = distance(camera.position, performer.centre);
  const footPitch = Math.atan2(performer.stageElevation - eyeY, bodyDistance);
  const headPitch = Math.atan2(
    performer.stageElevation + performer.bodyHeight - eyeY,
    bodyDistance
  );
  const halfHorizontal =
    earthLongTerraceHorizontalFovDegrees(
      camera.verticalFovDegrees,
      camera.aspect
    ) / 2;
  const halfVertical = camera.verticalFovDegrees / 2;
  return (
    Math.abs(signedAngleDegrees(bodyYaw, targetYaw)) <= halfHorizontal &&
    Math.abs(signedAngleDegrees(footPitch, targetPitch)) <= halfVertical &&
    Math.abs(signedAngleDegrees(headPitch, targetPitch)) <= halfVertical
  );
}

export function earthLongTerraceInteractionGap(
  plan: EarthLongTerracePlan,
  leftIndex: number
): number {
  const left = plan.interactionZones[leftIndex];
  const right = plan.interactionZones[leftIndex + 1];
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return distance(left.centre, right.centre) - left.radius - right.radius;
}
