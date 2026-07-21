import { describe, expect, it } from "vitest";
import { CatmullRomCurve3, Euler, Quaternion, Vector3 } from "three";
import { Plane } from "@austencloud/scene-3d";
import {
  calculateUndulationScale,
  createTracerPose,
} from "../../src/routes/test/spatial-sculpture/spatial-sculpture-motion";

describe("spatial sculpture motion", () => {
  it("uses the same eased out-and-back cycle as the animated mandala", () => {
    expect(calculateUndulationScale(0, 0.34)).toBeCloseTo(0.66);
    expect(calculateUndulationScale(0.25, 0.34)).toBeCloseTo(1);
    expect(calculateUndulationScale(0.5, 0.34)).toBeCloseTo(1.34);
    expect(calculateUndulationScale(1, 0.34)).toBeCloseTo(0.66);
  });

  it("pins the rendered staff's tracked end to the sampled curve point", () => {
    const curve = new CatmullRomCurve3(
      [
        new Vector3(1, 0, 0),
        new Vector3(0, 1, 0.4),
        new Vector3(-1, 0, 0),
        new Vector3(0, -1, -0.4),
      ],
      true,
      "centripetal",
      0.5
    );
    const progress = 0.37;
    const sculptureScale = 1.28;
    const propLength = 0.74;
    const pose = createTracerPose(
      curve,
      progress,
      sculptureScale,
      propLength,
      Plane.WHEEL
    );

    const horizontalQuat = new Quaternion().setFromEuler(
      new Euler(0, 0, Math.PI / 2)
    );
    const renderedAxis = new Vector3(0, 1, 0).applyQuaternion(
      pose.propState.worldRotation.clone().multiply(horizontalQuat)
    );
    const renderedTrackedEnd = pose.center
      .clone()
      .addScaledVector(renderedAxis, propLength / 2);
    const expectedTip = curve
      .getPointAt(progress)
      .multiplyScalar(sculptureScale);

    expect(renderedTrackedEnd.distanceTo(expectedTip)).toBeLessThan(1e-8);
    expect(pose.tip.distanceTo(expectedTip)).toBeLessThan(1e-8);
    expect(pose.propState.plane).toBe(Plane.WHEEL);
  });
});
