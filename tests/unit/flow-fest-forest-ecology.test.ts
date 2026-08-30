import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ImportedTerrainDataV2 } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";
import { parseFlowFestRuntimeContract } from "../../src/routes/test/flow-fest-graybox/flow-fest-runtime-contract";
import {
  buildFlowFestCanopyShellGeometry,
  deriveFlowFestForestEcology,
  deriveFlowFestTreeInstanceTint,
  FLOW_FEST_CANOPY_SHELL_ATLAS_COMPENSATION,
  FLOW_FEST_CANOPY_SHELL_SHADE_CEILING,
  FLOW_FEST_CANOPY_SHELL_SHADE_FLOOR,
  FLOW_FEST_CANOPY_SHELL_TIERS,
  FLOW_FEST_FOREST_DISTANCE_GRASS_ASSETS,
  FLOW_FEST_FOREST_GRASS_ASSET,
  FLOW_FEST_FOREST_GROUND_LIFE_ASSETS,
  FLOW_FEST_FOREST_DISTANCE_FALLBACK_FAMILY,
  FLOW_FEST_FOREST_DISTANCE_LOD,
  FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS,
  FLOW_FEST_PLANTFACTORY_ACCENT_COUNT,
  FLOW_FEST_PLANTFACTORY_TREE_FAMILIES,
  FLOW_FEST_FOREST_TREE_ASSETS,
  flattenFlowFestDistanceTierMaterial,
  isFlowFestForestFoliageMaterial,
  summarizeFlowFestForestEcologyAssets,
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

  it("maps every measured tree into deterministic non-overlapping distance tiers", () => {
    const nearFamilyIds = Object.keys(FLOW_FEST_FOREST_TREE_ASSETS);
    const midFamilyIds = Object.keys(FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.mid);
    const farFamilyIds = Object.keys(FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.far);

    expect(Object.keys(FLOW_FEST_FOREST_DISTANCE_FALLBACK_FAMILY)).toEqual(
      nearFamilyIds
    );
    expect(midFamilyIds).toEqual(farFamilyIds);
    expect(
      Object.values(FLOW_FEST_FOREST_DISTANCE_FALLBACK_FAMILY).every(
        (familyId) => midFamilyIds.includes(familyId)
      )
    ).toBe(true);
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

  it("ships reproducible geometry-only tiers with a meaningful triangle reduction", () => {
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
      assets: Array<{
        tier: "mid" | "far";
        sourceTriangles: number;
        outputTriangles: number;
        outputSha256: string;
      }>;
    };

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.assets).toHaveLength(8);
    expect(
      manifest.assets.filter((asset) => asset.tier === "mid")
    ).toHaveLength(4);
    expect(
      manifest.assets.filter((asset) => asset.tier === "far")
    ).toHaveLength(4);
    for (const asset of manifest.assets) {
      const maximumRatio = asset.tier === "mid" ? 0.22 : 0.12;
      expect(asset.outputTriangles / asset.sourceTriangles).toBeLessThanOrEqual(
        maximumRatio
      );
      expect(asset.outputSha256).toMatch(/^[a-f0-9]{64}$/);
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

describe("Flow Fest distance-tier materials", () => {
  it("drops the cutout and the atlas so untextured canopies still render", () => {
    const leaves = {
      name: "island_tree_01_leaves",
      alphaTest: 0.35,
      transparent: false,
      depthWrite: false,
      map: { isTexture: true },
      alphaMap: null,
      roughness: 0.5,
      needsUpdate: false,
    };
    expect(flattenFlowFestDistanceTierMaterial(leaves)).toBe(true);
    expect(leaves.alphaTest).toBe(0);
    expect(leaves.map).toBeNull();
    expect(leaves.transparent).toBe(false);
    expect(leaves.depthWrite).toBe(true);
    expect(leaves.needsUpdate).toBe(true);
  });

  it("strips wood maps too, because they sample the same missing UVs", () => {
    const wood = {
      name: "island_tree_01_branches",
      alphaTest: 0,
      map: { isTexture: true },
      roughness: 0.4,
      needsUpdate: false,
    };
    expect(flattenFlowFestDistanceTierMaterial(wood)).toBe(true);
    expect(wood.map).toBeNull();
    expect(wood.roughness).toBe(1);
    expect(wood.needsUpdate).toBe(true);
  });

  it("proves the distance tiers ship no UVs and no textures", () => {
    for (const tier of ["mid", "far"] as const) {
      for (const assetUrl of Object.values(
        FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS[tier]
      )) {
        const gltf = readGltfJson(assetUrl);
        expect(gltf.images ?? [], `${assetUrl} images`).toHaveLength(0);
        expect(gltf.textures ?? [], `${assetUrl} textures`).toHaveLength(0);
        const canopy = (gltf.meshes ?? [])
          .flatMap((mesh) => mesh.primitives)
          .filter((primitive) =>
            (gltf.materials?.[primitive.material]?.name ?? "").includes("leaves")
          );
        expect(canopy.length, `${assetUrl} canopy primitives`).toBeGreaterThan(0);
        for (const primitive of canopy) {
          // No UVs is exactly why the borrowed cutout material erased the
          // canopy: every fragment sampled the atlas at texel (0, 0).
          expect(
            primitive.attributes.TEXCOORD_0,
            `${assetUrl} canopy UVs`
          ).toBeUndefined();
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

function countCanopyTriangles(assetUrl: string): number {
  const gltf = readGltfJson(assetUrl);
  return (gltf.meshes ?? [])
    .flatMap((mesh) => mesh.primitives)
    .filter((primitive) =>
      (gltf.materials?.[primitive.material]?.name ?? "").includes("leaves")
    )
    .reduce((total, primitive) => {
      const indices =
        primitive.indices == null
          ? undefined
          : gltf.accessors?.[primitive.indices]?.count;
      const positions =
        primitive.attributes.POSITION == null
          ? undefined
          : gltf.accessors?.[primitive.attributes.POSITION]?.count;
      return total + (indices ?? positions ?? 0) / 3;
    }, 0);
}

describe("Flow Fest distance canopy shells", () => {
  it("documents why the shipped distance canopies cannot simply be graded", () => {
    // A leaf atlas is thousands of disconnected two-triangle cards. Mesh
    // simplification deletes cards wholesale rather than reducing them, so the
    // shipped mid tier keeps a fraction of the near tier's canopy and none of
    // its coverage. Grading that material paints specks, not a tree.
    const near = countCanopyTriangles(
      FLOW_FEST_FOREST_TREE_ASSETS["island-tree-01"]
    );
    const mid = countCanopyTriangles(
      FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.mid["island-tree-01"]
    );
    const far = countCanopyTriangles(
      FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.far["island-tree-01"]
    );
    expect(near).toBeGreaterThan(0);
    expect(mid).toBeLessThan(near * 0.35);
    expect(far).toBeLessThanOrEqual(mid);
  });

  it("builds a crown that fills the canopy bounds it is given", () => {
    const bounds = {
      min: { x: -4, y: 6, z: -4 },
      max: { x: 4, y: 14, z: 4 },
    };
    const shell = buildFlowFestCanopyShellGeometry(
      bounds,
      "island-tree-01-mid-leaves",
      FLOW_FEST_CANOPY_SHELL_TIERS.mid
    );
    const box = shell.boundingBox;
    expect(box).toBeTruthy();
    if (!box) return;
    // Inside the leaf envelope, so branch tips still break the silhouette.
    expect(box.min.x).toBeGreaterThanOrEqual(bounds.min.x);
    expect(box.max.x).toBeLessThanOrEqual(bounds.max.x);
    expect(box.min.y).toBeGreaterThanOrEqual(bounds.min.y);
    expect(box.max.y).toBeLessThanOrEqual(bounds.max.y);
    expect(box.min.z).toBeGreaterThanOrEqual(bounds.min.z);
    expect(box.max.z).toBeLessThanOrEqual(bounds.max.z);
    // But still a crown, not a pebble: it has to occupy most of the envelope.
    expect(box.max.x - box.min.x).toBeGreaterThan(6);
    expect(box.max.y - box.min.y).toBeGreaterThan(6);
    expect(box.max.z - box.min.z).toBeGreaterThan(6);
    shell.dispose();
  });

  it("stays cheaper than the decimated canopy it replaces", () => {
    const bounds = { min: { x: -3, y: 4, z: -3 }, max: { x: 3, y: 10, z: 3 } };
    const budgets = { mid: 400, far: 100 } as const;
    for (const tier of ["mid", "far"] as const) {
      const shell = buildFlowFestCanopyShellGeometry(
        bounds,
        `island-tree-01-${tier}-leaves`,
        FLOW_FEST_CANOPY_SHELL_TIERS[tier]
      );
      const triangles = shell.attributes.position.count / 3;
      expect(triangles, `${tier} shell triangles`).toBeLessThanOrEqual(
        budgets[tier]
      );
      expect(
        triangles,
        `${tier} shell vs shipped canopy`
      ).toBeLessThan(
        countCanopyTriangles(FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS[tier]["island-tree-01"])
      );
      shell.dispose();
    }
  });

  it("carries no UVs so the borrowed atlas is still flattened away", () => {
    const shell = buildFlowFestCanopyShellGeometry(
      { min: { x: -2, y: 3, z: -2 }, max: { x: 2, y: 8, z: 2 } },
      "tree-small-02-far-leaves",
      FLOW_FEST_CANOPY_SHELL_TIERS.far
    );
    expect(shell.getAttribute("uv")).toBeUndefined();
    shell.dispose();
  });

  it("shades as a soft crown: unit normals pointing away from the crown", () => {
    const shell = buildFlowFestCanopyShellGeometry(
      { min: { x: -3, y: 5, z: -3 }, max: { x: 3, y: 12, z: 3 } },
      "island-tree-02-mid-leaves",
      FLOW_FEST_CANOPY_SHELL_TIERS.mid
    );
    const normals = shell.attributes.normal;
    expect(normals.count).toBe(shell.attributes.position.count);
    for (let index = 0; index < normals.count; index += 1) {
      const length = Math.hypot(
        normals.getX(index),
        normals.getY(index),
        normals.getZ(index)
      );
      expect(length).toBeCloseTo(1, 5);
    }
    shell.dispose();
  });

  it("is deterministic per family and tier, and varies between them", () => {
    const bounds = { min: { x: -3, y: 4, z: -3 }, max: { x: 3, y: 11, z: 3 } };
    const first = buildFlowFestCanopyShellGeometry(
      bounds,
      "island-tree-01-mid-leaves",
      FLOW_FEST_CANOPY_SHELL_TIERS.mid
    );
    const repeat = buildFlowFestCanopyShellGeometry(
      bounds,
      "island-tree-01-mid-leaves",
      FLOW_FEST_CANOPY_SHELL_TIERS.mid
    );
    const other = buildFlowFestCanopyShellGeometry(
      bounds,
      "island-tree-03-mid-leaves",
      FLOW_FEST_CANOPY_SHELL_TIERS.mid
    );
    expect(Array.from(first.attributes.position.array)).toEqual(
      Array.from(repeat.attributes.position.array)
    );
    expect(Array.from(first.attributes.position.array)).not.toEqual(
      Array.from(other.attributes.position.array)
    );
    first.dispose();
    repeat.dispose();
    other.dispose();
  });

  it("bakes a canopy self-shadow gradient the raw tint cannot provide", () => {
    const bounds = { min: { x: -3, y: 5, z: -3 }, max: { x: 3, y: 12, z: 3 } };
    const shell = buildFlowFestCanopyShellGeometry(
      bounds,
      "island-tree-01-mid-leaves",
      FLOW_FEST_CANOPY_SHELL_TIERS.mid
    );
    const colors = shell.getAttribute("color");
    const positions = shell.attributes.position;
    expect(colors).toBeTruthy();
    expect(colors.count).toBe(positions.count);

    let sum = 0;
    let minimum = Infinity;
    let maximum = -Infinity;
    const byPosition = new Map<string, number>();
    for (let index = 0; index < colors.count; index += 1) {
      const shade = colors.getX(index);
      // Grayscale multiplier: hue stays with the moment tint.
      expect(colors.getY(index)).toBe(shade);
      expect(colors.getZ(index)).toBe(shade);
      sum += shade;
      minimum = Math.min(minimum, shade);
      maximum = Math.max(maximum, shade);
      // Non-indexed geometry: every copy of a shared corner must shade
      // identically or facet seams appear.
      const key = [
        positions.getX(index).toFixed(5),
        positions.getY(index).toFixed(5),
        positions.getZ(index).toFixed(5),
      ].join(",");
      const previous = byPosition.get(key);
      if (previous !== undefined) expect(shade).toBeCloseTo(previous, 6);
      else byPosition.set(key, shade);
    }
    // The crown base sinks toward the floor, the top stays bright, and the
    // mean lands well under 1 so the shell compensates for the missing atlas
    // multiplication instead of rendering the raw pastel tint.
    expect(minimum).toBeGreaterThanOrEqual(
      FLOW_FEST_CANOPY_SHELL_SHADE_FLOOR * 0.9
    );
    expect(maximum).toBeLessThanOrEqual(FLOW_FEST_CANOPY_SHELL_SHADE_CEILING);
    expect(maximum).toBeGreaterThan(0.9);
    const mean = sum / colors.count;
    expect(mean).toBeGreaterThan(0.55);
    expect(mean).toBeLessThan(0.9);
    shell.dispose();
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

describe("Flow Fest canopy shell atlas compensation", () => {
  it("deepens toward green like the leaf atlas it stands in for", () => {
    const { r, g, b } = FLOW_FEST_CANOPY_SHELL_ATLAS_COMPENSATION;
    // Every channel darkens — a compensation ≥ 1 would brighten shells past
    // the near tier's atlas-multiplied canopies and re-create the pale seam.
    for (const channel of [r, g, b]) {
      expect(channel).toBeGreaterThan(0);
      expect(channel).toBeLessThan(1);
    }
    // Green survives strongest and blue weakest, so the multiply saturates
    // toward foliage green instead of graying the tint toward teal or khaki.
    expect(g).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(b);
  });
});
