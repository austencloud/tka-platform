import { describe, expect, it } from "vitest";
import { Mesh } from "three";
import type { ImportedTerrainDataV2 } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";
import {
  buildFlowFestTerrainHost,
  sampleFlowFestTerrainWorldY,
} from "../../src/routes/test/flow-fest-graybox/flow-fest-terrain-host";

function makeTerrain(width: number, height: number): ImportedTerrainDataV2 {
  const heights = new Float32Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      heights[row * width + column] = 270 + column * 0.5 + row * 0.25;
    }
  }
  return {
    version: 2,
    name: "Flow Fest test terrain",
    sourceManifestPath: "/data/flow-fest-sim/terrain.manifest.json",
    worldBounds: {
      minX: 0,
      maxX: width - 1,
      minZ: 0,
      maxZ: height - 1,
    },
    heightmap: {
      width,
      height,
      minElevation: 270,
      maxElevation: 270 + (width - 1) * 0.5 + (height - 1) * 0.25,
      verticalOriginMeters: 270,
      verticalScale: 1,
      heights,
    },
    boundary: [
      { worldX: 0, worldZ: 0 },
      { worldX: width - 1, worldZ: 0 },
      { worldX: width - 1, worldZ: height - 1 },
      { worldX: 0, worldZ: height - 1 },
    ],
    geoReference: {
      projectedCrs: {
        authority: "EPSG",
        code: 26916,
        name: "NAD83 / UTM zone 16N",
      },
      requestedAnchorWgs84: { latitude: 39.589617, longitude: -84.785764 },
      resolvedOriginWgs84: { latitude: 39.589617, longitude: -84.785764 },
      originProjectedMeters: { easting: 690142, northing: 4384552 },
      axes: { x: "east", y: "up", z: "south" },
      verticalDatum: "NAVD88",
    },
  };
}

describe("Flow Fest Gate 2 terrain hosts", () => {
  it("uses the visible bounded geometry arrays as the collider arrays", () => {
    const terrain = makeTerrain(33, 33);
    const host = buildFlowFestTerrainHost(terrain, "bounded-static", null);
    const mesh = host.root.children[0] as Mesh;
    const positions = mesh.geometry.getAttribute("position").array;
    const indices = mesh.geometry.getIndex()?.array;

    expect(host.colliders).toHaveLength(1);
    expect(host.colliders[0]?.vertices).toBe(positions);
    expect(host.colliders[0]?.indices).toBe(indices);
    expect(host.metrics.vertices).toBe(33 * 33);
    expect(host.metrics.triangles).toBe(32 * 32 * 2);
    host.dispose();
  });

  it("keeps chunk seams byte-identical to the bounded source grid", () => {
    const terrain = makeTerrain(65, 33);
    const host = buildFlowFestTerrainHost(terrain, "chunked", null);

    expect(host.metrics.renderMeshes).toBe(2);
    const west = host.colliders[0]?.vertices;
    const east = host.colliders[1]?.vertices;
    expect(west).toBeDefined();
    expect(east).toBeDefined();
    for (let row = 0; row < 33; row += 1) {
      const westOffset = (row * 33 + 32) * 3;
      const eastOffset = row * 33 * 3;
      expect(Array.from(west!.slice(westOffset, westOffset + 3))).toEqual(
        Array.from(east!.slice(eastOffset, eastOffset + 3)),
      );
    }
    host.dispose();
  });

  it("samples the meter grid in the declared +X east, +Z south frame", () => {
    const terrain = makeTerrain(33, 33);
    expect(sampleFlowFestTerrainWorldY(terrain, 4, 8)).toBeCloseTo(4, 6);
    expect(sampleFlowFestTerrainWorldY(terrain, 4.5, 8.5)).toBeCloseTo(4.375, 6);
  });
});

