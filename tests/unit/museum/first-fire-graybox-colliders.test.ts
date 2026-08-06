import { describe, expect, it } from "vitest";
import { buildFirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";
import {
  buildFirstFireGrayboxColliders,
  FIRST_FIRE_GRAYBOX_SPAWN,
} from "../../../src/routes/test/first-fire-graybox/first-fire-graybox-colliders";

describe("First Fire walkable graybox collision scaffold", () => {
  const contract = buildFirstFireBlenderContract();
  const colliders = buildFirstFireGrayboxColliders(contract);

  it("keeps the Water spawn inside the room and facing Earth", () => {
    expect(FIRST_FIRE_GRAYBOX_SPAWN.x).toBeGreaterThan(
      contract.room.blenderBounds.minX
    );
    expect(FIRST_FIRE_GRAYBOX_SPAWN.x).toBeLessThan(-27);
    expect(FIRST_FIRE_GRAYBOX_SPAWN.z).toBe(0);
    expect(FIRST_FIRE_GRAYBOX_SPAWN.yaw).toBe(Math.PI / 2);
  });

  it("builds one floor, eight shell pieces, five blockers, and three trenches", () => {
    expect(colliders).toHaveLength(17);
    expect(
      colliders.filter((collider) => collider.id.includes("trench"))
    ).toHaveLength(3);
    expect(
      colliders.filter((collider) =>
        contract.occluders.some((occluder) => occluder.id === collider.id)
      )
    ).toHaveLength(contract.occluders.length);
  });

  it("places every blocker in runtime X/Z after Blender axis conversion", () => {
    for (const occluder of contract.occluders) {
      const collider = colliders.find(
        (candidate) => candidate.id === occluder.id
      );
      expect(collider?.position[0]).toBeCloseTo(
        occluder.blenderFootprint.centre.x,
        12
      );
      expect(collider?.position[2]).toBeCloseTo(
        -occluder.blenderFootprint.centre.y,
        12
      );
    }
  });

  it("leaves both measured two-metre door spans open", () => {
    const waterNorth = colliders.find(
      (collider) => collider.id === "water-wall-north"
    );
    const waterSouth = colliders.find(
      (collider) => collider.id === "water-wall-south"
    );
    const earthNorth = colliders.find(
      (collider) => collider.id === "earth-wall-north"
    );
    const earthSouth = colliders.find(
      (collider) => collider.id === "earth-wall-south"
    );

    expect(waterNorth?.shape).toBe("box");
    expect(waterSouth?.shape).toBe("box");
    expect(earthNorth?.shape).toBe("box");
    expect(earthSouth?.shape).toBe("box");
    if (
      waterNorth?.shape !== "box" ||
      waterSouth?.shape !== "box" ||
      earthNorth?.shape !== "box" ||
      earthSouth?.shape !== "box"
    ) {
      throw new Error("Expected door shell colliders to be boxes");
    }

    const waterGap =
      waterSouth.position[2] -
      waterSouth.size[2] / 2 -
      (waterNorth.position[2] + waterNorth.size[2] / 2);
    const earthGap =
      earthSouth.position[2] -
      earthSouth.size[2] / 2 -
      (earthNorth.position[2] + earthNorth.size[2] / 2);
    expect(waterGap).toBeCloseTo(contract.doors.water.clearWidth, 12);
    expect(earthGap).toBeCloseTo(contract.doors.earth.clearWidth, 12);
  });
});
