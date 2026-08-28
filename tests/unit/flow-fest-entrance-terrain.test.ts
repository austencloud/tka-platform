import { describe, expect, it } from "vitest";
import type { ImportedTerrainDataV2 } from "../../src/lib/shared/3d/procedural-engine/generation/real-terrain-zone";
import { sampleFlowFestTerrainWorldY } from "../../src/routes/test/flow-fest-graybox/flow-fest-terrain-host";
import { flowFestEntranceLocalToWorld } from "../../src/routes/test/flow-fest-sim/flow-fest-entrance-reference";
import { buildFlowFestEntranceGradedTerrain } from "../../src/routes/test/flow-fest-sim/flow-fest-entrance-terrain";

function syntheticTerrain(): ImportedTerrainDataV2 {
  const width = 81;
  const height = 81;
  const minX = 280;
  const maxX = 360;
  const minZ = -150;
  const maxZ = -70;
  const heights = new Float32Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const z = minZ + ((maxZ - minZ) * row) / (height - 1);
    for (let column = 0; column < width; column += 1) {
      const x = minX + ((maxX - minX) * column) / (width - 1);
      const bump = Math.exp(-((x - 312) ** 2 + (z + 114) ** 2) / 18) * 1.1;
      heights[row * width + column] = 276 + (x - 320) * 0.002 + bump;
    }
  }
  return {
    version: 2,
    name: "entrance-grade-fixture",
    sourceManifestPath: "fixture",
    worldBounds: { minX, maxX, minZ, maxZ },
    heightmap: {
      width,
      height,
      minElevation: 275,
      maxElevation: 278,
      verticalOriginMeters: 270,
      verticalScale: 1,
      heights,
    },
    boundary: [],
    geoReference: {
      projectedCrs: {
        authority: "EPSG",
        code: 26916,
        name: "NAD83 / UTM zone 16N",
      },
      requestedAnchorWgs84: { latitude: 0, longitude: 0 },
      resolvedOriginWgs84: { latitude: 0, longitude: 0 },
      originProjectedMeters: { easting: 690142, northing: 4384552 },
      axes: { x: "east", y: "up", z: "south" },
      verticalDatum: "NAVD88",
    },
  };
}

describe("Flow Fest entrance terrain grading", () => {
  it("removes local apron undulation without mutating or flattening the wider terrain", () => {
    const source = syntheticTerrain();
    const original = source.heightmap.heights.slice();
    const { terrain, audit } = buildFlowFestEntranceGradedTerrain(source);
    const apron = flowFestEntranceLocalToWorld({ right: 0, depth: 22 });
    const outside = { x: 350, z: -75 };

    expect(source.heightmap.heights).toEqual(original);
    expect(terrain.heightmap.heights).not.toBe(source.heightmap.heights);
    expect(audit.adjustedSamples).toBeGreaterThan(0);
    expect(audit.maximumAdjustmentMeters).toBeGreaterThan(0.25);
    expect(sampleFlowFestTerrainWorldY(terrain, apron.x, apron.z)).toBeLessThan(
      sampleFlowFestTerrainWorldY(source, apron.x, apron.z)
    );
    expect(sampleFlowFestTerrainWorldY(terrain, outside.x, outside.z)).toBe(
      sampleFlowFestTerrainWorldY(source, outside.x, outside.z)
    );
  });
});
