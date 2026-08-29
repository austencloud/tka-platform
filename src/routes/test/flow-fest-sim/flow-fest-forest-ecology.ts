import { childSeed, makeRng } from "$lib/shared/foundation/utils/seeded-rng";
import { FLOW_FEST_MASTER_SEED } from "$lib/features/flow-fest-sim/domain/flow-fest-simulation-contract";
import type { ImportedTerrainDataV2 } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";
import type {
  FlowFestRuntimeContract,
  FlowFestRuntimePoint,
  FlowFestRuntimeSegment,
} from "../flow-fest-graybox/flow-fest-runtime-contract";
import { sampleFlowFestTerrainWorldY } from "../flow-fest-graybox/flow-fest-terrain-host";
import {
  deriveFlowFestCanopyPeaks,
  uniqueFlowFestSurfaceSegments,
  type FlowFestCanopyEvidence,
} from "./flow-fest-site-fidelity";
import {
  allFlowFestCampPlanLines,
  flowFestCampPlanLineToRuntimeSegment,
  type FlowFestCampPlan,
} from "./flow-fest-camp-plan";

export const FLOW_FEST_FOREST_TREE_ASSETS = {
  "island-tree-01":
    "/models/flow-fest-sim/ecology/island-tree-01-flow-lod-512.glb",
  "island-tree-02":
    "/models/flow-fest-sim/ecology/island-tree-02-flow-lod-512.glb",
  "island-tree-03":
    "/models/flow-fest-sim/ecology/island-tree-03-flow-lod-512.glb",
  "tree-small-02":
    "/models/flow-fest-sim/ecology/tree-small-02-flow-lod-512.glb",
  "plantcatalog-aesculus-carnea":
    "/models/forest/trees/candidates/plantcatalog-r1/aesculus-carnea-ld-s23.glb",
  "plantcatalog-oak-urban":
    "/models/forest/trees/candidates/plantcatalog-r1/quercus-robur-urban-ld-s13.glb",
  "plantcatalog-oak-colonised":
    "/models/forest/trees/candidates/plantcatalog-r1/quercus-robur-colonised-ld-s29.glb",
  "plantcatalog-willow":
    "/models/forest/trees/candidates/plantcatalog-r1/salix-alba-ld-s11.glb",
  "plantcatalog-buckeye-31":
    "/models/forest/trees/candidates/plantcatalog-r1/aesculus-pavia-ld-s31.glb",
  "plantcatalog-buckeye-79":
    "/models/forest/trees/candidates/plantcatalog-r1/aesculus-pavia-ld-s79.glb",
  "plantcatalog-habitat-snag":
    "/models/forest/trees/candidates/plantcatalog-r1/quercus-robur-dead-ld-s37.glb",
} as const;

export const FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS = {
  mid: {
    "island-tree-01":
      "/models/flow-fest-sim/ecology/distance-lod/island-tree-01-mid.glb",
    "island-tree-02":
      "/models/flow-fest-sim/ecology/distance-lod/island-tree-02-mid.glb",
    "island-tree-03":
      "/models/flow-fest-sim/ecology/distance-lod/island-tree-03-mid.glb",
    "tree-small-02":
      "/models/flow-fest-sim/ecology/distance-lod/tree-small-02-mid.glb",
  },
  far: {
    "island-tree-01":
      "/models/flow-fest-sim/ecology/distance-lod/island-tree-01-far.glb",
    "island-tree-02":
      "/models/flow-fest-sim/ecology/distance-lod/island-tree-02-far.glb",
    "island-tree-03":
      "/models/flow-fest-sim/ecology/distance-lod/island-tree-03-far.glb",
    "tree-small-02":
      "/models/flow-fest-sim/ecology/distance-lod/tree-small-02-far.glb",
  },
} as const;

export const FLOW_FEST_FOREST_DISTANCE_LOD = {
  nearMaximumMeters: 55,
  midMaximumMeters: 130,
  grassNearMaximumMeters: 22,
  grassMidMaximumMeters: 40,
  grassMaximumMeters: 58,
  grassMidDensity: 0.5,
  grassFarDensity: 0.25,
  cameraPositionThresholdMeters: 0.75,
  cameraRotationThresholdRadians: 0.015,
} as const;

export const FLOW_FEST_FOREST_GRASS_ASSET =
  "/models/flow-fest-sim/ecology/forest-grass-prototypes.glb";

export const FLOW_FEST_FOREST_DISTANCE_GRASS_ASSETS = {
  mid: "/models/flow-fest-sim/ecology/distance-lod/grass/forest-grass-prototypes-mid.glb",
  far: "/models/flow-fest-sim/ecology/distance-lod/grass/forest-grass-prototypes-far.glb",
} as const;

export const FLOW_FEST_FOREST_GROUND_LIFE_ASSETS = {
  "damp-sedge-tussock": "/models/forest/ground-life/damp-sedge-tussock.glb",
  "woodland-hazel-shrub": "/models/forest/ground-life/woodland-hazel-shrub.glb",
} as const;

export type FlowFestForestTreeFamilyId =
  keyof typeof FLOW_FEST_FOREST_TREE_ASSETS;
export type FlowFestForestDistanceTreeFamilyId =
  keyof (typeof FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS)["mid"];
export const FLOW_FEST_FOREST_DISTANCE_FALLBACK_FAMILY = {
  "island-tree-01": "island-tree-01",
  "island-tree-02": "island-tree-02",
  "island-tree-03": "island-tree-03",
  "tree-small-02": "tree-small-02",
  "plantcatalog-aesculus-carnea": "island-tree-01",
  "plantcatalog-oak-urban": "island-tree-02",
  "plantcatalog-oak-colonised": "island-tree-03",
  "plantcatalog-willow": "tree-small-02",
  "plantcatalog-buckeye-31": "island-tree-01",
  "plantcatalog-buckeye-79": "island-tree-03",
  "plantcatalog-habitat-snag": "tree-small-02",
} as const satisfies Record<
  FlowFestForestTreeFamilyId,
  FlowFestForestDistanceTreeFamilyId
>;
export const FLOW_FEST_PLANTFACTORY_TREE_FAMILIES = [
  "plantcatalog-aesculus-carnea",
  "plantcatalog-oak-urban",
  "plantcatalog-oak-colonised",
  "plantcatalog-willow",
  "plantcatalog-buckeye-31",
  "plantcatalog-buckeye-79",
  "plantcatalog-habitat-snag",
] as const satisfies readonly FlowFestForestTreeFamilyId[];
export const FLOW_FEST_PLANTFACTORY_ACCENT_COUNT = 34;
export type FlowFestForestGrassTier = "base" | "medium" | "high";
export type FlowFestForestGrassSpecies = "summer-sward" | "woodland-grass";
export type FlowFestForestGroundLifeSpecies =
  | "damp-sedge-tussock"
  | "woodland-hazel-shrub";

export interface FlowFestForestTreePlacement {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  colorIndex: number;
  renderedHeightMeters: number;
  measuredHeightMeters: number;
  trunkHeightMeters: number;
  trunkRadiusMeters: number;
  crownRadiusMeters: number;
  familyId: FlowFestForestTreeFamilyId;
}

export interface FlowFestForestGrassPlacement {
  x: number;
  y: number;
  z: number;
  rotation: number;
  widthMeters: number;
  heightMeters: number;
  species: FlowFestForestGrassSpecies;
  tier: FlowFestForestGrassTier;
  colorIndex: number;
}

export interface FlowFestForestGroundLifePlacement {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  species: FlowFestForestGroundLifeSpecies;
}

export interface FlowFestForestEcologyLayout {
  trees: FlowFestForestTreePlacement[];
  grass: FlowFestForestGrassPlacement[];
  groundLife: FlowFestForestGroundLifePlacement[];
  audit: {
    treeRouteIntrusions: number;
    grassRouteIntrusions: number;
    groundLifeRouteIntrusions: number;
    sourceTreeFamilies: number;
    plantFactoryTreePlacements: number;
    measuredCanopyPlacements: number;
    grassPlacements: number;
    groundLifePlacements: number;
  };
}

const GRASS_GRID_METERS = 4;
const GRASS_ROUTE_CLEARANCE_METERS = 0.45;
const GROUND_LIFE_ROUTE_CLEARANCE_METERS = 1.2;

/**
 * Adapt the Forest Scene ecology to the measured campground.
 *
 * Forest owns the visual families and wind-ready grass strata. Flow Fest owns
 * every world coordinate: tree centers come from local LiDAR maxima, while
 * ground life is deterministically sampled inside the measured footprint and
 * cut away from every registered route.
 */
export function deriveFlowFestForestEcology(
  contract: FlowFestRuntimeContract,
  terrain: ImportedTerrainDataV2,
  canopy: FlowFestCanopyEvidence,
  campPlan: FlowFestCampPlan | null = null
): FlowFestForestEcologyLayout {
  const routes = mergeEcologyRoutes(contract, campPlan);
  const canopyPeaks = deriveFlowFestCanopyPeaks(
    contract,
    terrain,
    canopy
  ).filter((peak) => !pointNearRoutes(peak.x, peak.z, routes, 3.2));
  const plantFactoryAccentOrdinalByIndex =
    derivePlantFactoryAccentOrdinalByIndex(canopyPeaks.length);
  const trees = canopyPeaks.map((peak, index): FlowFestForestTreePlacement => {
    const rng = makeRng(
      childSeed(FLOW_FEST_MASTER_SEED, `forest-tree:${peak.x}:${peak.z}`)
    );
    const renderedHeightMeters = clamp(
      peak.measuredHeightMeters * (0.62 + rng() * 0.08),
      7.5,
      19
    );
    const groundY = sampleFlowFestTerrainWorldY(terrain, peak.x, peak.z);
    const familyId = chooseTreeFamily(
      renderedHeightMeters,
      groundY,
      peak.neighborhoodHighReturnRatio,
      peak.x,
      peak.z,
      index,
      plantFactoryAccentOrdinalByIndex.get(index) ?? null,
      rng
    );
    return {
      x: peak.x,
      y: groundY,
      z: peak.z,
      rotation: rng() * Math.PI * 2,
      scale: 1,
      colorIndex: 0,
      measuredHeightMeters: peak.measuredHeightMeters,
      renderedHeightMeters,
      trunkHeightMeters: renderedHeightMeters * (0.68 + rng() * 0.05),
      trunkRadiusMeters: clamp(0.16 + renderedHeightMeters * 0.012, 0.24, 0.48),
      crownRadiusMeters: clamp(
        renderedHeightMeters * (0.27 + rng() * 0.035),
        2.15,
        5.1
      ),
      familyId,
    };
  });

  const grass: FlowFestForestGrassPlacement[] = [];
  const groundLife: FlowFestForestGroundLifePlacement[] = [];
  const bounds = contract.surfaceEvidenceProxy.activeBoundsWorldMeters;
  for (
    let gridZ = Math.ceil(bounds.minZ);
    gridZ <= Math.floor(bounds.maxZ);
    gridZ += GRASS_GRID_METERS
  ) {
    for (
      let gridX = Math.ceil(bounds.minX);
      gridX <= Math.floor(bounds.maxX);
      gridX += GRASS_GRID_METERS
    ) {
      const rng = makeRng(
        childSeed(FLOW_FEST_MASTER_SEED, `forest-floor:${gridX}:${gridZ}`)
      );
      const x = gridX + (rng() - 0.5) * 1.65;
      const z = gridZ + (rng() - 0.5) * 1.65;
      if (
        x < bounds.minX ||
        x > bounds.maxX ||
        z < bounds.minZ ||
        z > bounds.maxZ ||
        pointNearRoutes(x, z, routes, GRASS_ROUTE_CLEARANCE_METERS)
      ) {
        continue;
      }

      const canopyOffsetMeters = sampleCanopyOffsetMeters(
        terrain,
        canopy,
        x,
        z
      );
      const shaded = canopyOffsetMeters >= 4;
      const keepProbability = shaded ? 0.84 : 0.66;
      if (rng() > keepProbability) continue;
      const tierRoll = rng();
      const tier: FlowFestForestGrassTier =
        tierRoll < 0.58 ? "base" : tierRoll < 0.9 ? "medium" : "high";
      const species: FlowFestForestGrassSpecies = shaded
        ? "woodland-grass"
        : "summer-sward";
      const baseHeight = species === "woodland-grass" ? 0.42 : 0.32;
      grass.push({
        x,
        y: sampleFlowFestTerrainWorldY(terrain, x, z) + 0.012,
        z,
        rotation: rng() * Math.PI * 2,
        widthMeters: 0.2 + rng() * 0.17,
        heightMeters: baseHeight * (0.72 + rng() * 0.58),
        species,
        tier,
        colorIndex: Math.floor(rng() * 4),
      });

      if (
        shaded &&
        rng() < 0.008 &&
        !pointNearRoutes(x, z, routes, GROUND_LIFE_ROUTE_CLEARANCE_METERS)
      ) {
        groundLife.push({
          x,
          y: sampleFlowFestTerrainWorldY(terrain, x, z),
          z,
          rotation: rng() * Math.PI * 2,
          scale: 0.72 + rng() * 0.58,
          species:
            canopyOffsetMeters > 9 && rng() < 0.32
              ? "woodland-hazel-shrub"
              : "damp-sedge-tussock",
        });
      }
    }
  }
  appendRegisteredZoneGrass(contract, terrain, routes, grass);

  return {
    trees,
    grass,
    groundLife,
    audit: {
      treeRouteIntrusions: trees.filter((placement) =>
        pointNearRoutes(placement.x, placement.z, routes, 3.2)
      ).length,
      grassRouteIntrusions: grass.filter((placement) =>
        pointNearRoutes(
          placement.x,
          placement.z,
          routes,
          GRASS_ROUTE_CLEARANCE_METERS - 0.001
        )
      ).length,
      groundLifeRouteIntrusions: groundLife.filter((placement) =>
        pointNearRoutes(
          placement.x,
          placement.z,
          routes,
          GROUND_LIFE_ROUTE_CLEARANCE_METERS - 0.001
        )
      ).length,
      sourceTreeFamilies: new Set(trees.map((tree) => tree.familyId)).size,
      plantFactoryTreePlacements: trees.filter((tree) =>
        FLOW_FEST_PLANTFACTORY_TREE_FAMILIES.includes(
          tree.familyId as (typeof FLOW_FEST_PLANTFACTORY_TREE_FAMILIES)[number]
        )
      ).length,
      measuredCanopyPlacements: trees.length,
      grassPlacements: grass.length,
      groundLifePlacements: groundLife.length,
    },
  };
}

function mergeEcologyRoutes(
  contract: FlowFestRuntimeContract,
  campPlan: FlowFestCampPlan | null
): FlowFestRuntimeSegment[] {
  const routes = uniqueFlowFestSurfaceSegments(contract);
  if (!campPlan) return routes;
  const planLines = allFlowFestCampPlanLines(campPlan);
  const byId = new Map(routes.map((route) => [route.id, route]));
  for (const line of planLines)
    byId.set(line.id, flowFestCampPlanLineToRuntimeSegment(line));
  return [...byId.values()];
}

function appendRegisteredZoneGrass(
  contract: FlowFestRuntimeContract,
  terrain: ImportedTerrainDataV2,
  routes: FlowFestRuntimeSegment[],
  grass: FlowFestForestGrassPlacement[]
): void {
  const spacingMeters = 1.05;
  for (const zone of contract.zones) {
    const radiusX = zone.radiusMeters ?? zone.searchRadiusXMeters ?? 0;
    const radiusZ = zone.radiusMeters ?? zone.searchRadiusZMeters ?? 0;
    if (radiusX <= 0 || radiusZ <= 0) continue;
    for (let localZ = -radiusZ; localZ <= radiusZ; localZ += spacingMeters) {
      for (let localX = -radiusX; localX <= radiusX; localX += spacingMeters) {
        for (let tuft = 0; tuft < 3; tuft += 1) {
          const rng = makeRng(
            childSeed(
              FLOW_FEST_MASTER_SEED,
              `zone-grass:${zone.id}:${localX.toFixed(2)}:${localZ.toFixed(2)}:${tuft}`
            )
          );
          const x = zone.center.x + localX + (rng() - 0.5) * 0.86;
          const z = zone.center.z + localZ + (rng() - 0.5) * 0.86;
          const normalizedX = (x - zone.center.x) / radiusX;
          const normalizedZ = (z - zone.center.z) / radiusZ;
          if (
            normalizedX * normalizedX + normalizedZ * normalizedZ > 1 ||
            pointNearRoutes(x, z, routes, GRASS_ROUTE_CLEARANCE_METERS) ||
            rng() > 0.9
          ) {
            continue;
          }
          const tierRoll = rng();
          grass.push({
            x,
            y: sampleFlowFestTerrainWorldY(terrain, x, z) + 0.012,
            z,
            rotation: rng() * Math.PI * 2,
            widthMeters: 0.12 + rng() * 0.1,
            heightMeters: 0.2 + rng() * 0.14,
            species: "summer-sward",
            tier:
              tierRoll < 0.62 ? "base" : tierRoll < 0.92 ? "medium" : "high",
            colorIndex: Math.floor(rng() * 4),
          });
        }
      }
    }
  }
}

function chooseTreeFamily(
  renderedHeightMeters: number,
  groundY: number,
  neighborhoodHighReturnRatio: number,
  x: number,
  z: number,
  index: number,
  plantFactoryAccentOrdinal: number | null,
  rng: () => number
): FlowFestForestTreeFamilyId {
  if (plantFactoryAccentOrdinal !== null) {
    return choosePlantFactoryAccentFamily(plantFactoryAccentOrdinal);
  }

  // The four Flow Fest LOD families carry the measured canopy at riding
  // distance. Each 48 metre habitat cell receives a stable phase offset, so
  // neighboring trees read as a stand without one silhouette taking over.
  const habitatRng = makeRng(
    childSeed(
      FLOW_FEST_MASTER_SEED,
      `forest-habitat:${Math.floor(x / 48)}:${Math.floor(z / 48)}`
    )
  );
  const massFamilies = [
    "island-tree-01",
    "island-tree-02",
    "island-tree-03",
    "tree-small-02",
  ] as const satisfies readonly FlowFestForestTreeFamilyId[];
  const habitatBias =
    groundY < 8.5
      ? 2
      : renderedHeightMeters < 10.6
        ? 3
        : neighborhoodHighReturnRatio > 0.72
          ? 0
          : 1;
  const habitatPhase = Math.floor(habitatRng() * massFamilies.length);
  const variation = rng() < 0.28 ? 1 : 0;
  return massFamilies[
    (index + habitatBias + habitatPhase + variation) % massFamilies.length
  ]!;
}

function derivePlantFactoryAccentOrdinalByIndex(
  treeCount: number
): ReadonlyMap<number, number> {
  const accentCount = Math.min(FLOW_FEST_PLANTFACTORY_ACCENT_COUNT, treeCount);
  const accents = new Map<number, number>();
  if (accentCount === 0) return accents;
  if (accentCount === 1) {
    accents.set(0, 0);
    return accents;
  }

  const spacing = (treeCount - 1) / (accentCount - 1);
  for (let ordinal = 0; ordinal < accentCount; ordinal += 1) {
    accents.set(Math.round(ordinal * spacing), ordinal);
  }
  return accents;
}

function choosePlantFactoryAccentFamily(
  accentOrdinal: number
): FlowFestForestTreeFamilyId {
  // Snags are habitat punctuation, not a repeated canopy. The living accents
  // cycle through every PlantFactory family before repeating.
  if (accentOrdinal === 13 || accentOrdinal === 29) {
    return "plantcatalog-habitat-snag";
  }
  const livingFamilies = [
    "plantcatalog-oak-colonised",
    "plantcatalog-aesculus-carnea",
    "plantcatalog-oak-urban",
    "plantcatalog-willow",
    "plantcatalog-buckeye-31",
    "plantcatalog-buckeye-79",
  ] as const satisfies readonly FlowFestForestTreeFamilyId[];
  const priorSnags = Number(accentOrdinal > 13) + Number(accentOrdinal > 29);
  return livingFamilies[(accentOrdinal - priorSnags) % livingFamilies.length]!;
}

function sampleCanopyOffsetMeters(
  terrain: ImportedTerrainDataV2,
  canopy: FlowFestCanopyEvidence,
  x: number,
  z: number
): number {
  const column = Math.round(
    ((x - terrain.worldBounds.minX) /
      (terrain.worldBounds.maxX - terrain.worldBounds.minX)) *
      (canopy.width - 1)
  );
  const row = Math.round(
    ((z - terrain.worldBounds.minZ) /
      (terrain.worldBounds.maxZ - terrain.worldBounds.minZ)) *
      (canopy.height - 1)
  );
  if (column < 0 || row < 0 || column >= canopy.width || row >= canopy.height) {
    return 0;
  }
  const value = canopy.offsetsCentimeters[row * canopy.width + column];
  return value == null || value === 65535 ? 0 : value / 100;
}

function pointNearRoutes(
  x: number,
  z: number,
  routes: FlowFestRuntimeSegment[],
  extraClearanceMeters: number
): boolean {
  return routes.some((route) => {
    const clearance = route.widthMeters / 2 + extraClearanceMeters;
    for (let index = 1; index < route.points.length; index += 1) {
      if (
        distanceToSegment(
          x,
          z,
          route.points[index - 1]!,
          route.points[index]!
        ) <= clearance
      ) {
        return true;
      }
    }
    return false;
  });
}

function distanceToSegment(
  x: number,
  z: number,
  start: FlowFestRuntimePoint,
  end: FlowFestRuntimePoint
): number {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (lengthSquared === 0) return Math.hypot(x - start.x, z - start.z);
  const progress = Math.max(
    0,
    Math.min(
      1,
      ((x - start.x) * deltaX + (z - start.z) * deltaZ) / lengthSquared
    )
  );
  return Math.hypot(
    x - (start.x + deltaX * progress),
    z - (start.z + deltaZ * progress)
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
