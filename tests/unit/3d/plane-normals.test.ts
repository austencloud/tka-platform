import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";
import { getPlaneNormal } from "$lib/shared/3d/domain/constants/plane-transforms";

const S2 = 1 / Math.sqrt(2);

const EXPECTED_NORMALS: Record<string, [number, number, number]> = {
  [Plane.WALL]:           [0, 0, 1],
  [Plane.WHEEL]:          [1, 0, 0],
  [Plane.FLOOR]:          [0, 1, 0],
  [Plane.RIGHT_SHIELD]:   [S2, 0, S2],
  [Plane.LEFT_SHIELD]:    [-S2, 0, S2],
  [Plane.FORWARD_RAMP]:   [0, S2, -S2],
  [Plane.BACKWARD_RAMP]:  [0, S2, S2],
  [Plane.RIGHT_SUNDIAL]:  [S2, S2, 0],
  [Plane.LEFT_SUNDIAL]:   [-S2, S2, 0],
};

describe("Plane normals", () => {
  for (const [plane, [x, y, z]] of Object.entries(EXPECTED_NORMALS)) {
    it(`${plane} has correct unit normal`, () => {
      const normal = getPlaneNormal(plane as Plane);
      expect(normal.x).toBeCloseTo(x, 5);
      expect(normal.y).toBeCloseTo(y, 5);
      expect(normal.z).toBeCloseTo(z, 5);
      expect(normal.length()).toBeCloseTo(1, 5);
    });
  }

  it("primary planes are mutually perpendicular", () => {
    const wall = getPlaneNormal(Plane.WALL);
    const wheel = getPlaneNormal(Plane.WHEEL);
    const floor = getPlaneNormal(Plane.FLOOR);
    expect(wall.dot(wheel)).toBeCloseTo(0, 5);
    expect(wall.dot(floor)).toBeCloseTo(0, 5);
    expect(wheel.dot(floor)).toBeCloseTo(0, 5);
  });

  it("diamond gate points sit on exactly 2 primary planes", () => {
    const R = 1;
    const gatePoints = [
      { name: "Up",    pos: new Vector3(0, R, 0),  planes: [Plane.WALL, Plane.WHEEL] },
      { name: "Down",  pos: new Vector3(0, -R, 0), planes: [Plane.WALL, Plane.WHEEL] },
      { name: "StgR",  pos: new Vector3(R, 0, 0),  planes: [Plane.WALL, Plane.FLOOR] },
      { name: "StgL",  pos: new Vector3(-R, 0, 0), planes: [Plane.WALL, Plane.FLOOR] },
      { name: "Dnstg", pos: new Vector3(0, 0, R),  planes: [Plane.WHEEL, Plane.FLOOR] },
      { name: "Upstg", pos: new Vector3(0, 0, -R), planes: [Plane.WHEEL, Plane.FLOOR] },
    ];

    const primaries = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];

    for (const gate of gatePoints) {
      const onPlanes = primaries.filter(p => {
        const dot = Math.abs(gate.pos.dot(getPlaneNormal(p)));
        return dot < 0.001;
      });
      expect(onPlanes).toHaveLength(2);
      expect(onPlanes).toEqual(expect.arrayContaining(gate.planes));
    }
  });
});
