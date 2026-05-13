import { describe, it, expect } from "vitest";
import { snapToNearestGridLocation } from "../../../src/lib/features/lab/tabs/spatial-lab/services/grid-snap";
import { GridLocation } from "../../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Plane } from "@austencloud/scene-3d";
import { Vector3 } from "three";

describe("grid-snap", () => {
  it("snaps a point near EAST to GridLocation.EAST", () => {
    const point = new Vector3(-0.45, 0, 0.05);
    const result = snapToNearestGridLocation(point, Plane.WALL);
    expect(result).toBe(GridLocation.EAST);
  });

  it("snaps a point near WEST to GridLocation.WEST", () => {
    const point = new Vector3(0.45, 0, -0.05);
    const result = snapToNearestGridLocation(point, Plane.WALL);
    expect(result).toBe(GridLocation.WEST);
  });

  it("snaps a point near NORTH to GridLocation.NORTH", () => {
    const point = new Vector3(0, 0.4, 0);
    const result = snapToNearestGridLocation(point, Plane.WALL);
    expect(result).toBe(GridLocation.NORTH);
  });

  it("snaps a point near SOUTH to GridLocation.SOUTH", () => {
    const point = new Vector3(0, -0.4, 0);
    const result = snapToNearestGridLocation(point, Plane.WALL);
    expect(result).toBe(GridLocation.SOUTH);
  });

  it("snaps to intercardinal locations (NORTHEAST)", () => {
    const point = new Vector3(-0.3, 0.3, 0);
    const result = snapToNearestGridLocation(point, Plane.WALL);
    expect(result).toBe(GridLocation.NORTHEAST);
  });

  it("works on WHEEL plane", () => {
    const point = new Vector3(0, 0.4, 0.05);
    const result = snapToNearestGridLocation(point, Plane.WHEEL);
    expect(result).toBe(GridLocation.NORTH);
  });

  it("works on FLOOR plane", () => {
    const point = new Vector3(-0.45, 0, 0.05);
    const result = snapToNearestGridLocation(point, Plane.FLOOR);
    expect(result).toBe(GridLocation.EAST);
  });
});
