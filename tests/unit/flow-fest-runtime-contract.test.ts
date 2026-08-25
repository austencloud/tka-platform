import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ImportedTerrainDataV2 } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";
import {
  parseFlowFestRuntimeContract,
  type FlowFestRuntimeContract,
} from "../../src/routes/test/flow-fest-graybox/flow-fest-runtime-contract";
import { buildFlowFestLidarBarrierGeometry } from "../../src/routes/test/flow-fest-graybox/flow-fest-review-geometry";

const contractPath = resolve(
  process.cwd(),
  "static/data/flow-fest-sim/gate2-runtime-contract.json"
);

function readContract(): FlowFestRuntimeContract {
  return parseFlowFestRuntimeContract(
    JSON.parse(readFileSync(contractPath, "utf8")) as unknown
  );
}

function readTerrain(): ImportedTerrainDataV2 {
  const manifest = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "static/data/flow-fest-sim/terrain.manifest.json"),
      "utf8"
    )
  ) as {
    terrain: {
      height: {
        width: number;
        height: number;
        minimumElevationMeters: number;
        maximumElevationMeters: number;
      };
      sampleBoundsWorldMeters: {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
      };
      coverageBoundaryWorldMeters: Array<{ x: number; z: number }>;
    };
    worldFrame: {
      vertical: { originElevationMeters: number };
      projectedCrs: { code: number; name: string };
      requestedAnchorWgs84: { latitude: number; longitude: number };
      resolvedOriginWgs84: { latitude: number; longitude: number };
      originProjectedMeters: { easting: number; northing: number };
      axes: { x: "east"; y: "up"; z: "south" };
    };
  };
  const bytes = readFileSync(
    resolve(process.cwd(), "static/data/flow-fest-sim/terrain-height.f32")
  );
  const heights = new Float32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / Float32Array.BYTES_PER_ELEMENT
  );
  return {
    version: 2,
    name: "Flow Fest Sim Earth",
    sourceManifestPath: "/data/flow-fest-sim/terrain.manifest.json",
    worldBounds: manifest.terrain.sampleBoundsWorldMeters,
    heightmap: {
      width: manifest.terrain.height.width,
      height: manifest.terrain.height.height,
      minElevation: manifest.terrain.height.minimumElevationMeters,
      maxElevation: manifest.terrain.height.maximumElevationMeters,
      verticalOriginMeters: manifest.worldFrame.vertical.originElevationMeters,
      verticalScale: 1,
      heights,
    },
    boundary: manifest.terrain.coverageBoundaryWorldMeters.map((point) => ({
      worldX: point.x,
      worldZ: point.z,
    })),
    geoReference: {
      projectedCrs: {
        authority: "EPSG",
        code: manifest.worldFrame.projectedCrs.code,
        name: manifest.worldFrame.projectedCrs.name,
      },
      requestedAnchorWgs84: manifest.worldFrame.requestedAnchorWgs84,
      resolvedOriginWgs84: manifest.worldFrame.resolvedOriginWgs84,
      originProjectedMeters: manifest.worldFrame.originProjectedMeters,
      axes: manifest.worldFrame.axes,
      verticalDatum: "NAVD88",
    },
  };
}

describe("Flow Fest Gate 2 runtime contract", () => {
  it("locks approved walking timing and leaves vehicle timing unclaimed", () => {
    const contract = readContract();
    for (const branch of Object.values(contract.routes.arrivalBranches)) {
      for (const segment of branch.segments) {
        if (segment.mode === "person") {
          expect(segment.nominalSpeedMetersPerSecond).toBe(1.2);
          expect(segment.nominalDurationSeconds).toBeCloseTo(
            segment.lengthMeters / 1.2,
            5
          );
        } else {
          expect(segment.nominalSpeedMetersPerSecond).toBeNull();
          expect(segment.nominalDurationSeconds).toBeNull();
        }
      }
    }
  });

  it("keeps both traced connectors exact and their Middle Earth entries distinct", () => {
    const contract = readContract();
    const upper = contract.connectorTraces.upperClearingToMiddleEarth.vertices;
    const lower = contract.connectorTraces.middleEarthToLowerClearing.vertices;
    expect(upper).toHaveLength(13);
    expect(lower).toHaveLength(14);
    expect([upper.at(-1)?.x, upper.at(-1)?.z]).toEqual([99.2, -113.4]);
    expect([lower[0]?.x, lower[0]?.z]).toEqual([102.5, -113.8]);
    expect(
      Math.hypot(upper.at(-1)!.x - lower[0]!.x, upper.at(-1)!.z - lower[0]!.z)
    ).toBeCloseTo(3.324154, 5);
  });

  it("derives visible collision proxies while carving every traced vertex", () => {
    const contract = readContract();
    const terrain = readTerrain();
    const bytes = readFileSync(
      resolve(process.cwd(), "static/data/flow-fest-sim/surface-offset.u16")
    );
    const surface = new Uint16Array(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength / Uint16Array.BYTES_PER_ELEMENT
    );
    const barriers = buildFlowFestLidarBarrierGeometry(
      contract,
      terrain,
      surface
    );
    const positions = barriers.vertices;
    const traces = [
      ...contract.connectorTraces.upperClearingToMiddleEarth.vertices,
      ...contract.connectorTraces.middleEarthToLowerClearing.vertices,
    ];

    expect(barriers.proxyCount).toBeGreaterThan(100);
    expect(barriers.mesh.geometry.getAttribute("position").array).toBe(
      barriers.vertices
    );
    expect(barriers.mesh.geometry.getIndex()?.array).toBe(barriers.indices);
    for (const point of traces) {
      const floatsPerProxy = barriers.verticesPerProxy * 3;
      for (
        let offset = 0;
        offset < positions.length;
        offset += floatsPerProxy
      ) {
        const xs: number[] = [];
        const zs: number[] = [];
        for (let vertex = 0; vertex < barriers.verticesPerProxy; vertex += 1) {
          xs.push(positions[offset + vertex * 3]!);
          zs.push(positions[offset + vertex * 3 + 2]!);
        }
        const inside =
          point.x >= Math.min(...xs) - 0.4 &&
          point.x <= Math.max(...xs) + 0.4 &&
          point.z >= Math.min(...zs) - 0.4 &&
          point.z <= Math.max(...zs) + 0.4;
        expect(inside).toBe(false);
      }
    }
    barriers.mesh.geometry.dispose();
  });
});
