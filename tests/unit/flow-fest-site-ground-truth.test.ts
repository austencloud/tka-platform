import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ImportedTerrainDataV2 } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";
import { parseFlowFestRuntimeContract } from "../../src/routes/test/flow-fest-graybox/flow-fest-runtime-contract";
import { deriveFlowFestForestEcology } from "../../src/routes/test/flow-fest-sim/flow-fest-forest-ecology";

/**
 * Ground truth Austen gave in the 2026-09-03 site-labeling interview, recorded
 * in `docs/superpowers/specs/flow-fest-sim/site-labels-interview.md`.
 *
 * The two largest open spaces on the property are genuinely bare. Both read as
 * grass in the LiDAR canopy raster today, so placement already honours them —
 * these assertions exist so that a later canopy, infill, or layout change
 * cannot plant a tree in the fire field or inside the campground loop without
 * failing loudly. They are site facts, not implementation details.
 */

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

function loadSite() {
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
  return {
    contract,
    terrain,
    canopy: { offsetsCentimeters: offsets, width: 1025, height: 1025 },
  };
}

/**
 * The fire field, as Austen sized it: "about seven blocks ... more like a
 * smushed oval". Seven cells of the Middle Earth interview grid area-match an
 * ellipse of 51 x 32 m centred where he placed it.
 */
const FIRE_FIELD = {
  centerX: 25 + 720 / 11,
  centerZ: -165 + 500 / 11,
  radiusX: 280 / 11,
  radiusZ: 176 / 11,
};

/**
 * The lower campground loop road, traced off the orthophoto at the registration
 * documented in the interview record: `worldX = 213 + px / 9.032`,
 * `worldZ = -209 + py / 9.032`.
 */
const LOOP_TRACE_PIXELS: ReadonlyArray<readonly [number, number]> = [
  [960, 930],
  [1035, 760],
  [1052, 600],
  [990, 505],
  [880, 425],
  [690, 332],
  [480, 286],
  [330, 300],
  [196, 432],
  [96, 660],
  [52, 880],
  [70, 1015],
  [250, 1108],
  [470, 1168],
  [640, 1200],
  [810, 1130],
  [915, 1015],
];

const LOOP_INTERIOR = LOOP_TRACE_PIXELS.map(
  ([px, py]) => [213 + px / 9.032, -209 + py / 9.032] as const
);

function insideEllipse(x: number, z: number): boolean {
  const dx = (x - FIRE_FIELD.centerX) / FIRE_FIELD.radiusX;
  const dz = (z - FIRE_FIELD.centerZ) / FIRE_FIELD.radiusZ;
  return dx * dx + dz * dz <= 1;
}

function insidePolygon(
  x: number,
  z: number,
  polygon: ReadonlyArray<readonly [number, number]>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (
      zi > z !== zj > z &&
      x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToPolygon(
  x: number,
  z: number,
  polygon: ReadonlyArray<readonly [number, number]>
): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const dx = xj - xi;
    const dz = zj - zi;
    const lengthSquared = dx * dx + dz * dz;
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((x - xi) * dx + (z - zi) * dz) / lengthSquared)
          );
    const px = xi + t * dx;
    const pz = zi + t * dz;
    best = Math.min(best, Math.hypot(x - px, z - pz));
  }
  return best;
}

describe("Flow Fest site ground truth", () => {
  const { contract, terrain, canopy } = loadSite();
  const ecology = deriveFlowFestForestEcology(contract, terrain, canopy);

  it("leaves the Middle Earth fire field completely bare", () => {
    const intruders = ecology.trees.filter((tree) =>
      insideEllipse(tree.x, tree.z)
    );

    expect(
      intruders.map((tree) => `${tree.familyId} at ${tree.x.toFixed(1)}, ${tree.z.toFixed(1)}`)
    ).toEqual([]);
  });

  /**
   * Austen called the inside of the loop "wide open, no trees". The canopy
   * survey disagrees: twelve trees fall inside the traced loop road, most of
   * them on the real tree cluster around the main building at its south end,
   * a few on grass at the north end. Rather than encode either source as
   * truth, this asserts the campable proportion — the loop interior stays
   * overwhelmingly open, which is what makes shade there scarce.
   */
  it("keeps the loop interior overwhelmingly open", () => {
    const interior = ecology.trees.filter((tree) =>
      insidePolygon(tree.x, tree.z, LOOP_INTERIOR)
    );
    const treeline = ecology.trees.filter(
      (tree) =>
        !insidePolygon(tree.x, tree.z, LOOP_INTERIOR) &&
        distanceToPolygon(tree.x, tree.z, LOOP_INTERIOR) <= 45
    );

    expect(interior.length).toBeLessThan(treeline.length / 4);
  });

  it("keeps a real treeline around the loop, which is where the shade comes from", () => {
    const treeline = ecology.trees.filter(
      (tree) =>
        !insidePolygon(tree.x, tree.z, LOOP_INTERIOR) &&
        distanceToPolygon(tree.x, tree.z, LOOP_INTERIOR) <= 45
    );

    expect(treeline.length).toBeGreaterThan(20);
    expect(
      Math.max(...treeline.map((tree) => tree.crownRadiusMeters))
    ).toBeGreaterThan(3);
  });
});
