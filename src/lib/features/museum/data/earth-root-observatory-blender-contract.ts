/**
 * Blender authoring bridge for the approved Earth Root Observatory plan.
 *
 * The measured plan remains the spatial owner. This module only converts its
 * world-space X/Z coordinates into Blender's local X/Y plane with Z up and
 * packages the route, review cameras, and named scene collections.
 */
import type { Point2, WorldRect } from "./drowned-gallery-terrain";
import {
  buildEarthRootObservatoryPlanForGrid,
  earthRootObservatoryRouteLength,
  type EarthRootObservatoryPlan,
  type EarthRootObservatoryRoutePoint,
} from "./earth-root-observatory-plan";
import {
  CAVE_MODE_ROOMS,
  buildVulcanCaveFloorPlan,
} from "./vulcan-cave-floor-plan";

export const EARTH_ROOT_OBSERVATORY_BLENDER_SCHEMA_VERSION = 1;
export const EARTH_ROOT_OBSERVATORY_BLENDER_SCENE_NAME =
  "Earth Root Observatory Graybox";
export const EARTH_ROOT_OBSERVATORY_REVIEW_SPEED = 3.2;
export const EARTH_ROOT_OBSERVATORY_STAGE_HEIGHT = 0.62;

export const EARTH_ROOT_OBSERVATORY_BLENDER_COLLECTIONS = [
  "SHELL",
  "ROUTE",
  "TREE",
  "PERFORMERS",
  "ROOT_TRACES",
  "OCCLUDERS",
  "INTERACTIONS",
  "REFERENCE",
  "LOCATORS",
  "CAMERAS",
  "LIGHTS",
  "QA_ONLY",
] as const;

export interface EarthRootObservatoryBlenderPoint {
  x: number;
  y: number;
  z: number;
}

export interface EarthRootObservatoryBlenderRouteSegment {
  id: string;
  from: EarthRootObservatoryBlenderPoint;
  to: EarthRootObservatoryBlenderPoint;
  width: number;
  length: number;
}

export interface EarthRootObservatoryBlenderCamera {
  id: string;
  name: string;
  position: EarthRootObservatoryBlenderPoint;
  target: EarthRootObservatoryBlenderPoint;
  horizontalFovDegrees: number;
  type: "perspective" | "orthographic";
  orthographicScale?: number;
}

export interface EarthRootObservatoryBlenderContract {
  schemaVersion: number;
  sceneName: string;
  units: "metres";
  sourceModules: readonly string[];
  collections: readonly string[];
  coordinateSystem: {
    plan: { groundAxes: "X/Z"; upAxis: "+Y" };
    blender: {
      groundAxes: "X/Y";
      upAxis: "+Z";
      xFormula: "plan.x - roomCentre.x";
      yFormula: "roomCentre.z - plan.z";
      zFormula: "plan elevation";
    };
    gltfRuntime: {
      exporterTransform: "(Blender X, Y, Z) -> (runtime X, Z, -Y)";
      mount: "compiled cave-earth interior centre";
      rotationRadians: readonly [0, 0, 0];
      scale: 1;
    };
  };
  room: {
    planBounds: WorldRect;
    planCentre: Point2;
    width: number;
    depth: number;
    ceilingElevation: number;
    performerFloorElevation: number;
    wallThickness: number;
    blenderBounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
    westDoor: { minY: number; maxY: number; width: number };
    southDoor: { minX: number; maxX: number; width: number };
  };
  route: {
    width: number;
    path: EarthRootObservatoryBlenderPoint[];
    segments: EarthRootObservatoryBlenderRouteSegment[];
    length: number;
    reviewSpeed: number;
    walkingDurationSeconds: number;
  };
  stops: Array<{
    id: string;
    number: number;
    title: string;
    position: EarthRootObservatoryBlenderPoint;
  }>;
  tree: {
    centre: EarthRootObservatoryBlenderPoint;
    trunkRadius: number;
    rootFieldRadius: number;
    ceilingBreakRadius: number;
    topElevation: number;
  };
  performers: Array<{
    id: "g" | "h" | "i";
    label: "G" | "H" | "I";
    performerId: string;
    sequenceId: string;
    centre: EarthRootObservatoryBlenderPoint;
    habitatRadius: number;
    interactionRadius: number;
    environmentTrace: "ring" | "petal" | "ring-and-petal";
    facingAngle: number;
    stageHeight: number;
  }>;
  occluders: Array<{
    id: string;
    centre: EarthRootObservatoryBlenderPoint;
    sizeX: number;
    sizeY: number;
    baseElevation: number;
    topElevation: number;
  }>;
  recognitionZone: {
    centre: EarthRootObservatoryBlenderPoint;
    radius: number;
    prerequisitePerformerIds: readonly ["g", "h", "i"];
  };
  cameras: EarthRootObservatoryBlenderCamera[];
}

function clean(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

function centreOf(rect: WorldRect): Point2 {
  return {
    x: (rect.minX + rect.maxX) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
  };
}

export function earthRootObservatoryPlanPointToBlender(
  point: Point2,
  roomCentre: Point2,
  elevation = 0
): EarthRootObservatoryBlenderPoint {
  return {
    x: clean(point.x - roomCentre.x),
    y: clean(roomCentre.z - point.z),
    z: clean(elevation),
  };
}

export function earthRootObservatoryBlenderPointToPlan(
  point: EarthRootObservatoryBlenderPoint,
  roomCentre: Point2
): Point2 {
  return {
    x: clean(point.x + roomCentre.x),
    z: clean(roomCentre.z - point.y),
  };
}

function routePointToBlender(
  point: EarthRootObservatoryRoutePoint,
  roomCentre: Point2
): EarthRootObservatoryBlenderPoint {
  return earthRootObservatoryPlanPointToBlender(
    point,
    roomCentre,
    point.elevation
  );
}

function cameraAtStop(
  plan: EarthRootObservatoryPlan,
  roomCentre: Point2,
  stopId: string,
  target: Point2,
  targetElevation: number,
  horizontalFovDegrees = 68
): EarthRootObservatoryBlenderCamera {
  const stop = plan.stops.find((candidate) => candidate.id === stopId);
  if (!stop) throw new Error(`Earth Blender contract: missing stop ${stopId}`);
  return {
    id: stop.id,
    name: `QA_Camera_${stop.title.replaceAll(" ", "_")}`,
    position: earthRootObservatoryPlanPointToBlender(
      stop,
      roomCentre,
      stop.elevation + plan.eyeHeight
    ),
    target: earthRootObservatoryPlanPointToBlender(
      target,
      roomCentre,
      targetElevation
    ),
    horizontalFovDegrees,
    type: "perspective",
  };
}

export function buildEarthRootObservatoryBlenderContract(): EarthRootObservatoryBlenderContract {
  const cave = buildVulcanCaveFloorPlan();
  const plan = buildEarthRootObservatoryPlanForGrid(cave.grid);
  if (!plan) {
    throw new Error("Earth Blender contract: compiled cave has no Earth plan");
  }
  const earthMode = CAVE_MODE_ROOMS.find(
    (candidate) => candidate.roomId === "cave-earth"
  );
  if (!earthMode) {
    throw new Error("Earth Blender contract: cave-earth metadata is missing");
  }
  if (
    earthMode.performerIds.length !== 3 ||
    earthMode.sequenceIds.length !== 3
  ) {
    throw new Error("Earth Blender contract: Earth must stage G, H, and I");
  }

  const planCentre = centreOf(plan.room);
  const path = plan.walkPath.map((point) =>
    routePointToBlender(point, planCentre)
  );
  const segments = path.slice(1).map((to, index) => {
    const from = path[index]!;
    return {
      id: `route-${String(index + 1).padStart(2, "0")}`,
      from,
      to,
      width: plan.routeWidth,
      length: Math.hypot(to.x - from.x, to.y - from.y),
    };
  });
  const performerById = new Map(
    plan.performers.map((performer) => [performer.id, performer])
  );
  const cameraForPerformer = (id: "g" | "h" | "i") => {
    const performer = performerById.get(id);
    if (!performer) {
      throw new Error(`Earth Blender contract: performer ${id} is missing`);
    }
    return cameraAtStop(
      plan,
      planCentre,
      `performer-${id}`,
      performer.centre,
      performer.floorElevation + EARTH_ROOT_OBSERVATORY_STAGE_HEIGHT + 0.9,
      62
    );
  };

  const routeLength = earthRootObservatoryRouteLength(plan);
  const width = plan.room.maxX - plan.room.minX;
  const depth = plan.room.maxZ - plan.room.minZ;
  const treeReveal = cameraAtStop(
    plan,
    planCentre,
    "tree-reveal",
    plan.tree.centre,
    4.2,
    70
  );
  const overlook = cameraAtStop(
    plan,
    planCentre,
    "recognition-overlook",
    plan.finalCamera.target,
    -0.35,
    plan.finalCamera.horizontalFovDegrees
  );
  overlook.name = "QA_Camera_Recognition_Overlook";
  const airExit = cameraAtStop(
    plan,
    planCentre,
    "air-exit",
    {
      x: (plan.southDoor.min + plan.southDoor.max) / 2,
      z: plan.room.maxZ + 2,
    },
    1.8,
    65
  );
  // The stop itself sits on the threshold. Use the start of the final approach
  // so the review frame proves the ramp and opening instead of filling the
  // camera with the doorway cue.
  const airApproach = plan.walkPath[plan.walkPath.length - 3]!;
  airExit.position = earthRootObservatoryPlanPointToBlender(
    airApproach,
    planCentre,
    airApproach.elevation + plan.eyeHeight
  );

  return {
    schemaVersion: EARTH_ROOT_OBSERVATORY_BLENDER_SCHEMA_VERSION,
    sceneName: EARTH_ROOT_OBSERVATORY_BLENDER_SCENE_NAME,
    units: "metres",
    sourceModules: [
      "src/lib/features/museum/data/vulcan-cave-floor-plan.ts",
      "src/lib/features/museum/data/earth-root-observatory-plan.ts",
    ],
    collections: EARTH_ROOT_OBSERVATORY_BLENDER_COLLECTIONS,
    coordinateSystem: {
      plan: { groundAxes: "X/Z", upAxis: "+Y" },
      blender: {
        groundAxes: "X/Y",
        upAxis: "+Z",
        xFormula: "plan.x - roomCentre.x",
        yFormula: "roomCentre.z - plan.z",
        zFormula: "plan elevation",
      },
      gltfRuntime: {
        exporterTransform: "(Blender X, Y, Z) -> (runtime X, Z, -Y)",
        mount: "compiled cave-earth interior centre",
        rotationRadians: [0, 0, 0],
        scale: 1,
      },
    },
    room: {
      planBounds: plan.room,
      planCentre,
      width,
      depth,
      ceilingElevation: plan.ceilingElevation,
      performerFloorElevation: plan.performerFloorElevation,
      wallThickness: 0.4,
      blenderBounds: {
        minX: -width / 2,
        maxX: width / 2,
        minY: -depth / 2,
        maxY: depth / 2,
      },
      westDoor: {
        minY: planCentre.z - plan.westDoor.max,
        maxY: planCentre.z - plan.westDoor.min,
        width: plan.westDoor.max - plan.westDoor.min,
      },
      southDoor: {
        minX: plan.southDoor.min - planCentre.x,
        maxX: plan.southDoor.max - planCentre.x,
        width: plan.southDoor.max - plan.southDoor.min,
      },
    },
    route: {
      width: plan.routeWidth,
      path,
      segments,
      length: routeLength,
      reviewSpeed: EARTH_ROOT_OBSERVATORY_REVIEW_SPEED,
      walkingDurationSeconds: routeLength / EARTH_ROOT_OBSERVATORY_REVIEW_SPEED,
    },
    stops: plan.stops.map((stop) => ({
      id: stop.id,
      number: stop.number,
      title: stop.title,
      position: routePointToBlender(stop, planCentre),
    })),
    tree: {
      centre: earthRootObservatoryPlanPointToBlender(
        plan.tree.centre,
        planCentre,
        plan.tree.baseElevation
      ),
      trunkRadius: plan.tree.trunkRadius,
      rootFieldRadius: plan.tree.rootFieldRadius,
      ceilingBreakRadius: plan.tree.ceilingBreakRadius,
      topElevation: plan.tree.topElevation,
    },
    performers: plan.performers.map((performer) => {
      const stop = plan.stops.find(
        (candidate) => candidate.id === `performer-${performer.id}`
      );
      if (!stop) {
        throw new Error(
          `Earth Blender contract: performer ${performer.id} has no route stop`
        );
      }
      return {
        id: performer.id,
        label: performer.label,
        performerId: performer.performerId,
        sequenceId: performer.sequenceId,
        centre: earthRootObservatoryPlanPointToBlender(
          performer.centre,
          planCentre,
          performer.floorElevation
        ),
        habitatRadius: performer.habitatRadius,
        interactionRadius: performer.interactionRadius,
        environmentTrace: performer.environmentTrace,
        facingAngle: Math.atan2(
          stop.x - performer.centre.x,
          stop.z - performer.centre.z
        ),
        stageHeight: EARTH_ROOT_OBSERVATORY_STAGE_HEIGHT,
      };
    }),
    occluders: plan.occluders.map((occluder) => ({
      id: occluder.id,
      centre: earthRootObservatoryPlanPointToBlender(
        {
          x: (occluder.rect.minX + occluder.rect.maxX) / 2,
          z: (occluder.rect.minZ + occluder.rect.maxZ) / 2,
        },
        planCentre,
        plan.performerFloorElevation
      ),
      sizeX: occluder.rect.maxX - occluder.rect.minX,
      sizeY: occluder.rect.maxZ - occluder.rect.minZ,
      baseElevation: plan.performerFloorElevation,
      topElevation: 2.2,
    })),
    recognitionZone: {
      centre: earthRootObservatoryPlanPointToBlender(
        plan.recognitionZone.centre,
        planCentre,
        plan.finalCamera.position.elevation
      ),
      radius: plan.recognitionZone.radius,
      prerequisitePerformerIds: ["g", "h", "i"],
    },
    cameras: [
      cameraAtStop(
        plan,
        planCentre,
        "fire-threshold",
        plan.walkPath[2]!,
        plan.walkPath[2]!.elevation + 1.4,
        68
      ),
      treeReveal,
      cameraForPerformer("g"),
      cameraForPerformer("h"),
      cameraForPerformer("i"),
      overlook,
      airExit,
      {
        id: "overview",
        name: "QA_Camera_Overview",
        position: { x: 24, y: -28, z: 24 },
        target: { x: 1.5, y: 1.5, z: 1.8 },
        horizontalFovDegrees: 52,
        type: "perspective",
      },
      {
        id: "plan",
        name: "QA_Camera_Plan",
        position: { x: 0, y: 0, z: 38 },
        target: { x: 0, y: 0, z: 0 },
        horizontalFovDegrees: 52,
        type: "orthographic",
        orthographicScale: 39,
      },
    ],
  };
}
