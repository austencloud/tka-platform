/**
 * Spatial contract for the approved First Fire Torch Procession.
 *
 * This is deliberately separate from `first-fire-layout.ts`. The live room
 * still renders the superseded amphitheatre while overlapping 3D work lands.
 * The next implementation can replace that module from this measured plan
 * without having to recover geometry from a drawing or prose.
 *
 * Every coordinate below is room-local. The builder translates the plan from
 * compiled room and door bounds, so resizing or moving the cave never creates
 * a second set of world coordinates.
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

/** The measured plan needs this much clear interior before cave dressing. */
export const FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES = {
  width: 60,
  depth: 30,
} as const;

/**
 * Room authoring units consumed by `computeRoomDimensions`. The museum builder
 * compiles them at 1.5 half-metre tiles per unit, producing 60 by 30 metres.
 */
export const FIRST_FIRE_PROCESSION_AUTHORING_MINIMUM = {
  width: 80,
  height: 40,
} as const;

export const FIRST_FIRE_SHRINE_ORDER = ["dj", "ek", "fl"] as const;
export type FirstFireShrineId = (typeof FIRST_FIRE_SHRINE_ORDER)[number];

export interface FirstFireProcessionFrame {
  room: WorldRect;
  westDoor: Span;
  eastDoor: Span;
}

export interface FireProcessionPathSection {
  id: string;
  kind:
    | "steam-threshold"
    | "ember-bridge"
    | "torch-field"
    | "shrine-orbit"
    | "transfer"
    | "growth-path";
  width: number;
  points: Point2[];
}

export interface FireProcessionOccluder {
  id: string;
  kind: "rock-rib" | "torch-curtain";
  rect: WorldRect;
}

export interface FireProcessionActivationZone {
  id: string;
  startDegrees: number;
  sweepDegrees: number;
}

export interface FireProcessionShrine {
  id: FirstFireShrineId;
  label: string;
  performerId: string;
  sequenceId: string;
  centre: Point2;
  habitatRadius: number;
  trenchInnerRadius: number;
  trenchOuterRadius: number;
  orbitRadius: number;
  orbitWidth: number;
  orbitStartDegrees: number;
  orbitSweepDegrees: number;
  entry: Point2;
  exit: Point2;
  activationZones: FireProcessionActivationZone[];
}

export interface FirstFireProcessionPlan {
  room: WorldRect;
  westDoor: Span;
  eastDoor: Span;
  shrines: FireProcessionShrine[];
  occluders: FireProcessionOccluder[];
  pathSections: FireProcessionPathSection[];
  walkPath: Point2[];
  /** Static field estimate. Hero prop flames are budgeted separately. */
  torchBudget: {
    fieldStems: number;
    perimeterStemsPerShrine: number;
    maximumDetailedShrines: number;
  };
}

const NOMINAL_WIDTH = FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES.width;
const NOMINAL_DEPTH = FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES.depth;
const HABITAT_RADIUS = 2.2;
const TRENCH_INNER_RADIUS = 2.75;
const TRENCH_OUTER_RADIUS = 3.5;
const ORBIT_RADIUS = 4.8;
const ORBIT_WIDTH = 2.4;
const ORBIT_SWEEP_DEGREES = 240;
const ORBIT_SAMPLE_COUNT = 16;

const SHRINE_DEFINITIONS = [
  {
    id: "dj",
    label: "DJ",
    performerId: "cave-fire-automaton-dj",
    sequenceId: "cave-fire-seq-dj",
    x: 16.5,
    z: 8.5,
    startDegrees: 165,
    sweepDegrees: ORBIT_SWEEP_DEGREES,
  },
  {
    id: "ek",
    label: "EK",
    performerId: "cave-fire-automaton-ek",
    sequenceId: "cave-fire-seq-ek",
    x: 31.5,
    z: 21.5,
    startDegrees: 195,
    sweepDegrees: -ORBIT_SWEEP_DEGREES,
  },
  {
    id: "fl",
    label: "FL",
    performerId: "cave-fire-automaton-fl",
    sequenceId: "cave-fire-seq-fl",
    x: 47,
    z: 8.5,
    startDegrees: 165,
    sweepDegrees: ORBIT_SWEEP_DEGREES,
  },
] as const;

function pointOnCircle(
  centre: Point2,
  radius: number,
  degrees: number
): Point2 {
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

function activationZones(
  shrineId: FirstFireShrineId,
  startDegrees: number,
  sweepDegrees: number
): FireProcessionActivationZone[] {
  const direction = Math.sign(sweepDegrees);
  // Four 75-degree zones advance every 55 degrees. Their 20-degree overlaps
  // remove the single-trigger failure mode without reducing the 240° walk.
  return Array.from({ length: 4 }, (_, index) => ({
    id: `${shrineId}-orbit-${index + 1}`,
    startDegrees: startDegrees + direction * index * 55,
    sweepDegrees: direction * 75,
  }));
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

function flattenPath(sections: FireProcessionPathSection[]): Point2[] {
  const points: Point2[] = [];
  for (const section of sections) {
    for (const point of section.points) {
      const previous = points.at(-1);
      if (
        previous &&
        Math.abs(previous.x - point.x) < 1e-9 &&
        Math.abs(previous.z - point.z) < 1e-9
      ) {
        continue;
      }
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
  for (const [side, door] of [
    ["west", frame.westDoor],
    ["east", frame.eastDoor],
  ] as const) {
    if (door.min < frame.room.minZ || door.max > frame.room.maxZ) {
      throw new Error(
        `First Fire ${side} door falls outside the room interior`
      );
    }
  }
}

export function buildFirstFireProcessionPlan(
  frame: FirstFireProcessionFrame
): FirstFireProcessionPlan {
  assertPlanFits(frame);

  const x0 = frame.room.minX;
  // Extra depth becomes rock margin equally on the north and south. The route
  // keeps its measured radii instead of stretching circulation widths.
  const z0 =
    frame.room.minZ + (frame.room.maxZ - frame.room.minZ - NOMINAL_DEPTH) / 2;
  const localPoint = (x: number, z: number) => translatePoint({ x, z }, x0, z0);
  const localRect = (rect: WorldRect) => translateRect(rect, x0, z0);

  const shrines = SHRINE_DEFINITIONS.map((definition) => {
    const centre = localPoint(definition.x, definition.z);
    return {
      id: definition.id,
      label: definition.label,
      performerId: definition.performerId,
      sequenceId: definition.sequenceId,
      centre,
      habitatRadius: HABITAT_RADIUS,
      trenchInnerRadius: TRENCH_INNER_RADIUS,
      trenchOuterRadius: TRENCH_OUTER_RADIUS,
      orbitRadius: ORBIT_RADIUS,
      orbitWidth: ORBIT_WIDTH,
      orbitStartDegrees: definition.startDegrees,
      orbitSweepDegrees: definition.sweepDegrees,
      entry: pointOnCircle(centre, ORBIT_RADIUS, definition.startDegrees),
      exit: pointOnCircle(
        centre,
        ORBIT_RADIUS,
        definition.startDegrees + definition.sweepDegrees
      ),
      activationZones: activationZones(
        definition.id,
        definition.startDegrees,
        definition.sweepDegrees
      ),
    } satisfies FireProcessionShrine;
  });

  const [dj, ek, fl] = shrines as [
    FireProcessionShrine,
    FireProcessionShrine,
    FireProcessionShrine,
  ];
  const westDoorCentre = (frame.westDoor.min + frame.westDoor.max) / 2;
  const eastDoorCentre = (frame.eastDoor.min + frame.eastDoor.max) / 2;

  const pathSections: FireProcessionPathSection[] = [
    {
      id: "water-to-steam",
      kind: "steam-threshold",
      width: 4,
      points: [
        { x: frame.room.minX, z: westDoorCentre },
        { x: x0 + 5.5, z: westDoorCentre },
      ],
    },
    {
      id: "ember-bridge",
      kind: "ember-bridge",
      width: 3,
      points: [
        { x: x0 + 5.5, z: westDoorCentre },
        { x: x0 + 10, z: westDoorCentre },
      ],
    },
    {
      id: "torch-field-to-dj",
      kind: "torch-field",
      width: 3,
      points: [
        { x: x0 + 10, z: westDoorCentre },
        localPoint(10, 15.5),
        localPoint(12.3, 15.5),
        dj.entry,
      ],
    },
    {
      id: "dj-orbit",
      kind: "shrine-orbit",
      width: ORBIT_WIDTH,
      points: sampleArc(
        dj.centre,
        ORBIT_RADIUS,
        dj.orbitStartDegrees,
        dj.orbitSweepDegrees
      ),
    },
    {
      id: "dj-to-ek",
      kind: "transfer",
      width: 3,
      points: [
        dj.exit,
        localPoint(13, 14),
        localPoint(13, 25.2),
        localPoint(25.8, 25.2),
        ek.entry,
      ],
    },
    {
      id: "ek-orbit",
      kind: "shrine-orbit",
      width: ORBIT_WIDTH,
      points: sampleArc(
        ek.centre,
        ORBIT_RADIUS,
        ek.orbitStartDegrees,
        ek.orbitSweepDegrees
      ),
    },
    {
      id: "ek-to-fl",
      kind: "transfer",
      width: 3,
      points: [
        ek.exit,
        localPoint(26, 13),
        localPoint(26, 6),
        localPoint(41.5, 6),
        fl.entry,
      ],
    },
    {
      id: "fl-orbit",
      kind: "shrine-orbit",
      width: ORBIT_WIDTH,
      points: sampleArc(
        fl.centre,
        ORBIT_RADIUS,
        fl.orbitStartDegrees,
        fl.orbitSweepDegrees
      ),
    },
    {
      id: "earth-growth-path",
      kind: "growth-path",
      width: 3,
      points: [
        fl.exit,
        localPoint(53.5, 13),
        localPoint(54.5, 26.5),
        { x: frame.room.maxX, z: eastDoorCentre },
      ],
    },
  ];

  const occluders: FireProcessionOccluder[] = [
    {
      id: "entry-torch-curtain",
      kind: "torch-curtain",
      rect: localRect({ minX: 10.5, maxX: 11.5, minZ: 3.5, maxZ: 14.2 }),
    },
    {
      id: "dj-ek-rock-rib",
      kind: "rock-rib",
      rect: localRect({ minX: 22.5, maxX: 24.8, minZ: 0, maxZ: 19.5 }),
    },
    {
      id: "dj-ek-return-baffle",
      kind: "rock-rib",
      rect: localRect({ minX: 15, maxX: 22.5, minZ: 19.5, maxZ: 23.8 }),
    },
    {
      id: "ek-fl-rock-rib",
      kind: "rock-rib",
      rect: localRect({ minX: 37.5, maxX: 40.5, minZ: 10.5, maxZ: 30 }),
    },
    {
      id: "ek-fl-return-baffle",
      kind: "rock-rib",
      rect: localRect({ minX: 27.2, maxX: 37.5, minZ: 7.5, maxZ: 11.5 }),
    },
  ];

  return {
    room: frame.room,
    westDoor: frame.westDoor,
    eastDoor: frame.eastDoor,
    shrines,
    occluders,
    pathSections,
    walkPath: flattenPath(pathSections),
    torchBudget: {
      fieldStems: 72,
      perimeterStemsPerShrine: 18,
      maximumDetailedShrines: 1,
    },
  };
}

export function buildNominalFirstFireProcessionPlan(): FirstFireProcessionPlan {
  return buildFirstFireProcessionPlan({
    room: { minX: 0, maxX: NOMINAL_WIDTH, minZ: 0, maxZ: NOMINAL_DEPTH },
    westDoor: { min: 14, max: 16 },
    eastDoor: { min: 27, max: 29 },
  });
}

/**
 * Integration entry point for the 3D pass. It intentionally fails against the
 * current 46.5 by 20.5 metre room until `vulcan-cave-floor-plan.ts` adopts the
 * exported authoring minimum.
 */
export function buildFirstFireProcessionPlanForGrid(
  grid: MuseumGrid
): FirstFireProcessionPlan | null {
  const wing = grid.wings.find(
    (candidate) => candidate.id === FIRST_FIRE_PROCESSION_ROOM_ID
  );
  if (!wing) return null;
  const westDoor = doorSpan(grid, FIRST_FIRE_PROCESSION_ROOM_ID, "west");
  const eastDoor = doorSpan(grid, FIRST_FIRE_PROCESSION_ROOM_ID, "east");
  if (!westDoor || !eastDoor) {
    throw new Error("First Fire Torch Procession requires west and east doors");
  }
  return buildFirstFireProcessionPlan({
    room: interiorWorldRect(wing.bounds),
    westDoor,
    eastDoor,
  });
}

export function segmentIntersectsRect(
  from: Point2,
  to: Point2,
  rect: WorldRect
): boolean {
  // Liang-Barsky clipping keeps sightline tests deterministic at wall edges.
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const p = [-dx, dx, -dz, dz];
  const q = [
    from.x - rect.minX,
    rect.maxX - from.x,
    from.z - rect.minZ,
    rect.maxZ - from.z,
  ];
  let near = 0;
  let far = 1;
  for (let index = 0; index < 4; index++) {
    const pi = p[index]!;
    const qi = q[index]!;
    if (Math.abs(pi) < 1e-12) {
      if (qi < 0) return false;
      continue;
    }
    const ratio = qi / pi;
    if (pi < 0) near = Math.max(near, ratio);
    else far = Math.min(far, ratio);
    if (near > far) return false;
  }
  return true;
}

export function isProcessionSightlineBlocked(
  from: Point2,
  to: Point2,
  occluders: readonly FireProcessionOccluder[]
): boolean {
  return occluders.some((occluder) =>
    segmentIntersectsRect(from, to, occluder.rect)
  );
}

export function sampleProcessionPath(
  plan: FirstFireProcessionPlan,
  spacing = 0.25
): Point2[] {
  const samples: Point2[] = [];
  for (const section of plan.pathSections) {
    for (let index = 0; index < section.points.length - 1; index++) {
      const from = section.points[index]!;
      const to = section.points[index + 1]!;
      const distance = Math.hypot(to.x - from.x, to.z - from.z);
      const steps = Math.max(1, Math.ceil(distance / spacing));
      for (let step = 0; step < steps; step++) {
        const t = step / steps;
        samples.push({
          x: from.x + (to.x - from.x) * t,
          z: from.z + (to.z - from.z) * t,
        });
      }
    }
  }
  samples.push(plan.walkPath.at(-1)!);
  return samples;
}
