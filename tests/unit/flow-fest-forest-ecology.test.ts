import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ImportedTerrainDataV2 } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";
import { parseFlowFestRuntimeContract } from "../../src/routes/test/flow-fest-graybox/flow-fest-runtime-contract";
import {
  deriveFlowFestForestEcology,
  deriveFlowFestTreeInstanceTint,
  FLOW_FEST_FOREST_DISTANCE_GRASS_ASSETS,
  FLOW_FEST_FOREST_GRASS_ASSET,
  FLOW_FEST_FOREST_GROUND_LIFE_ASSETS,
  FLOW_FEST_FOREST_DISTANCE_LOD,
  FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS,
  FLOW_FEST_FOREST_TRUNK_PROFILES,
  FLOW_FEST_PLANTFACTORY_TREE_FAMILIES,
  FLOW_FEST_FOREST_TREE_ASSETS,
  isFlowFestForestFoliageMaterial,
  summarizeFlowFestForestEcologyAssets,
  type FlowFestForestTreeFamilyId,
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

function loadCanopy() {
  const { contract, terrain, offsets } = loadInputs();
  return {
    contract,
    terrain,
    canopy: {
      offsetsCentimeters: offsets,
      width: 1025,
      height: 1025,
    },
  };
}

describe("Flow Fest Forest ecology integration", () => {
  it("ships every asset required by the all-family runtime readiness gate", () => {
    const assetPaths = [
      ...Object.values(FLOW_FEST_FOREST_TREE_ASSETS),
      ...Object.values(FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.mid),
      ...Object.values(FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.far),
      ...Object.values(FLOW_FEST_FOREST_DISTANCE_GRASS_ASSETS),
      FLOW_FEST_FOREST_GRASS_ASSET,
      ...Object.values(FLOW_FEST_FOREST_GROUND_LIFE_ASSETS),
    ];

    for (const assetPath of assetPaths) {
      expect(existsSync(resolve(root, `static${assetPath}`)), assetPath).toBe(
        true
      );
    }
  });

  it("gives every family its own mid and far tier so no tree changes identity with distance", () => {
    const nearFamilyIds = Object.keys(FLOW_FEST_FOREST_TREE_ASSETS);
    const midFamilyIds = Object.keys(FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.mid);
    const farFamilyIds = Object.keys(FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.far);

    expect(midFamilyIds).toEqual(nearFamilyIds);
    expect(farFamilyIds).toEqual(nearFamilyIds);
    for (const familyId of nearFamilyIds) {
      expect(
        FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.mid[
          familyId as FlowFestForestTreeFamilyId
        ]
      ).toBe(
        `/models/flow-fest-sim/ecology/distance-lod/${familyId}-mid.glb`
      );
    }
    expect(FLOW_FEST_FOREST_DISTANCE_LOD.nearMaximumMeters).toBeGreaterThan(0);
    expect(FLOW_FEST_FOREST_DISTANCE_LOD.midMaximumMeters).toBeGreaterThan(
      FLOW_FEST_FOREST_DISTANCE_LOD.nearMaximumMeters
    );
    expect(FLOW_FEST_FOREST_DISTANCE_LOD.grassMaximumMeters).toBeGreaterThan(
      FLOW_FEST_FOREST_DISTANCE_LOD.grassMidMaximumMeters
    );
    expect(FLOW_FEST_FOREST_DISTANCE_LOD.grassMidMaximumMeters).toBeGreaterThan(
      FLOW_FEST_FOREST_DISTANCE_LOD.grassNearMaximumMeters
    );
    expect(FLOW_FEST_FOREST_DISTANCE_LOD.grassNearMaximumMeters).toBeLessThan(
      FLOW_FEST_FOREST_DISTANCE_LOD.nearMaximumMeters
    );
    expect(FLOW_FEST_FOREST_DISTANCE_LOD.grassMidDensity).toBe(0.5);
    expect(FLOW_FEST_FOREST_DISTANCE_LOD.grassFarDensity).toBe(0.25);
  });

  it("ships reproducible per-family tiers with real triangle reduction", () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(
          root,
          "static/models/flow-fest-sim/ecology/distance-lod/manifest.json"
        ),
        "utf8"
      )
    ) as {
      schemaVersion: number;
      families: Array<{
        id: string;
        sourceTriangles: number;
        tiers: Record<
          "mid" | "far",
          { outputTriangles: number; outputSha256: string }
        >;
      }>;
    };

    expect(manifest.schemaVersion).toBe(2);
    const manifestIds = manifest.families.map((family) => family.id);
    for (const familyId of Object.keys(FLOW_FEST_FOREST_TREE_ASSETS)) {
      expect(manifestIds, familyId).toContain(familyId);
    }
    for (const family of manifest.families) {
      for (const tier of ["mid", "far"] as const) {
        const entry = family.tiers[tier];
        expect(entry.outputSha256, `${family.id} ${tier}`).toMatch(
          /^[a-f0-9]{64}$/
        );
        expect(
          entry.outputTriangles,
          `${family.id} ${tier} triangles`
        ).toBeLessThan(family.sourceTriangles);
        // The instance budget: a mid tree stays under ~20k triangles and a far
        // tree under ~5k, or a few hundred instances of it stop being cheap.
        expect(entry.outputTriangles).toBeLessThanOrEqual(
          tier === "mid" ? 20_000 : 5_000
        );
      }
      expect(family.tiers.far.outputTriangles).toBeLessThanOrEqual(
        family.tiers.mid.outputTriangles
      );
    }
  });

  it("ships reproducible grass distance tiers with the accepted palette payload", () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(
          root,
          "static/models/flow-fest-sim/ecology/distance-lod/grass/manifest.json"
        ),
        "utf8"
      )
    ) as {
      schemaVersion: number;
      sourceTriangles: number;
      tiers: Array<{
        id: "mid" | "far";
        outputTriangles: number;
        outputSha256: string;
      }>;
    };

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.tiers).toHaveLength(2);
    for (const tier of manifest.tiers) {
      const maximumRatio = tier.id === "mid" ? 0.6 : 0.25;
      expect(
        tier.outputTriangles / manifest.sourceTriangles
      ).toBeLessThanOrEqual(maximumRatio);
      expect(tier.outputSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("derives a deterministic ecology from the measured coordinates", () => {
    const { contract, terrain, canopy } = loadCanopy();
    const first = deriveFlowFestForestEcology(contract, terrain, canopy);
    const second = deriveFlowFestForestEcology(contract, terrain, canopy);

    expect(Object.values(FLOW_FEST_FOREST_TREE_ASSETS)).toHaveLength(22);
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
    expect(first.audit.measuredCanopyPlacements).toBe(440);
    expect(first.audit.infillTreePlacements).toBeGreaterThan(100);
    expect(first.trees).toHaveLength(
      first.audit.measuredCanopyPlacements + first.audit.infillTreePlacements
    );
    expect(first.audit.sourceTreeFamilies).toBe(
      Object.keys(FLOW_FEST_FOREST_TREE_ASSETS).length
    );
    expect(first.audit.grassPlacements).toBeGreaterThan(20_000);
    expect(first.audit.groundLifePlacements).toBeGreaterThan(0);
  });

  it("casts the PlantFactory species as the forest majority with every family present", () => {
    const { contract, terrain, canopy } = loadCanopy();
    const ecology = deriveFlowFestForestEcology(contract, terrain, canopy);

    expect(ecology.audit).toMatchObject({
      treeRouteIntrusions: 0,
      grassRouteIntrusions: 0,
      groundLifeRouteIntrusions: 0,
    });
    expect(
      ecology.trees.filter((tree) =>
        FLOW_FEST_PLANTFACTORY_TREE_FAMILIES.includes(tree.familyId)
      )
    ).toHaveLength(ecology.audit.plantFactoryTreePlacements);
    // The gorgeous-tree directive: PlantFactory species carry the forest, the
    // island families season it.
    expect(
      ecology.audit.plantFactoryTreePlacements / ecology.trees.length
    ).toBeGreaterThan(0.5);
    const familyCounts = new Map<string, number>();
    for (const tree of ecology.trees) {
      familyCounts.set(
        tree.familyId,
        (familyCounts.get(tree.familyId) ?? 0) + 1
      );
    }
    for (const familyId of Object.keys(FLOW_FEST_FOREST_TREE_ASSETS)) {
      expect(familyCounts.get(familyId), familyId).toBeGreaterThan(0);
    }
    expect(
      Math.max(...familyCounts.values()) / ecology.trees.length
    ).toBeLessThanOrEqual(0.28);
    // Standing dead wood is punctuation: present, never a stand.
    const snagCount = familyCounts.get("plantcatalog-habitat-snag") ?? 0;
    expect(snagCount).toBeGreaterThan(0);
    expect(snagCount / ecology.trees.length).toBeLessThan(0.05);
  });

  it("plants infill only under surveyed canopy, clear of routes, zones, and neighbors", () => {
    const { contract, terrain, canopy } = loadCanopy();
    const ecology = deriveFlowFestForestEcology(contract, terrain, canopy);
    const measured = ecology.trees.slice(
      0,
      ecology.audit.measuredCanopyPlacements
    );
    const infill = ecology.trees.slice(ecology.audit.measuredCanopyPlacements);

    expect(infill.length).toBe(ecology.audit.infillTreePlacements);
    for (const tree of infill) {
      const nearestMeasured = Math.min(
        ...measured.map((other) =>
          Math.hypot(other.x - tree.x, other.z - tree.z)
        )
      );
      // INFILL_MINIMUM_TREE_SPACING_METERS in the ecology module.
      expect(nearestMeasured).toBeGreaterThanOrEqual(4.5);
    }
    // Route clearance for every tree is already asserted through the audit's
    // treeRouteIntrusions: 0 in the casting test above.
  });

  it("sizes every collision trunk from its family's measured geometry", () => {
    const { contract, terrain, canopy } = loadCanopy();
    const ecology = deriveFlowFestForestEcology(contract, terrain, canopy);

    for (const tree of ecology.trees) {
      const profile = FLOW_FEST_FOREST_TRUNK_PROFILES[tree.familyId];
      expect(profile, tree.familyId).toBeGreaterThan(0);
      const expected = Math.max(
        0.2,
        Math.min(1.9, tree.renderedHeightMeters * profile)
      );
      expect(tree.trunkRadiusMeters).toBeCloseTo(expected, 6);
    }
    // The clip-through regression: island-tree-03 renders a bole far wider
    // than the old 0.48 m one-size cap, and its collision now matches.
    const wideBole = ecology.trees.find(
      (tree) => tree.familyId === "island-tree-03"
    );
    expect(wideBole).toBeDefined();
    expect(wideBole!.trunkRadiusMeters).toBeGreaterThan(0.9);
  });

  it("carves the shared camp-plan roads and connectors from the measured ecology", () => {
    const { contract, terrain, canopy } = loadCanopy();
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

interface GltfJson {
  images?: unknown[];
  textures?: unknown[];
  accessors?: Array<{ count: number }>;
  materials?: Array<{ name?: string; alphaMode?: string }>;
  meshes?: Array<{
    primitives: Array<{
      material: number;
      indices?: number;
      attributes: Record<string, number | undefined>;
    }>;
  }>;
}

function readGltfJson(assetUrl: string): GltfJson {
  const bytes = readFileSync(
    resolve(root, "static", assetUrl.replace(/^\//, ""))
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(bytes.buffer, bytes.byteOffset + 20, jsonLength)
    )
  ) as GltfJson;
}

function readGltfMaterials(
  assetUrl: string
): Array<{ name: string; alphaMode: string }> {
  return (readGltfJson(assetUrl).materials ?? []).map((material) => ({
    name: material.name ?? "",
    alphaMode: material.alphaMode ?? "OPAQUE",
  }));
}

describe("Flow Fest forest foliage material classification", () => {
  it("classifies every shipped alpha-cutout canopy material as foliage", () => {
    const inspected: string[] = [];
    for (const assetUrl of Object.values(FLOW_FEST_FOREST_TREE_ASSETS)) {
      for (const material of readGltfMaterials(assetUrl)) {
        const foliage = material.alphaMode === "MASK";
        // three.js maps glTF alphaMode MASK onto a positive alphaTest.
        const classified = isFlowFestForestFoliageMaterial({
          name: material.name,
          alphaTest: foliage ? 0.35 : 0,
        });
        expect(
          classified,
          `${assetUrl} :: ${material.name} (${material.alphaMode})`
        ).toBe(foliage);
        inspected.push(material.name);
      }
    }
    expect(inspected.length).toBeGreaterThan(20);
    // The regression this locks: "<family>_leaves" does not contain "leaf".
    expect(inspected).toContain("island_tree_01_leaves");
    expect(
      isFlowFestForestFoliageMaterial({ name: "island_tree_01_leaves" })
    ).toBe(true);
    expect(
      isFlowFestForestFoliageMaterial({ name: "island_tree_01_branches" })
    ).toBe(false);
    expect(isFlowFestForestFoliageMaterial({ name: "tree_small_02_trunk" })).toBe(
      false
    );
  });

  it("keeps ground-life species on the foliage side of the grade", () => {
    expect(
      isFlowFestForestFoliageMaterial({ name: "damp_sedge_tussock_blades" })
    ).toBe(true);
    expect(
      isFlowFestForestFoliageMaterial({ name: "woodland_hazel_shrub_card" })
    ).toBe(true);
  });
});

describe("Flow Fest forest ecology asset reporting", () => {
  const entry = (
    key: string,
    state: "pending" | "ready" | "failed",
    message?: string
  ) => ({ key, url: `/models/${key}.glb`, state, message });

  it("reports ready only when every asset resolved", () => {
    expect(
      summarizeFlowFestForestEcologyAssets([
        entry("a", "ready"),
        entry("b", "ready"),
      ])
    ).toMatchObject({ status: "ready", ready: 2, expected: 2, pending: [] });
  });

  it("distinguishes a still-loading forest from a failed one", () => {
    expect(
      summarizeFlowFestForestEcologyAssets([
        entry("a", "ready"),
        entry("b", "pending"),
      ])
    ).toMatchObject({ status: "loading", pending: ["b"], failed: [] });

    const failed = summarizeFlowFestForestEcologyAssets([
      entry("a", "ready"),
      entry("b", "pending"),
      entry("c", "failed", "404"),
    ]);
    expect(failed.status).toBe("failed");
    expect(failed.failed).toEqual([
      { key: "c", url: "/models/c.glb", message: "404" },
    ]);
  });

  it("never reports an empty forest as ready", () => {
    const report = summarizeFlowFestForestEcologyAssets([
      entry("a", "failed"),
      entry("b", "failed"),
    ]);
    expect(report.status).toBe("failed");
    expect(report.ready).toBe(0);
    expect(report.failed.every((item) => item.message.length > 0)).toBe(true);
  });
});

describe("Flow Fest distance-tier borrow contract", () => {
  /**
   * The distance tiers render with the near tier's own textured materials,
   * borrowed by NAME at runtime. That only works while three things hold for
   * every family and tier: the tier ships no images of its own, its foliage
   * primitives keep their UVs, and its material names match names in the near
   * asset. This is the contract that ended the "different tree up close"
   * identity swap — a violation regresses straight back to it.
   */
  it("ships no textures of its own in any tier", () => {
    for (const tier of ["mid", "far"] as const) {
      for (const assetUrl of Object.values(
        FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS[tier]
      )) {
        const gltf = readGltfJson(assetUrl);
        expect(gltf.images ?? [], `${assetUrl} images`).toHaveLength(0);
        expect(gltf.textures ?? [], `${assetUrl} textures`).toHaveLength(0);
      }
    }
  });

  it("keeps UVs on every primitive so the borrowed atlas can sample", () => {
    for (const tier of ["mid", "far"] as const) {
      for (const assetUrl of Object.values(
        FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS[tier]
      )) {
        const gltf = readGltfJson(assetUrl);
        const primitives = (gltf.meshes ?? []).flatMap(
          (mesh) => mesh.primitives
        );
        expect(primitives.length, assetUrl).toBeGreaterThan(0);
        for (const primitive of primitives) {
          expect(
            primitive.attributes.TEXCOORD_0,
            `${assetUrl} UVs`
          ).toBeDefined();
        }
      }
    }
  });

  it("names every tier material after a near-tier material of its family", () => {
    for (const [familyId, nearUrl] of Object.entries(
      FLOW_FEST_FOREST_TREE_ASSETS
    )) {
      const nearNames = new Set(
        readGltfMaterials(nearUrl).map((material) => material.name)
      );
      for (const tier of ["mid", "far"] as const) {
        const tierUrl =
          FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS[tier][
            familyId as FlowFestForestTreeFamilyId
          ];
        for (const material of readGltfMaterials(tierUrl)) {
          expect(
            nearNames.has(material.name),
            `${tierUrl} :: ${material.name}`
          ).toBe(true);
        }
      }
    }
  });

  it("keeps the near tier textured and alpha-cut", () => {
    const gltf = readGltfJson(FLOW_FEST_FOREST_TREE_ASSETS["island-tree-01"]);
    expect((gltf.images ?? []).length).toBeGreaterThan(0);
    const canopy = (gltf.meshes ?? [])
      .flatMap((mesh) => mesh.primitives)
      .filter((primitive) =>
        (gltf.materials?.[primitive.material]?.name ?? "").includes("leaves")
      );
    expect(canopy.length).toBeGreaterThan(0);
    for (const primitive of canopy) {
      expect(primitive.attributes.TEXCOORD_0).toBeDefined();
    }
  });
});

describe("Flow Fest per-tree instance tints", () => {
  it("is deterministic per placement and part", () => {
    const placement = { x: 128.375, z: -42.5 };
    expect(deriveFlowFestTreeInstanceTint(placement, "foliage")).toEqual(
      deriveFlowFestTreeInstanceTint(placement, "foliage")
    );
    expect(deriveFlowFestTreeInstanceTint(placement, "bark")).toEqual(
      deriveFlowFestTreeInstanceTint(placement, "bark")
    );
  });

  it("varies between trees so a family cannot render as one flat mass", () => {
    const tints = [
      deriveFlowFestTreeInstanceTint({ x: 10, z: 20 }, "foliage"),
      deriveFlowFestTreeInstanceTint({ x: 11, z: 20 }, "foliage"),
      deriveFlowFestTreeInstanceTint({ x: 10, z: 21 }, "foliage"),
      deriveFlowFestTreeInstanceTint({ x: -55.25, z: 140 }, "foliage"),
    ];
    const distinct = new Set(tints.map((tint) => JSON.stringify(tint)));
    expect(distinct.size).toBe(tints.length);
  });

  it("keeps the jitter inside a multiplicative band the grade can own", () => {
    for (let index = 0; index < 200; index += 1) {
      const placement = { x: index * 3.7 - 300, z: index * 5.1 - 500 };
      const foliage = deriveFlowFestTreeInstanceTint(placement, "foliage");
      for (const channel of [foliage.r, foliage.g, foliage.b]) {
        expect(channel).toBeGreaterThan(0.6);
        expect(channel).toBeLessThan(1.3);
      }
      const bark = deriveFlowFestTreeInstanceTint(placement, "bark");
      // Bark jitters value only, so it never shifts the wood's hue.
      expect(bark.r).toBe(bark.g);
      expect(bark.g).toBe(bark.b);
      expect(bark.r).toBeGreaterThan(0.8);
      expect(bark.r).toBeLessThan(1.15);
    }
  });
});
