import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EARTH_CANYON_BLENDER_COLLECTIONS,
  buildEarthCanyonBlenderContract,
  earthBlenderPointToPlan,
  earthPlanPointToBlender,
} from "$lib/features/museum/data/earth-canyon-blender-contract";
import { canonicalJSON } from "$lib/shared/foundation/utils/canonical-json";

const contract = buildEarthCanyonBlenderContract();
const manifestPath = resolve(
  "docs/superpowers/specs/2026-08-08-earth-root-chasm-blender-plan.json"
);

describe("Earth Root Chasm Blender coordinate contract", () => {
  it("derives its mount and route from the compiled Earth walkthrough", () => {
    expect(contract.room.width).toBeGreaterThan(30);
    expect(contract.room.depth).toBeGreaterThan(20);
    expect(contract.route.fireEntry.plan).toEqual(
      expect.objectContaining({ x: contract.room.planBounds.minX + 3 })
    );
    expect(contract.route.airExit.plan.z).toBeGreaterThan(
      contract.route.slabOverlook.plan.z
    );
    expect(contract.coordinateSystem.gltfRuntime.rotationRadians).toEqual([
      0, 0, 0,
    ]);
    expect(contract.coordinateSystem.gltfRuntime.scale).toBe(1);
  });

  it("round-trips every route and performer point without axis drift", () => {
    const points = [
      ...Object.values(contract.route).map((anchor) => anchor.plan),
      ...contract.performers.map((performer) => performer.planCentre),
    ];

    for (const point of points) {
      const blender = earthPlanPointToBlender(
        point,
        contract.room.planCentre,
        2.25
      );
      const roundTrip = earthBlenderPointToPlan(
        blender,
        contract.room.planCentre
      );
      expect(roundTrip.x).toBeCloseTo(point.x, 12);
      expect(roundTrip.z).toBeCloseTo(point.z, 12);
    }
  });

  it("locks the three-performer G/H/I ensemble to the three boss tops", () => {
    expect(
      contract.performers.map(({ id, label, performerId, sequenceId }) => ({
        id,
        label,
        performerId,
        sequenceId,
      }))
    ).toEqual([
      {
        id: "g",
        label: "G",
        performerId: "cave-earth-automaton-g",
        sequenceId: "cave-earth-seq-g",
      },
      {
        id: "h",
        label: "H",
        performerId: "cave-earth-automaton-h",
        sequenceId: "cave-earth-seq-h",
      },
      {
        id: "i",
        label: "I",
        performerId: "cave-earth-automaton-i",
        sequenceId: "cave-earth-seq-i",
      },
    ]);
    expect(
      new Set(contract.performers.map((performer) => performer.blenderCentre.z))
    ).toEqual(new Set([-7.25]));
  });

  it("keeps all visitor anchors inside the centred room footprint", () => {
    const bounds = contract.room.blenderBounds;
    for (const anchor of Object.values(contract.route)) {
      expect(anchor.blender.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(anchor.blender.x).toBeLessThanOrEqual(bounds.maxX);
      expect(anchor.blender.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(anchor.blender.y).toBeLessThanOrEqual(bounds.maxY);
    }
  });

  it("locks the artist-facing collection contract", () => {
    expect(contract.collections).toEqual(EARTH_CANYON_BLENDER_COLLECTIONS);
    expect(new Set(contract.collections).size).toBe(
      contract.collections.length
    );
  });

  it("keeps the generated manifest synchronized and hash-stamped", () => {
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
