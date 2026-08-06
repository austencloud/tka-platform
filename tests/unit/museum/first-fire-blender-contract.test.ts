import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIRST_FIRE_BLENDER_COLLECTIONS,
  buildFirstFireBlenderContract,
  firstFireBlenderPointToPlan,
  firstFirePlanPointToBlender,
} from "$lib/features/museum/data/first-fire-blender-contract";
import { canonicalJSON } from "$lib/shared/foundation/utils/canonical-json";

const contract = buildFirstFireBlenderContract();
const manifestPath = resolve(
  "docs/superpowers/specs/2026-08-06-first-fire-blender-plan.json"
);

describe("First Fire Blender coordinate contract", () => {
  it("centres the authored asset on the runtime room mount", () => {
    expect(contract.room.planCentre).toEqual({ x: 30, z: 15 });
    expect(contract.room.blenderBounds).toEqual({
      minX: -30,
      maxX: 30,
      minY: -15,
      maxY: 15,
    });
    expect(contract.doors.water.blender).toEqual({ x: -30, y: 0, z: 0 });
    expect(contract.doors.earth.blender).toEqual({ x: 30, y: -13, z: 0 });
    expect(contract.coordinateSystem.gltfRuntime.rotationRadians).toEqual([
      0, 0, 0,
    ]);
    expect(contract.coordinateSystem.gltfRuntime.scale).toBe(1);
  });

  it("round-trips plan points through Blender without axis drift", () => {
    for (const section of contract.pathSections) {
      for (const point of section.planPoints) {
        const blender = firstFirePlanPointToBlender(
          point,
          contract.room.planCentre,
          2.25
        );
        const roundTrip = firstFireBlenderPointToPlan(
          blender,
          contract.room.planCentre
        );
        expect(roundTrip.x).toBeCloseTo(point.x, 12);
        expect(roundTrip.z).toBeCloseTo(point.z, 12);
      }
    }
  });

  it("maps the three performer anchors to their centred Blender positions", () => {
    expect(
      contract.shrines.map(({ id, blenderCentre }) => ({ id, blenderCentre }))
    ).toEqual([
      { id: "dj", blenderCentre: { x: -13.5, y: 6.5, z: 0 } },
      { id: "ek", blenderCentre: { x: 1.5, y: -6.5, z: 0 } },
      { id: "fl", blenderCentre: { x: 17, y: 6.5, z: 0 } },
    ]);
  });

  it("keeps every Blender path point inside the centred room footprint", () => {
    const bounds = contract.room.blenderBounds;
    for (const section of contract.pathSections) {
      for (const point of section.blenderPoints) {
        expect(point.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(point.x).toBeLessThanOrEqual(bounds.maxX);
        expect(point.y).toBeGreaterThanOrEqual(bounds.minY);
        expect(point.y).toBeLessThanOrEqual(bounds.maxY);
      }
    }
  });

  it("locks the artist-facing collection contract", () => {
    expect(contract.collections).toEqual(FIRST_FIRE_BLENDER_COLLECTIONS);
    expect(new Set(contract.collections).size).toBe(
      contract.collections.length
    );
  });

  it("keeps the checked-in manifest synchronized and hash-stamped", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      hashAlgorithm: string;
      sourceDigest: string;
      contract: unknown;
    };
    const digest = createHash("sha256")
      .update(canonicalJSON(contract), "utf8")
      .digest("hex");

    expect(manifest.hashAlgorithm).toBe("sha256");
    expect(manifest.sourceDigest).toBe(digest);
    expect(manifest.contract).toEqual(contract);
  });
});
