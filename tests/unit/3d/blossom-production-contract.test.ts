import { describe, expect, it } from "vitest";

import {
  getBlossomActiveProductionPhase,
  getBlossomCameraContract,
  getBlossomCirculationPaths,
  getBlossomTerrainBounds,
} from "$lib/shared/3d/environments/scenes/cherry-blossom/blossom-site";
import {
  getBlossomPerformanceEnvelope,
  getBlossomStageOperations,
  getBlossomStageProtectedClearance,
} from "$lib/shared/3d/environments/scenes/cherry-blossom/blossom-stage-operations";
import {
  getBlossomRiverBounds,
  getBlossomRiverOutline,
  getBlossomRiverSurfaceElevation,
} from "$lib/shared/3d/environments/scenes/cherry-blossom/blossom-water";

describe("Blossom R2.1 production contract", () => {
  it("ships only the approved site-systems phase", () => {
    expect(getBlossomActiveProductionPhase()).toBe(2);
  });

  it("keeps the validated camera envelope inside the authored terrain", () => {
    const terrain = getBlossomTerrainBounds();
    const camera = getBlossomCameraContract();

    expect(camera.controls.maximumDistance).toBe(82);
    expect(terrain.minX).toBeLessThanOrEqual(-128);
    expect(terrain.maxX).toBeGreaterThanOrEqual(128);
    expect(terrain.minY).toBeLessThanOrEqual(-122);
    expect(terrain.maxY).toBeGreaterThanOrEqual(142);
  });

  it("authors every public and service route from connected 3D centerlines", () => {
    const paths = getBlossomCirculationPaths();

    expect(paths).toHaveLength(14);
    expect(
      paths.filter((path) => path.kind === "primary-accessible")
    ).toHaveLength(12);
    expect(
      paths.filter((path) => path.kind === "restricted-service")
    ).toHaveLength(2);
    for (const path of paths) {
      expect(path.centerline.length).toBeGreaterThanOrEqual(2);
      expect(path.width).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps the widened water body broad enough to read as a river", () => {
    const outline = getBlossomRiverOutline();
    const bounds = getBlossomRiverBounds();

    expect(outline).toHaveLength(20);
    expect(bounds.width).toBeGreaterThan(84);
    expect(bounds.depth).toBeGreaterThan(8);
    expect(getBlossomRiverSurfaceElevation()).toBe(-0.15);
  });

  it("keeps stage operations outside the performance envelope", () => {
    const performance = getBlossomPerformanceEnvelope();
    const clearance = getBlossomStageProtectedClearance();
    const operations = getBlossomStageOperations();

    expect(clearance.minX).toBeLessThan(performance.minX);
    expect(clearance.maxX).toBeGreaterThan(performance.maxX);
    expect(clearance.minY).toBeLessThan(performance.minY);
    expect(clearance.maxY).toBeGreaterThan(performance.maxY);
    expect(operations.backstageStagingArea.minX).toBeGreaterThan(
      clearance.maxX
    );
    expect(operations.propStorageArea.minX).toBeGreaterThan(clearance.maxX);
  });
});
