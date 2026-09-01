import { describe, expect, it } from "vitest";
import { Euler, Vector3 } from "three";
import { SpineTwister } from "../../node_modules/@austencloud/scene-3d/src/lib/services/implementations/SpineTwister";

const bodyCenter = new Vector3(0, 0, 0);

function rotationFrom(quaternion: {
  x: number;
  y: number;
  z: number;
  w: number;
}): Euler {
  return new Euler().setFromQuaternion(
    quaternion as import("three").Quaternion,
    "YZX"
  );
}

describe("scene-3d cross-body shoulder reach", () => {
  const twister = new SpineTwister();

  it("leaves shoulders neutral when both hands stay on their natural sides", () => {
    const result = twister.computeSpineTwist(
      new Vector3(-0.4, 0, 0.3),
      new Vector3(0.4, 0, 0.3),
      bodyCenter
    );
    const spine = rotationFrom(result.spine1);

    expect(spine.x).toBeCloseTo(0, 6);
    expect(spine.y).toBeCloseTo(0, 6);
  });

  it("keeps a symmetric crossed-hand pose centered without a forced bow", () => {
    const result = twister.computeSpineTwist(
      new Vector3(0.4, 0, 0.42),
      new Vector3(-0.4, 0, 0.42),
      bodyCenter
    );
    const spine = rotationFrom(result.spine1);

    expect(spine.x).toBeCloseTo(0, 6);
    expect(spine.y).toBeCloseTo(0, 6);
  });

  it("turns toward the hand that crosses instead of twisting on natural reach", () => {
    const result = twister.computeSpineTwist(
      new Vector3(0.4, 0, 0.42),
      new Vector3(0.4, 0, 0.42),
      bodyCenter
    );
    const spine = rotationFrom(result.spine1);

    expect(spine.x).toBeCloseTo(0, 6);
    expect(spine.y).toBeGreaterThan(0);
  });
});
