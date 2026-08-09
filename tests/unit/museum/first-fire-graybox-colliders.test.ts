import { describe, expect, it } from "vitest";
import { buildFirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";
import {
  buildFirstFireGrayboxColliders,
  FIRST_FIRE_GRAYBOX_SPAWN,
} from "../../../src/routes/test/first-fire-graybox/first-fire-graybox-colliders";

describe("First Fire Cinder Court collision scaffold", () => {
  const contract = buildFirstFireBlenderContract();
  const colliders = buildFirstFireGrayboxColliders(contract);

  it("spawns at the Water threshold inside the isolated 58 by 44 metre shell", () => {
    expect(contract.room.width).toBe(58);
    expect(contract.room.depth).toBe(44);
    expect(FIRST_FIRE_GRAYBOX_SPAWN.x).toBeGreaterThan(
      contract.room.blenderBounds.minX
    );
    expect(FIRST_FIRE_GRAYBOX_SPAWN.x).toBeLessThan(-26);
    expect(FIRST_FIRE_GRAYBOX_SPAWN.z).toBeCloseTo(
      -contract.doors.water.blender.y,
      12
    );
    expect(FIRST_FIRE_GRAYBOX_SPAWN.yaw).toBe(Math.PI / 2);
  });

  it("uses shell pieces plus every authored basalt polygon edge and nothing from fire", () => {
    const expectedBasaltEdges = contract.basalt.reduce(
      (sum, mass) => sum + mass.blenderPolygon.length,
      0
    );
    expect(
      colliders.filter((collider) => collider.source === "shell")
    ).toHaveLength(9);
    expect(
      colliders.filter((collider) => collider.source === "basalt")
    ).toHaveLength(expectedBasaltEdges);
    expect(
      colliders.some((collider) => /fire|flame|trench|magma/i.test(collider.id))
    ).toBe(false);
  });

  it("preserves polygonal basalt edges instead of broad bounding boxes", () => {
    const firstMass = contract.basalt[0]!;
    const firstEdge = colliders.find(
      (candidate) => candidate.id === `${firstMass.id}-edge-1`
    );
    const start = firstMass.blenderPolygon[0]!;
    const end = firstMass.blenderPolygon[1]!;
    expect(firstEdge?.source).toBe("basalt");
    expect(firstEdge?.position[0]).toBeCloseTo((start.x + end.x) / 2, 12);
    expect(firstEdge?.position[2]).toBeCloseTo(-(start.y + end.y) / 2, 12);
    expect(firstEdge?.size[0]).toBeCloseTo(
      Math.hypot(end.x - start.x, end.y - start.y) + 0.34,
      12
    );
    expect(firstEdge?.rotation).toBeDefined();
  });

  it("leaves both measured four-metre door spans open", () => {
    for (const side of ["water", "earth"] as const) {
      const north = colliders.find(
        (collider) => collider.id === `${side}-wall-north`
      )!;
      const south = colliders.find(
        (collider) => collider.id === `${side}-wall-south`
      )!;
      const gap =
        south.position[2] -
        south.size[2] / 2 -
        (north.position[2] + north.size[2] / 2);
      expect(gap).toBeCloseTo(contract.doors[side].clearWidth, 12);
      expect(gap).toBeCloseTo(4, 12);
    }
  });
});
