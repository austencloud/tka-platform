import { BufferGeometry, IcosahedronGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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

/**
 * Material-name tokens that mark a tree or ground-life material as living
 * foliage rather than wood. Both spellings of leaf are required: every
 * Flow Fest island-tree family ships its canopy as `<family>_leaves`, which
 * does not contain the substring `leaf`.
 */
export const FLOW_FEST_FOREST_FOLIAGE_MATERIAL_TOKENS = [
  "leaf",
  "leaves",
  "foliage",
  "twig",
  "frond",
  "needle",
  "canopy",
  "blossom",
  "petal",
  "sedge",
  "hazel",
] as const;

/**
 * A tree material is foliage when its name says so, or when it is an
 * alpha-cutout card. Every foliage material in the shipped Flow Fest tree
 * families is authored as glTF `alphaMode: "MASK"`, which three.js loads as a
 * positive `alphaTest`; wood, bark, and branch materials are opaque.
 */
export function isFlowFestForestFoliageMaterial(material: {
  name?: string | null;
  alphaTest?: number;
}): boolean {
  const name = (material.name ?? "").toLowerCase();
  if (
    FLOW_FEST_FOREST_FOLIAGE_MATERIAL_TOKENS.some((token) =>
      name.includes(token)
    )
  ) {
    return true;
  }
  return (material.alphaTest ?? 0) > 0;
}

export interface FlowFestDistanceTierMaterialLike {
  name?: string | null;
  alphaTest?: number;
  transparent?: boolean;
  depthWrite?: boolean;
  map?: unknown;
  alphaMap?: unknown;
  roughness?: number;
  needsUpdate?: boolean;
}

/**
 * The mid and far tree tiers ship geometry only: `distance-lod/*.glb` carry no
 * images and no `TEXCOORD_0`, so they borrow the near tier's materials. Those
 * materials are textured, and the canopy material is an alpha-cutout leaf
 * atlas. Sampling a texture with no UVs reads texel (0, 0) for every fragment,
 * which in a leaf atlas is fully transparent — `alphaTest` then discards the
 * entire canopy and every tree past the near radius renders as bare branches.
 *
 * A distance-tier material therefore drops its atlas and its cutout and renders
 * as a solid mass in the moment's foliage or bark tint, which is what a tree
 * reads as beyond the near radius anyway. Returns true when the material
 * carried a texture or a cutout that had to go.
 */
export function flattenFlowFestDistanceTierMaterial(
  material: FlowFestDistanceTierMaterialLike
): boolean {
  const carriedUvDependentShading =
    material.map != null ||
    material.alphaMap != null ||
    (material.alphaTest ?? 0) > 0;
  material.map = null;
  material.alphaMap = null;
  material.alphaTest = 0;
  material.transparent = false;
  material.depthWrite = true;
  material.roughness = isFlowFestForestFoliageMaterial(material) ? 0.95 : 1;
  material.needsUpdate = true;
  return carriedUvDependentShading;
}

export interface FlowFestCanopyShellBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface FlowFestCanopyShellOptions {
  /** Number of merged lobes. More lobes read as a clumpier crown. */
  lobes: number;
  /** Icosahedron subdivision. 0 is 20 faces per lobe, 1 is 80. */
  detail: number;
}

export const FLOW_FEST_CANOPY_SHELL_TIERS: Record<
  "mid" | "far",
  FlowFestCanopyShellOptions
> = {
  mid: { lobes: 5, detail: 1 },
  far: { lobes: 3, detail: 0 },
};

/**
 * Flattening the distance material stops the canopy being discarded, but it
 * cannot put leaves back: the shipped `distance-lod/*.glb` simplification
 * decimates a leaf atlas — thousands of disconnected two-triangle cards — down
 * to a scatter of stray quads. Mid keeps roughly a fifth of the near tier's
 * canopy triangles and none of its coverage, so a graded material paints a
 * handful of specks and every tree past 55 m still reads bare.
 *
 * A distance canopy is a mass, not foliage. This builds that mass: a few
 * merged, direction-perturbed ellipsoid lobes filling the leaf bounding box,
 * with smooth ellipsoid normals so it shades as a soft crown instead of a
 * faceted rock. It is both the correct read and far cheaper than the decimated
 * cards it replaces (about 320 triangles at mid, 60 at far).
 */
export function buildFlowFestCanopyShellGeometry(
  bounds: FlowFestCanopyShellBounds,
  seedLabel: string,
  options: FlowFestCanopyShellOptions
): BufferGeometry {
  const rng = makeRng(
    childSeed(FLOW_FEST_MASTER_SEED, `canopy-shell-${seedLabel}`)
  );
  const lobeCount = Math.max(1, Math.round(options.lobes));
  const lobes: BufferGeometry[] = [];

  // Lobes are laid out in a unit cube and fitted to the real bounds at the end,
  // so the crown can never overshoot the leaf envelope it replaces no matter
  // how the seed lands.
  for (let index = 0; index < lobeCount; index += 1) {
    const lobe = new IcosahedronGeometry(1, Math.max(0, options.detail));
    // Lobe 0 is the core; the rest ring around it so the silhouette breaks up.
    const isCore = index === 0;
    const angle =
      ((index - 1) / Math.max(1, lobeCount - 1)) * Math.PI * 2 +
      (rng() - 0.5) * 0.8;
    const spread = isCore ? 0 : 0.2 + rng() * 0.1;
    const radii = {
      x: isCore ? 0.44 : 0.28 + rng() * 0.1,
      y: isCore ? 0.42 : 0.26 + rng() * 0.12,
      z: isCore ? 0.44 : 0.28 + rng() * 0.1,
    };
    const offset = {
      x: Math.cos(angle) * spread,
      y: isCore ? 0.02 : (rng() - 0.5) * 0.34,
      z: Math.sin(angle) * spread,
    };
    const phase = rng() * Math.PI * 2;
    const positions = lobe.attributes.position;
    const normals = lobe.attributes.normal;

    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const ux = positions.getX(vertex);
      const uy = positions.getY(vertex);
      const uz = positions.getZ(vertex);
      // Perturb by direction, never per vertex: the geometry is non-indexed, so
      // the three copies of a shared corner must displace identically or the
      // shell tears open.
      const wobble =
        1 +
        0.21 * Math.sin(3 * Math.atan2(uz, ux) + phase) +
        0.13 * Math.cos(4 * uy + phase * 0.7) +
        0.08 * Math.sin(5 * Math.atan2(uy, ux) + phase * 1.9);
      positions.setXYZ(
        vertex,
        offset.x + ux * radii.x * wobble,
        offset.y + uy * radii.y * wobble,
        offset.z + uz * radii.z * wobble
      );
      // Ellipsoid normal: gradient of x²/a² + y²/b² + z²/c², i.e. (u/a, v/b, w/c).
      const nx = ux / radii.x;
      const ny = uy / radii.y;
      const nz = uz / radii.z;
      const length = Math.hypot(nx, ny, nz) || 1;
      normals.setXYZ(vertex, nx / length, ny / length, nz / length);
    }
    positions.needsUpdate = true;
    normals.needsUpdate = true;
    // The borrowed near-tier canopy material is an alpha-cutout atlas. A shell
    // that kept UVs would be skipped by the distance-material flatten and get
    // discarded exactly like the geometry it replaces.
    lobe.deleteAttribute("uv");
    lobes.push(lobe);
  }

  const merged = mergeGeometries(lobes, false);
  for (const lobe of lobes) lobe.dispose();
  if (!merged) {
    throw new Error(`Flow Fest canopy shell failed to merge for ${seedLabel}`);
  }
  fitGeometryToBounds(merged, bounds, FLOW_FEST_CANOPY_SHELL_INSET);
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/** Fraction of the leaf envelope the crown occupies; the rest lets branch tips through. */
const FLOW_FEST_CANOPY_SHELL_INSET = 0.96;

function fitGeometryToBounds(
  geometry: BufferGeometry,
  bounds: FlowFestCanopyShellBounds,
  inset: number
): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const axes = ["x", "y", "z"] as const;
  const scale = { x: 1, y: 1, z: 1 };
  const shift = { x: 0, y: 0, z: 0 };

  for (const axis of axes) {
    const sourceSpan = Math.max(1e-6, box.max[axis] - box.min[axis]);
    const targetSpan = (bounds.max[axis] - bounds.min[axis]) * inset;
    scale[axis] = targetSpan / sourceSpan;
    const sourceCenter = (box.min[axis] + box.max[axis]) / 2;
    const targetCenter = (bounds.min[axis] + bounds.max[axis]) / 2;
    shift[axis] = targetCenter - sourceCenter * scale[axis];
  }

  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    positions.setXYZ(
      vertex,
      positions.getX(vertex) * scale.x + shift.x,
      positions.getY(vertex) * scale.y + shift.y,
      positions.getZ(vertex) * scale.z + shift.z
    );
    // Normals transform by the inverse-transpose, which for a diagonal scale is
    // a per-axis reciprocal. Skipping this flattens the shading on tall crowns.
    const nx = normals.getX(vertex) / scale.x;
    const ny = normals.getY(vertex) / scale.y;
    const nz = normals.getZ(vertex) / scale.z;
    const length = Math.hypot(nx, ny, nz) || 1;
    normals.setXYZ(vertex, nx / length, ny / length, nz / length);
  }
  positions.needsUpdate = true;
  normals.needsUpdate = true;
}

export type FlowFestForestEcologyAssetState = "pending" | "ready" | "failed";

export interface FlowFestForestEcologyAssetEntry {
  key: string;
  url: string;
  state: FlowFestForestEcologyAssetState;
  message?: string | null;
}

export interface FlowFestForestEcologyAssetReport {
  status: "loading" | "ready" | "failed";
  expected: number;
  ready: number;
  pending: string[];
  failed: Array<{ key: string; url: string; message: string }>;
}

/**
 * Collapses the per-asset ledger into one honest status. A failed asset stays
 * failed even while siblings are still loading, so an absent forest can never
 * present itself as a scene that is merely slow.
 */
export function summarizeFlowFestForestEcologyAssets(
  entries: readonly FlowFestForestEcologyAssetEntry[]
): FlowFestForestEcologyAssetReport {
  const failed = entries
    .filter((entry) => entry.state === "failed")
    .map((entry) => ({
      key: entry.key,
      url: entry.url,
      message: entry.message ?? "Asset failed to load",
    }));
  const pending = entries
    .filter((entry) => entry.state === "pending")
    .map((entry) => entry.key);
  const ready = entries.filter((entry) => entry.state === "ready").length;
  return {
    status:
      failed.length > 0 ? "failed" : pending.length > 0 ? "loading" : "ready",
    expected: entries.length,
    ready,
    pending,
    failed,
  };
}

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
