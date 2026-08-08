/**
 * Coordinate and geometry bridge from the compiled Earth walkthrough to Blender.
 *
 * This module deliberately derives the authoring contract from the same cave
 * floor plan and Earth terrain program used by the museum. Blender authors on
 * X/Y with Z up. glTF converts that to runtime X/Z with Y up, so plan depth is
 * negated around the compiled room centre.
 */
import {
  BOSS_Y,
  CANYON_SHELF_Y,
  DOOR_Y,
  FLOOR_DISC_Y,
  GULLY_LOW_Y,
  GULLY_MID_Y,
  RIM_Y,
  SLAB_NOSE_OUTER_Y,
  SLAB_Y,
  buildEarthCanyonLayout,
} from "./earth-canyon-layout";
import type { Point2, WorldRect } from "./drowned-gallery-terrain";
import {
  CAVE_MODE_ROOMS,
  buildVulcanCaveFloorPlan,
} from "./vulcan-cave-floor-plan";

export const EARTH_CANYON_BLENDER_CONTRACT_SCHEMA_VERSION = 1;
export const EARTH_CANYON_BLENDER_SCENE_NAME = "Earth Root Chasm Graybox";

export const EARTH_CANYON_BLENDER_COLLECTIONS = [
  "SHELL",
  "GULLY",
  "CHASM",
  "OVERLOOK",
  "BOSS_STATIONS",
  "ROOT_CROWN",
  "VEGETATION_GUIDES",
  "REFERENCE",
  "LOCATORS",
  "QA_ONLY",
] as const;

export interface EarthBlenderPoint {
  x: number;
  y: number;
  z: number;
}

export interface EarthBlenderFootprint {
  centre: EarthBlenderPoint;
  sizeX: number;
  sizeY: number;
}

interface EarthAuthoredRect {
  id: string;
  kind: "flat" | "ramp-x" | "ramp-y";
  planRect: WorldRect;
  blenderFootprint: EarthBlenderFootprint;
  fromElevation: number;
  toElevation: number;
}

export interface EarthCanyonBlenderContract {
  schemaVersion: number;
  sceneName: string;
  units: "metres";
  sourceModules: readonly string[];
  collections: readonly string[];
  coordinateSystem: {
    plan: {
      groundAxes: "X/Z";
      xDirection: "Fire to Earth";
      zDirection: "room depth";
      origin: "compiled museum grid";
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
    blenderBounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
  };
  route: {
    fireEntry: { plan: Point2; blender: EarthBlenderPoint; elevation: number };
    reveal: { plan: Point2; blender: EarthBlenderPoint; elevation: number };
    slabOverlook: {
      plan: Point2;
      blender: EarthBlenderPoint;
      elevation: number;
    };
    airExit: { plan: Point2; blender: EarthBlenderPoint; elevation: number };
  };
  gully: EarthAuthoredRect[];
  chamber: {
    planRect: WorldRect;
    blenderFootprint: EarthBlenderFootprint;
    rimElevation: number;
    rimBands: Array<{
      id: string;
      planRect: WorldRect;
      blenderFootprint: EarthBlenderFootprint;
    }>;
    void: {
      planCentre: Point2;
      blenderCentre: EarthBlenderPoint;
      radius: number;
      wallArc: { start: number; length: number };
    };
    floorDisc: {
      blenderCentre: EarthBlenderPoint;
      radius: number;
      elevation: number;
    };
    parapet: EarthAuthoredRect;
  };
  overlook: {
    ramp: EarthAuthoredRect;
    apron: EarthAuthoredRect;
    fracturedNose: EarthAuthoredRect;
  };
  exit: {
    ramp: EarthAuthoredRect;
    landing: EarthAuthoredRect;
    kerb: EarthAuthoredRect;
  };
  performers: Array<{
    id: "g" | "h" | "i";
    label: "G" | "H" | "I";
    performerId: string;
    sequenceId: string;
    planCentre: Point2;
    blenderCentre: EarthBlenderPoint;
    bossRadius: number;
    bossElevation: number;
  }>;
  canyonShelves: Array<{
    id: string;
    planRect: WorldRect;
    blenderFootprint: EarthBlenderFootprint;
    elevation: number;
  }>;
}

function clean(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

export function earthPlanPointToBlender(
  point: Point2,
  planCentre: Point2,
  elevation = 0
): EarthBlenderPoint {
  return {
    x: clean(point.x - planCentre.x),
    y: clean(planCentre.z - point.z),
    z: clean(elevation),
  };
}

export function earthBlenderPointToPlan(
  point: EarthBlenderPoint,
  planCentre: Point2
): Point2 {
  return {
    x: clean(point.x + planCentre.x),
    z: clean(planCentre.z - point.y),
  };
}

export function earthPlanRectToBlenderFootprint(
  rect: WorldRect,
  planCentre: Point2,
  elevation = 0
): EarthBlenderFootprint {
  return {
    centre: earthPlanPointToBlender(
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

function rectCentre(rect: WorldRect): Point2 {
  return {
    x: (rect.minX + rect.maxX) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
  };
}

export function buildEarthCanyonBlenderContract(): EarthCanyonBlenderContract {
  const cave = buildVulcanCaveFloorPlan();
  const layout = buildEarthCanyonLayout(cave.grid);
  if (!layout) {
    throw new Error(
      "Earth Blender contract: compiled cave has no Earth layout"
    );
  }

  const earthMode = CAVE_MODE_ROOMS.find(
    (mode) => mode.roomId === "cave-earth"
  );
  if (!earthMode) {
    throw new Error(
      "Earth Blender contract: cave-earth mode metadata is missing"
    );
  }
  if (
    earthMode.performerIds.length !== 3 ||
    earthMode.sequenceIds.length !== 3
  ) {
    throw new Error("Earth Blender contract: Earth must stage the G/H/I trio");
  }

  const width = layout.earth.maxX - layout.earth.minX;
  const depth = layout.earth.maxZ - layout.earth.minZ;
  const planCentre = rectCentre(layout.earth);
  const toBlender = (point: Point2, elevation = 0) =>
    earthPlanPointToBlender(point, planCentre, elevation);
  const authoredRect = (
    id: string,
    kind: EarthAuthoredRect["kind"],
    planRect: WorldRect,
    fromElevation: number,
    toElevation = fromElevation
  ): EarthAuthoredRect => ({
    id,
    kind,
    planRect,
    blenderFootprint: earthPlanRectToBlenderFootprint(
      planRect,
      planCentre,
      (fromElevation + toElevation) / 2
    ),
    fromElevation,
    toElevation,
  });

  const performerIds = earthMode.performerIds;
  const sequenceIds = earthMode.sequenceIds;
  const performerLabels = ["G", "H", "I"] as const;
  const performerSlugs = ["g", "h", "i"] as const;

  return {
    schemaVersion: EARTH_CANYON_BLENDER_CONTRACT_SCHEMA_VERSION,
    sceneName: EARTH_CANYON_BLENDER_SCENE_NAME,
    units: "metres",
    sourceModules: [
      "src/lib/features/museum/data/vulcan-cave-floor-plan.ts",
      "src/lib/features/museum/data/earth-canyon-layout.ts",
    ],
    collections: EARTH_CANYON_BLENDER_COLLECTIONS,
    coordinateSystem: {
      plan: {
        groundAxes: "X/Z",
        xDirection: "Fire to Earth",
        zDirection: "room depth",
        origin: "compiled museum grid",
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
        mount: "compiled cave-earth interior centre",
        rotationRadians: [0, 0, 0],
        scale: 1,
      },
    },
    room: {
      planBounds: layout.earth,
      planCentre,
      width,
      depth,
      blenderBounds: {
        minX: clean(layout.earth.minX - planCentre.x),
        maxX: clean(layout.earth.maxX - planCentre.x),
        minY: clean(planCentre.z - layout.earth.maxZ),
        maxY: clean(planCentre.z - layout.earth.minZ),
      },
    },
    route: {
      fireEntry: {
        plan: layout.probes.gullyMouth,
        blender: toBlender(layout.probes.gullyMouth, DOOR_Y),
        elevation: DOOR_Y,
      },
      reveal: {
        plan: layout.probes.northLedge,
        blender: toBlender(layout.probes.northLedge, RIM_Y),
        elevation: RIM_Y,
      },
      slabOverlook: {
        plan: layout.probes.slabApron,
        blender: toBlender(layout.probes.slabApron, SLAB_Y),
        elevation: SLAB_Y,
      },
      airExit: {
        plan: rectCentre(layout.exitLanding),
        blender: toBlender(rectCentre(layout.exitLanding), DOOR_Y),
        elevation: DOOR_Y,
      },
    },
    gully: [
      authoredRect("mouth", "ramp-x", layout.gullyMouth, DOOR_Y, GULLY_MID_Y),
      authoredRect(
        "bend",
        "ramp-y",
        layout.gullyBend,
        layout.bendRunsNorth ? GULLY_MID_Y : GULLY_LOW_Y,
        layout.bendRunsNorth ? GULLY_LOW_Y : GULLY_MID_Y
      ),
      authoredRect("lower", "ramp-x", layout.gullyLower, GULLY_LOW_Y, RIM_Y),
    ],
    chamber: {
      planRect: layout.chamber,
      blenderFootprint: earthPlanRectToBlenderFootprint(
        layout.chamber,
        planCentre,
        RIM_Y
      ),
      rimElevation: RIM_Y,
      rimBands: [
        ["north-ledge", layout.northLedge],
        ["west-rim", layout.westRim],
        ["east-rim", layout.eastRim],
        ["south-rim", layout.southRim],
      ].map(([id, planRect]) => ({
        id: id as string,
        planRect: planRect as WorldRect,
        blenderFootprint: earthPlanRectToBlenderFootprint(
          planRect as WorldRect,
          planCentre,
          RIM_Y
        ),
      })),
      void: {
        planCentre: layout.void_.center,
        blenderCentre: toBlender(layout.void_.center, RIM_Y),
        radius: layout.void_.radius,
        wallArc: layout.voidWallArc,
      },
      floorDisc: {
        blenderCentre: toBlender(layout.floorDisc.center, FLOOR_DISC_Y),
        radius: layout.floorDisc.radius,
        elevation: FLOOR_DISC_Y,
      },
      parapet: authoredRect("parapet", "flat", layout.parapet, RIM_Y),
    },
    overlook: {
      ramp: authoredRect("slab-ramp", "ramp-y", layout.slabRamp, SLAB_Y, RIM_Y),
      apron: authoredRect("slab-apron", "flat", layout.slabApron, SLAB_Y),
      fracturedNose: authoredRect(
        "slab-nose",
        "ramp-y",
        layout.slabNose,
        SLAB_NOSE_OUTER_Y,
        SLAB_Y
      ),
    },
    exit: {
      ramp: authoredRect("air-ramp", "ramp-x", layout.exitRamp, RIM_Y, DOOR_Y),
      landing: authoredRect("air-landing", "flat", layout.exitLanding, DOOR_Y),
      kerb: authoredRect("air-kerb", "flat", layout.exitKerb, RIM_Y),
    },
    performers: layout.bosses.map((boss, index) => ({
      id: performerSlugs[index]!,
      label: performerLabels[index]!,
      performerId: performerIds[index]!,
      sequenceId: sequenceIds[index]!,
      planCentre: boss.center,
      blenderCentre: toBlender(boss.center, BOSS_Y),
      bossRadius: boss.radius,
      bossElevation: BOSS_Y,
    })),
    canyonShelves: layout.canyonShelves.map((planRect, index) => ({
      id: `shelf-${index + 1}`,
      planRect,
      blenderFootprint: earthPlanRectToBlenderFootprint(
        planRect,
        planCentre,
        CANYON_SHELF_Y[index]!
      ),
      elevation: CANYON_SHELF_Y[index]!,
    })),
  };
}
