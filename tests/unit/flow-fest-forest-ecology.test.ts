import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ImportedTerrainDataV2 } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";
import { parseFlowFestRuntimeContract } from "../../src/routes/test/flow-fest-graybox/flow-fest-runtime-contract";
import {
  deriveFlowFestForestEcology,
  FLOW_FEST_FOREST_GRASS_ASSET,
  FLOW_FEST_FOREST_GROUND_LIFE_ASSETS,
  FLOW_FEST_PLANTFACTORY_ACCENT_COUNT,
  FLOW_FEST_PLANTFACTORY_TREE_FAMILIES,
  FLOW_FEST_FOREST_TREE_ASSETS,
} from "../../src/routes/test/flow-fest-sim/flow-fest-forest-ecology";
import { createFlowFestCampPlan } from "../../src/routes/test/flow-fest-sim/flow-fest-camp-plan";

const root = process.cwd();

function readTypedArray<T extends Float32Array | Uint16Array>(
  path: string,
  make: (buffer: ArrayBuffer) => T
): T {
  const bytes = readFileSync(resolve(root, path));
  return make(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer
  );
}

function loadInputs() {
  const contract = parseFlowFestRuntimeContract(
    JSON.parse(
      readFileSync(
        resolve(root, "static/data/flow-fest-sim/gate2-runtime-contract.json"),
        "utf8"
      )
    )
  );
  const heights = readTypedArray(
    "static/data/flow-fest-sim/terrain-height.f32",
    (buffer) => new Float32Array(buffer)
  );
  const offsets = readTypedArray(
    "static/data/flow-fest-sim/surface-offset.u16",
    (buffer) => new Uint16Array(buffer)
  );
  const terrain: ImportedTerrainDataV2 = {
    version: 2,
    name: "Flow Fest Sim Earth site",
    sourceManifestPath: "/data/flow-fest-sim/terrain.manifest.json",
    worldBounds: { minX: -512, maxX: 512, minZ: -512, maxZ: 512 },
    heightmap: {
      width: 1025,
      height: 1025,
      minElevation: 270.7053527832031,
      maxElevation: 298.4906005859375,
      verticalOriginMeters: 270,
      verticalScale: 1,
      heights,
    },
    boundary: [
      { worldX: -512, worldZ: -512 },
      { worldX: 512, worldZ: -512 },
      { worldX: 512, worldZ: 512 },
      { worldX: -512, worldZ: 512 },
    ],
    geoReference: {
      projectedCrs: {
        authority: "EPSG",
        code: 26916,
        name: "NAD83 / UTM zone 16N",
      },
      requestedAnchorWgs84: { latitude: 39.589617, longitude: -84.785764 },
      resolvedOriginWgs84: {
        latitude: 39.589613265369856,
        longitude: -84.78576527257212,
      },
      originProjectedMeters: { easting: 690142, northing: 4384552 },
      axes: { x: "east", y: "up", z: "south" },
      verticalDatum: "NAVD88",
    },
  };
  return { contract, terrain, offsets };
}

describe("Flow Fest Forest ecology integration", () => {
  it("ships every asset required by the all-family runtime readiness gate", () => {
    const assetPaths = [
      ...Object.values(FLOW_FEST_FOREST_TREE_ASSETS),
      FLOW_FEST_FOREST_GRASS_ASSET,
      ...Object.values(FLOW_FEST_FOREST_GROUND_LIFE_ASSETS),
    ];

    for (const assetPath of assetPaths) {
      expect(existsSync(resolve(root, `static${assetPath}`)), assetPath).toBe(
        true
      );
    }
  });

  it("uses the approved Forest families at deterministic measured coordinates", () => {
    const { contract, terrain, offsets } = loadInputs();
    const canopy = {
      offsetsCentimeters: offsets,
      width: 1025,
      height: 1025,
    };
    const first = deriveFlowFestForestEcology(contract, terrain, canopy);
    const second = deriveFlowFestForestEcology(contract, terrain, canopy);

    expect(Object.values(FLOW_FEST_FOREST_TREE_ASSETS)).toHaveLength(11);
    expect(FLOW_FEST_FOREST_TREE_ASSETS).not.toHaveProperty("forest-oak");
    expect(FLOW_FEST_FOREST_GRASS_ASSET).toBe(
      "/models/flow-fest-sim/ecology/forest-grass-prototypes.glb"
    );
    expect(
      Object.values(FLOW_FEST_FOREST_TREE_ASSETS).every(
        (path) =>
          path.startsWith("/models/flow-fest-sim/ecology/") ||
          path.startsWith("/models/forest/trees/candidates/plantcatalog-r1/")
      )
    ).toBe(true);
    expect(first.audit).toEqual(second.audit);
    expect(first.trees.slice(0, 40)).toEqual(second.trees.slice(0, 40));
    expect(first.grass.slice(0, 120)).toEqual(second.grass.slice(0, 120));
    expect(first.groundLife).toEqual(second.groundLife);
    expect(first.audit).toMatchObject({
      measuredCanopyPlacements: 440,
      sourceTreeFamilies: 11,
      plantFactoryTreePlacements: FLOW_FEST_PLANTFACTORY_ACCENT_COUNT,
      grassPlacements: 22_217,
      groundLifePlacements: 20,
    });
  });

  it("keeps Forest ecology outside every registered travel corridor", () => {
    const { contract, terrain, offsets } = loadInputs();
    const ecology = deriveFlowFestForestEcology(contract, terrain, {
      offsetsCentimeters: offsets,
      width: 1025,
      height: 1025,
    });

    expect(ecology.audit).toMatchObject({
      treeRouteIntrusions: 0,
      grassRouteIntrusions: 0,
      groundLifeRouteIntrusions: 0,
    });
    expect(ecology.trees).toHaveLength(440);
    expect(ecology.grass.length).toBeGreaterThan(20_000);
    expect(ecology.groundLife.length).toBeGreaterThan(0);
    expect(
      ecology.audit.plantFactoryTreePlacements / ecology.trees.length
    ).toBeLessThan(0.1);
    expect(
      ecology.trees.filter((tree) =>
        FLOW_FEST_PLANTFACTORY_TREE_FAMILIES.includes(
          tree.familyId as (typeof FLOW_FEST_PLANTFACTORY_TREE_FAMILIES)[number]
        )
      )
    ).toHaveLength(ecology.audit.plantFactoryTreePlacements);
    const familyCounts = new Map<string, number>();
    for (const tree of ecology.trees) {
      familyCounts.set(
        tree.familyId,
        (familyCounts.get(tree.familyId) ?? 0) + 1
      );
    }
    expect(
      Math.max(...familyCounts.values()) / ecology.trees.length
    ).toBeLessThanOrEqual(0.28);
    for (const familyId of Object.keys(FLOW_FEST_FOREST_TREE_ASSETS)) {
      expect(ecology.trees.some((tree) => tree.familyId === familyId)).toBe(
        true
      );
    }
    const accentIndices = ecology.trees.flatMap((tree, index) =>
      FLOW_FEST_PLANTFACTORY_TREE_FAMILIES.includes(
        tree.familyId as (typeof FLOW_FEST_PLANTFACTORY_TREE_FAMILIES)[number]
      )
        ? [index]
        : []
    );
    expect(accentIndices).toHaveLength(FLOW_FEST_PLANTFACTORY_ACCENT_COUNT);
    expect(accentIndices[0]).toBe(0);
    expect(accentIndices.at(-1)).toBe(ecology.trees.length - 1);
    expect(
      Math.max(
        ...accentIndices.slice(1).map((index, accentIndex) => {
          return index - accentIndices[accentIndex]!;
        })
      )
    ).toBeLessThanOrEqual(14);
  });

  it("carves the shared camp-plan roads and connectors from the measured ecology", () => {
    const { contract, terrain, offsets } = loadInputs();
    const canopy = {
      offsetsCentimeters: offsets,
      width: 1025,
      height: 1025,
    };
    const baseline = deriveFlowFestForestEcology(contract, terrain, canopy);
    const planAligned = deriveFlowFestForestEcology(
      contract,
      terrain,
      canopy,
      createFlowFestCampPlan(contract, "lower-tent")
    );

    expect(planAligned.audit).toMatchObject({
      treeRouteIntrusions: 0,
      grassRouteIntrusions: 0,
      groundLifeRouteIntrusions: 0,
    });
    expect(planAligned.trees.length).toBeLessThan(baseline.trees.length);
    expect(planAligned.grass.length).toBeLessThan(baseline.grass.length);
  });
});
