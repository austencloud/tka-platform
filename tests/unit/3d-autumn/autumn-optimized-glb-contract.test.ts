import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { AUTUMN_DEPTH_MATERIAL_GRADES } from "../../../scripts/autumn-depth-material-grades.mjs";
import { AUTUMN_HERO_MATERIAL_GRADES } from "../../../scripts/autumn-hero-material-grades.mjs";
import { getAutumnDepthCohesionProfile } from "$lib/shared/3d/environments/scenes/autumn/runtime/atmosphere/autumn-depth-cohesion";
import { AUTUMN_INSTANCE_BUDGETS } from "$lib/shared/3d/environments/scenes/autumn/quality/autumn-geometry-tier";
import { resolveAutumnShadowRole } from "$lib/shared/3d/environments/scenes/autumn/runtime/lighting/autumn-shadow-roles";

interface OptimizedAutumnGltf {
  materials?: Array<{
    name?: string;
    alphaMode?: string;
    alphaCutoff?: number;
  }>;
  accessors?: Array<{ count?: number }>;
  meshes?: Array<{
    name?: string;
    primitives?: Array<{ indices?: number; material?: number }>;
  }>;
  nodes?: Array<{
    name?: string;
    mesh?: number;
    extensions?: {
      EXT_mesh_gpu_instancing?: {
        attributes?: Record<string, number>;
      };
    };
  }>;
}

function readOptimizedAutumnGltf(): OptimizedAutumnGltf {
  const buffer = readFileSync(
    resolve("static/models/autumn/autumn-environment.glb")
  );
  expect(buffer.readUInt32LE(0)).toBe(0x46546c67);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(
    buffer.subarray(20, 20 + jsonLength).toString("utf8")
  ) as OptimizedAutumnGltf;
}

describe("optimized Autumn GLB contracts", () => {
  const gltf = readOptimizedAutumnGltf();
  const materialNames = (gltf.materials ?? []).map(
    (material) => material.name ?? ""
  );
  const meshNodeNames = (gltf.nodes ?? [])
    .filter((node) => Number.isInteger(node.mesh))
    .map((node) => node.name ?? "");

  function nodeMaterialNames(node: NonNullable<typeof gltf.nodes>[number]) {
    if (!Number.isInteger(node.mesh)) return [];
    const mesh = gltf.meshes?.[node.mesh!];
    return (mesh?.primitives ?? []).map(
      (primitive) => gltf.materials?.[primitive.material ?? -1]?.name ?? ""
    );
  }

  function meshTriangleCount(meshIndex: number): number {
    return (gltf.meshes?.[meshIndex]?.primitives ?? []).reduce(
      (sum, primitive) =>
        sum + (gltf.accessors?.[primitive.indices ?? -1]?.count ?? 0) / 3,
      0
    );
  }

  function projectedTriangleCount(tier: "high" | "medium" | "low"): number {
    return (gltf.nodes ?? []).reduce((sum, node) => {
      if (!Number.isInteger(node.mesh)) return sum;
      const triangles = meshTriangleCount(node.mesh!);
      const translationAccessor =
        node.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION;
      if (translationAccessor === undefined) return sum + triangles;

      const fullCount = gltf.accessors?.[translationAccessor]?.count ?? 0;
      if (tier === "high") return sum + triangles * fullCount;
      const names = nodeMaterialNames(node);
      const budget = AUTUMN_INSTANCE_BUDGETS.find((candidate) =>
        names.some((name) => name.startsWith(candidate.materialPrefix))
      );
      return sum + triangles * Math.min(fullCount, budget?.[tier] ?? fullCount);
    }, 0);
  }

  it("keeps optimizer and runtime depth-family prefixes joined to the GLB", () => {
    for (const profile of Object.values(AUTUMN_DEPTH_MATERIAL_GRADES)) {
      expect(
        materialNames.some((name) => name.startsWith(profile.prefix)),
        `${profile.prefix} disappeared from the optimized GLB`
      ).toBe(true);
      expect(
        getAutumnDepthCohesionProfile(profile.prefix),
        `${profile.prefix} lost its runtime depth grade`
      ).not.toBeNull();
    }

    for (const profile of Object.values(AUTUMN_HERO_MATERIAL_GRADES)) {
      expect(
        materialNames.some((name) => name.startsWith(profile.prefix)),
        `${profile.prefix} disappeared from the optimized GLB`
      ).toBe(true);
    }

    expect(
      getAutumnDepthCohesionProfile(AUTUMN_HERO_MATERIAL_GRADES.heroA.prefix)
    ).toBeNull();
    expect(
      getAutumnDepthCohesionProfile(AUTUMN_HERO_MATERIAL_GRADES.heroB.prefix)
    ).toBeNull();
  });

  it("keeps every surviving shadow caster inside an authored prefix", () => {
    const casterNodes = (gltf.nodes ?? []).filter(
      (node) =>
        Number.isInteger(node.mesh) &&
        resolveAutumnShadowRole(node.name ?? "", nodeMaterialNames(node)).cast
    );
    const expectedCasterCounts = new Map([
      ["FallenLog", 3],
      ["Shore_Boulder", 2],
      ["Autumn_Owl", 2],
    ]);

    expect(casterNodes).toHaveLength(7);
    for (const [prefix, count] of expectedCasterCounts) {
      expect(
        casterNodes.filter((node) => node.name?.startsWith(prefix))
      ).toHaveLength(count);
    }
  });

  it("keeps both hero-tree families receive-only", () => {
    const heroANodes = (gltf.nodes ?? []).filter((node) =>
      node.name?.startsWith("HeroTreeA_")
    );
    expect(heroANodes).toHaveLength(4);
    expect(
      heroANodes.every(
        (node) =>
          resolveAutumnShadowRole(node.name ?? "", nodeMaterialNames(node)).cast
      )
    ).toBe(false);

    const heroBNodes = (gltf.nodes ?? []).filter((node) =>
      nodeMaterialNames(node).some((name) =>
        name.startsWith("Autumn Hero B PBR")
      )
    );
    expect(heroBNodes).toHaveLength(1);
    const heroBNode = heroBNodes[0];
    expect(
      resolveAutumnShadowRole(
        heroBNode.name ?? "",
        nodeMaterialNames(heroBNode)
      ).cast
    ).toBe(false);

    const translationAccessor =
      heroBNode.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION;
    const heroBInstanceCount =
      gltf.accessors?.[translationAccessor ?? -1]?.count ?? 0;
    expect(heroBInstanceCount).toBe(7);

    const heroATriangles = heroANodes.reduce(
      (sum, node) => sum + meshTriangleCount(node.mesh!),
      0
    );
    const heroBTriangles =
      meshTriangleCount(heroBNode.mesh!) * heroBInstanceCount;
    expect(heroATriangles).toBeGreaterThan(170_000);
    expect(heroATriangles).toBeLessThan(175_000);
    expect(heroBTriangles).toBeGreaterThan(220_000);
  });

  it("delivers real geometry reductions at medium and low quality", () => {
    const high = projectedTriangleCount("high");
    const medium = projectedTriangleCount("medium");
    const low = projectedTriangleCount("low");

    expect(high).toBeGreaterThan(1_900_000);
    expect(medium).toBeLessThanOrEqual(1_550_000);
    expect(low).toBeLessThanOrEqual(1_100_000);
    expect(medium / high).toBeLessThan(0.8);
    expect(low / high).toBeLessThan(0.56);
  });

  it("contains no authored shadow impostors", () => {
    expect(
      meshNodeNames.some((name) => name.startsWith("Autumn_ShadowProxy_"))
    ).toBe(false);
    expect(materialNames.some((name) => name.startsWith("Autumn Shadow"))).toBe(
      false
    );
  });

  it("keeps optimizer-surviving grass outside both shadow roles", () => {
    const excludedNames = meshNodeNames.filter((name) => {
      const role = resolveAutumnShadowRole(name);
      return !role.cast && !role.receive;
    });

    expect(excludedNames).toEqual([
      "Autumn_Grass_Base",
      "Autumn_Grass_Medium",
      "Autumn_Grass_High",
    ]);
  });

  it("omits the rejected back-left Hero B specimen", () => {
    expect(
      (gltf.nodes ?? []).some((node) => node.name?.includes("HeroTreeB_03"))
    ).toBe(false);
  });
});
