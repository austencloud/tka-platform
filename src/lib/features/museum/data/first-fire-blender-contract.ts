/**
 * Coordinate bridge from the measured First Fire floor plan to Blender.
 *
 * Museum room GLBs are mounted at the compiled room centre. Blender authors on
 * an X/Y ground plane with Z up, while the runtime uses X/Z with Y up. Blender's
 * glTF exporter converts `(X, Y, Z)` to runtime `(X, Z, -Y)`, so plan depth must
 * be negated here. Keeping the transform in one pure module prevents an artist
 * or build script from inventing a second coordinate system.
 */
import type { Point2, WorldRect } from "./drowned-gallery-terrain";
import {
  buildNominalFirstFireProcessionPlan,
  type FirstFireProcessionPlan,
} from "./first-fire-procession-plan";

export const FIRST_FIRE_BLENDER_CONTRACT_SCHEMA_VERSION = 1;
export const FIRST_FIRE_BLENDER_SCENE_NAME =
  "First Fire Torch Procession Graybox";

export const FIRST_FIRE_BLENDER_COLLECTIONS = [
  "SHELL",
  "ROCK_RIBS",
  "SHRINES",
  "TRENCHES",
  "BRIDGE",
  "TORCH_GUIDES",
  "REFERENCE",
  "LOCATORS",
  "QA_ONLY",
] as const;

export interface BlenderPoint {
  x: number;
  y: number;
  z: number;
}

export interface BlenderFootprint {
  centre: BlenderPoint;
  sizeX: number;
  sizeY: number;
}

export interface FirstFireBlenderContract {
  schemaVersion: number;
  sceneName: string;
  units: "metres";
  sourceModule: string;
  collections: readonly string[];
  coordinateSystem: {
    plan: {
      groundAxes: "X/Z";
      xDirection: "Water to Earth";
      zDirection: "room depth";
      origin: "north-west interior corner";
    };
    blender: {
      groundAxes: "X/Y";
      upAxis: "+Z";
      xFormula: "plan.x - roomCentre.x";
      yFormula: "roomCentre.z - plan.z";
      zFormula: "elevation";
    };
    gltfRuntime: {
      groundAxes: "X/Z";
      upAxis: "+Y";
      exporterTransform: "(Blender X, Y, Z) -> (runtime X, Z, -Y)";
      mount: "compiled cave-fire interior centre";
      rotationRadians: readonly [0, 0, 0];
      scale: 1;
    };
  };
  room: {
    planBounds: WorldRect;
    planCentre: Point2;
    width: number;
    depth: number;
    blenderBounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
  };
  doors: {
    water: {
      side: "west";
      plan: Point2;
      blender: BlenderPoint;
      clearWidth: number;
    };
    earth: {
      side: "east";
      plan: Point2;
      blender: BlenderPoint;
      clearWidth: number;
    };
  };
  shrines: Array<{
    id: string;
    label: string;
    performerId: string;
    sequenceId: string;
    planCentre: Point2;
    blenderCentre: BlenderPoint;
    planEntry: Point2;
    blenderEntry: BlenderPoint;
    planExit: Point2;
    blenderExit: BlenderPoint;
    habitatRadius: number;
    trenchInnerRadius: number;
    trenchOuterRadius: number;
    orbitRadius: number;
    orbitWidth: number;
    orbitStartDegrees: number;
    orbitSweepDegrees: number;
  }>;
  pathSections: Array<{
    id: string;
    kind: string;
    width: number;
    planPoints: Point2[];
    blenderPoints: BlenderPoint[];
  }>;
  occluders: Array<{
    id: string;
    kind: string;
    planRect: WorldRect;
    blenderFootprint: BlenderFootprint;
  }>;
  sightlines: Array<{
    id: string;
    fromShrine: string;
    toShrine: string;
    from: BlenderPoint;
    to: BlenderPoint;
  }>;
  torchBudget: FirstFireProcessionPlan["torchBudget"];
}

function clean(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

export function firstFirePlanPointToBlender(
  point: Point2,
  planCentre: Point2,
  elevation = 0
): BlenderPoint {
  return {
    x: clean(point.x - planCentre.x),
    y: clean(planCentre.z - point.z),
    z: clean(elevation),
  };
}

export function firstFireBlenderPointToPlan(
  point: BlenderPoint,
  planCentre: Point2
): Point2 {
  return {
    x: clean(point.x + planCentre.x),
    z: clean(planCentre.z - point.y),
  };
}

export function firstFirePlanRectToBlenderFootprint(
  rect: WorldRect,
  planCentre: Point2,
  elevation = 0
): BlenderFootprint {
  return {
    centre: firstFirePlanPointToBlender(
      {
        x: (rect.minX + rect.maxX) / 2,
        z: (rect.minZ + rect.maxZ) / 2,
      },
      planCentre,
      elevation
    ),
    sizeX: clean(rect.maxX - rect.minX),
    sizeY: clean(rect.maxZ - rect.minZ),
  };
}

export function buildFirstFireBlenderContract(
  plan = buildNominalFirstFireProcessionPlan()
): FirstFireBlenderContract {
  const width = plan.room.maxX - plan.room.minX;
  const depth = plan.room.maxZ - plan.room.minZ;
  const planCentre = {
    x: plan.room.minX + width / 2,
    z: plan.room.minZ + depth / 2,
  };
  const toBlender = (point: Point2, elevation = 0) =>
    firstFirePlanPointToBlender(point, planCentre, elevation);
  const westDoorCentre = (plan.westDoor.min + plan.westDoor.max) / 2;
  const eastDoorCentre = (plan.eastDoor.min + plan.eastDoor.max) / 2;

  return {
    schemaVersion: FIRST_FIRE_BLENDER_CONTRACT_SCHEMA_VERSION,
    sceneName: FIRST_FIRE_BLENDER_SCENE_NAME,
    units: "metres",
    sourceModule: "src/lib/features/museum/data/first-fire-procession-plan.ts",
    collections: FIRST_FIRE_BLENDER_COLLECTIONS,
    coordinateSystem: {
      plan: {
        groundAxes: "X/Z",
        xDirection: "Water to Earth",
        zDirection: "room depth",
        origin: "north-west interior corner",
      },
      blender: {
        groundAxes: "X/Y",
        upAxis: "+Z",
        xFormula: "plan.x - roomCentre.x",
        yFormula: "roomCentre.z - plan.z",
        zFormula: "elevation",
      },
      gltfRuntime: {
        groundAxes: "X/Z",
        upAxis: "+Y",
        exporterTransform: "(Blender X, Y, Z) -> (runtime X, Z, -Y)",
        mount: "compiled cave-fire interior centre",
        rotationRadians: [0, 0, 0],
        scale: 1,
      },
    },
    room: {
      planBounds: plan.room,
      planCentre,
      width,
      depth,
      blenderBounds: {
        minX: clean(plan.room.minX - planCentre.x),
        maxX: clean(plan.room.maxX - planCentre.x),
        minY: clean(planCentre.z - plan.room.maxZ),
        maxY: clean(planCentre.z - plan.room.minZ),
      },
    },
    doors: {
      water: {
        side: "west",
        plan: { x: plan.room.minX, z: westDoorCentre },
        blender: toBlender({ x: plan.room.minX, z: westDoorCentre }),
        clearWidth: clean(plan.westDoor.max - plan.westDoor.min),
      },
      earth: {
        side: "east",
        plan: { x: plan.room.maxX, z: eastDoorCentre },
        blender: toBlender({ x: plan.room.maxX, z: eastDoorCentre }),
        clearWidth: clean(plan.eastDoor.max - plan.eastDoor.min),
      },
    },
    shrines: plan.shrines.map((shrine) => ({
      id: shrine.id,
      label: shrine.label,
      performerId: shrine.performerId,
      sequenceId: shrine.sequenceId,
      planCentre: shrine.centre,
      blenderCentre: toBlender(shrine.centre),
      planEntry: shrine.entry,
      blenderEntry: toBlender(shrine.entry),
      planExit: shrine.exit,
      blenderExit: toBlender(shrine.exit),
      habitatRadius: shrine.habitatRadius,
      trenchInnerRadius: shrine.trenchInnerRadius,
      trenchOuterRadius: shrine.trenchOuterRadius,
      orbitRadius: shrine.orbitRadius,
      orbitWidth: shrine.orbitWidth,
      orbitStartDegrees: shrine.orbitStartDegrees,
      orbitSweepDegrees: shrine.orbitSweepDegrees,
    })),
    pathSections: plan.pathSections.map((section) => ({
      id: section.id,
      kind: section.kind,
      width: section.width,
      planPoints: section.points,
      blenderPoints: section.points.map((point) => toBlender(point, 0.035)),
    })),
    occluders: plan.occluders.map((occluder) => ({
      id: occluder.id,
      kind: occluder.kind,
      planRect: occluder.rect,
      blenderFootprint: firstFirePlanRectToBlenderFootprint(
        occluder.rect,
        planCentre
      ),
    })),
    sightlines: plan.shrines.flatMap((from, fromIndex) =>
      plan.shrines.slice(fromIndex + 1).map((to) => ({
        id: `${from.id}-to-${to.id}`,
        fromShrine: from.id,
        toShrine: to.id,
        from: toBlender(from.centre, 1.7),
        to: toBlender(to.centre, 1.7),
      }))
    ),
    torchBudget: plan.torchBudget,
  };
}
