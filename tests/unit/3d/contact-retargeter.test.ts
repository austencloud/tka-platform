import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { requiredLegOrderShift } from "@austencloud/scene-3d";

describe("contact retarget leg ordering", () => {
  it("adds the least symmetric shift needed to uncross a lateral pose", () => {
    const leftHip = new Vector3(-0.1, 1, 0);
    const rightHip = new Vector3(0.1, 1, 0);
    const leftFoot = new Vector3(0.05, 0, 0);
    const rightFoot = new Vector3(-0.05, 0, 0);

    const shift = requiredLegOrderShift(
      leftHip,
      rightHip,
      leftFoot,
      rightFoot,
      0.5
    );

    expect(shift).toBeCloseTo(0.1, 8);
    expect(rightFoot.x + shift - (leftFoot.x - shift)).toBeCloseTo(0.1, 8);
  });

  it("leaves a pose that already clears the lane untouched", () => {
    expect(
      requiredLegOrderShift(
        new Vector3(-0.1, 1, 0),
        new Vector3(0.1, 1, 0),
        new Vector3(-0.2, 0, 0),
        new Vector3(0.2, 0, 0),
        0.5
      )
    ).toBe(0);
  });

  it("can reserve shoe clearance beyond hip width for lateral gait", () => {
    const shift = requiredLegOrderShift(
      new Vector3(-0.1, 1, 0),
      new Vector3(0.1, 1, 0),
      new Vector3(-0.04, 0, 0),
      new Vector3(0.04, 0, 0),
      1.25
    );

    expect(shift).toBeCloseTo(0.085, 8);
  });
});
