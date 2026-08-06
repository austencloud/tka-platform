import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";

import {
  createAutumnInstanceBatches,
  disposeAutumnInstanceBatches,
} from "$lib/shared/3d/environments/scenes/autumn/authored/autumn-instancing";
import {
  createAutumnPlacementLayout,
  ringPlacements,
} from "$lib/shared/3d/environments/scenes/autumn/authored/placements";
import { getAutumnQualityConfig } from "$lib/shared/3d/environments/scenes/autumn/quality/autumn-quality";
import { AUTUMN_POND_LAYOUT } from "$lib/shared/3d/environments/scenes/autumn/runtime/water/autumn-pond-layout";
import {
  allocateAutumnCanopyLeaves,
  allocateAutumnFireflies,
  AUTUMN_FIREFLY_CLUSTERS,
  AUTUMN_LEAF_EMITTERS,
} from "$lib/shared/3d/environments/scenes/autumn/runtime/atmosphere/autumn-ground-life-layout";
import { isAutumnGrassTierVisible } from "$lib/shared/3d/environments/scenes/autumn/runtime/wind/autumn-grass-tier";

describe("Autumn scene layout", () => {
  it("keeps placements deterministic and protects an expanded performer clearing", () => {
    const input = {
      treeCount: 36,
      mushroomCount: 18,
      stageWidth: 10,
      stageDepth: 8,
      stageZOffset: -1,
    };
    const layout = createAutumnPlacementLayout(input);

    expect(layout).toEqual(createAutumnPlacementLayout(input));
    expect(layout.trees).toHaveLength(36);
    expect(layout.mushrooms).toHaveLength(18);

    const nearestTree = Math.min(
      ...layout.trees.map((placement) =>
        Math.hypot(placement.x, placement.z - input.stageZOffset)
      )
    );
    expect(nearestTree).toBeGreaterThanOrEqual(
      layout.forestEdgeRadius - 1.25 - 1e-6
    );
  });

  it("supports centered placement offsets without changing ring distance", () => {
    const placements = ringPlacements({
      count: 12,
      radius: 10,
      radiusJitter: 1,
      scaleBase: 1,
      scaleVariation: 0.3,
      seed: 4,
      centerX: 3,
      centerZ: -2,
      angleJitter: 0.35,
    });

    for (const placement of placements) {
      const radius = Math.hypot(placement.x - 3, placement.z + 2);
      expect(radius).toBeGreaterThanOrEqual(9 - 1e-6);
      expect(radius).toBeLessThanOrEqual(11 + 1e-6);
    }
  });

  it("keeps every GLB source mesh while batching repeated placements", () => {
    const source = new Group();
    const sourceMaterial = new MeshStandardMaterial({ color: "#d98324" });
    const lower = new Mesh(new BoxGeometry(1, 1, 1), sourceMaterial);
    const upper = new Mesh(new BoxGeometry(1, 1, 1), sourceMaterial);
    upper.position.y = 1;
    source.add(lower, upper);

    const batches = createAutumnInstanceBatches(source, [
      { x: 2, z: 3, scale: 1, rotationY: 0 },
      { x: -4, z: 5, scale: 2, rotationY: Math.PI / 2 },
    ]);

    expect(batches).toHaveLength(2);
    expect(batches[0]!.count).toBe(2);
    expect(batches[0]!.material).not.toBe(sourceMaterial);

    const matrix = new Matrix4();
    const position = new Vector3();
    batches[0]!.getMatrixAt(1, matrix);
    position.setFromMatrixPosition(matrix);
    expect(position.toArray()).toEqual([-4, 0, 5]);

    disposeAutumnInstanceBatches(batches);
    lower.geometry.dispose();
    upper.geometry.dispose();
    sourceMaterial.dispose();
  });

  it("keeps the duplicate pond and god-ray overdraw disabled", () => {
    const high = getAutumnQualityConfig("high");
    const medium = getAutumnQualityConfig("medium");

    expect(high.pondReflector).toBe(false);
    expect(high.godRays).toBe(false);
    expect(medium.pondReflector).toBe(false);
    expect(medium.godRays).toBe(false);
    expect(medium.fillTreeCount).toBeLessThan(high.fillTreeCount);
  });

  it("keeps the authored pond outside the protected performance clearing", () => {
    const centerDistance = Math.hypot(
      AUTUMN_POND_LAYOUT.centerX,
      AUTUMN_POND_LAYOUT.centerZ
    );
    const nearestPossibleBank =
      centerDistance -
      Math.max(AUTUMN_POND_LAYOUT.radiusX, AUTUMN_POND_LAYOUT.radiusZ);

    expect(nearestPossibleBank).toBeGreaterThan(6.5);
    expect(AUTUMN_POND_LAYOUT.waterLevelOffset).toBeLessThan(0);
  });

  it("reveals the Blender-authored grass tiers cumulatively", () => {
    expect(isAutumnGrassTierVisible("Autumn_Grass_Base", "low")).toBe(true);
    expect(isAutumnGrassTierVisible("Autumn_Grass_Medium", "low")).toBe(false);
    expect(isAutumnGrassTierVisible("Autumn_Grass_Medium", "medium")).toBe(
      true
    );
    expect(isAutumnGrassTierVisible("Autumn_Grass_High", "high")).toBe(true);
    expect(isAutumnGrassTierVisible("Autumn_Terrain", "high")).toBe(false);
  });

  it("keeps fireflies localized around authored ecology outside the stage", () => {
    const counts = allocateAutumnFireflies(36);
    expect(counts).toHaveLength(AUTUMN_FIREFLY_CLUSTERS.length);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(36);
    expect(counts.every((count) => count > 0)).toBe(true);

    for (const cluster of AUTUMN_FIREFLY_CLUSTERS) {
      expect(Math.hypot(...cluster.position)).toBeGreaterThan(6.5);
    }
  });

  it("emits every falling leaf beneath an authored tree canopy", () => {
    const counts = allocateAutumnCanopyLeaves(140);
    expect(counts).toHaveLength(AUTUMN_LEAF_EMITTERS.length);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(140);
    expect(counts.every((count) => count > 0)).toBe(true);

    for (const emitter of AUTUMN_LEAF_EMITTERS) {
      expect(Math.hypot(...emitter.position)).toBeGreaterThan(11);
      expect(emitter.area.width).toBeLessThanOrEqual(8.5);
      expect(emitter.area.depth).toBeLessThanOrEqual(7);
    }
  });
});
