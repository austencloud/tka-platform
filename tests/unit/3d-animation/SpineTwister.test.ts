// tests/unit/3d-animation/SpineTwister.test.ts

import { describe, it, expect } from "vitest";
import { Vector3, Quaternion } from "three";
import { SpineTwister } from "$lib/shared/3d/services/implementations/SpineTwister";

function angleDegrees(q: Quaternion): number {
  const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  return (angle * 180) / Math.PI;
}

function expectUnitQuaternion(q: Quaternion) {
  expect(q.length()).toBeCloseTo(1, 4);
}

function expectNearIdentity(q: Quaternion) {
  expect(angleDegrees(q)).toBeLessThan(0.5);
}

describe("SpineTwister", () => {
  const twister = new SpineTwister();
  const bodyCenter = new Vector3(0, 1, 0);

  describe("balanced hands: no twist", () => {
    it("hands equidistant on opposite sides", () => {
      const result = twister.computeSpineTwist(
        new Vector3(0.3, 1.2, 0),   // left hand at +X
        new Vector3(-0.3, 1.2, 0),  // right hand at -X
        bodyCenter
      );
      expectNearIdentity(result.spine1);
      expectNearIdentity(result.spine2);
      expectNearIdentity(result.neck);
      expectNearIdentity(result.head);
    });

    it("both hands at center", () => {
      const result = twister.computeSpineTwist(
        new Vector3(0, 1.2, 0),
        new Vector3(0, 1.2, 0),
        bodyCenter
      );
      expectNearIdentity(result.spine1);
      expectNearIdentity(result.spine2);
      expectNearIdentity(result.neck);
      expectNearIdentity(result.head);
    });
  });

  describe("both hands offset to one side", () => {
    it("both hands left: positive Y rotation (twist left)", () => {
      const result = twister.computeSpineTwist(
        new Vector3(0.4, 1.2, 0),   // left hand far left (+X = skeleton left)
        new Vector3(0.2, 1.2, 0),   // right hand also left
        bodyCenter
      );
      // All bones should have nonzero rotation
      expect(angleDegrees(result.spine1)).toBeGreaterThan(0.1);
      expect(angleDegrees(result.head)).toBeGreaterThan(0.1);
      // Y component positive = twist toward +X (left in skeleton space)
      expect(result.head.y).toBeGreaterThan(0);
    });

    it("both hands right: negative Y rotation (twist right)", () => {
      const result = twister.computeSpineTwist(
        new Vector3(-0.2, 1.2, 0),
        new Vector3(-0.4, 1.2, 0),
        bodyCenter
      );
      expect(angleDegrees(result.head)).toBeGreaterThan(0.1);
      // Y component negative = twist toward -X (right in skeleton space)
      expect(result.head.y).toBeLessThan(0);
    });
  });

  describe("cross-body tension", () => {
    it("hands crossing in opposite directions: nonzero twist from tension", () => {
      // Left hand crosses to right (-X), right hand crosses to left (+X)
      // The cross tension should produce some twist
      const result = twister.computeSpineTwist(
        new Vector3(-0.3, 1.2, 0),  // left hand crossed to right
        new Vector3(0.3, 1.2, 0),   // right hand crossed to left
        bodyCenter
      );
      // Cross tension creates twist even though lateral bias is zero
      // At minimum the head should show some rotation
      const totalAngle = angleDegrees(result.spine1) +
        angleDegrees(result.spine2) +
        angleDegrees(result.neck) +
        angleDegrees(result.head);
      expect(totalAngle).toBeGreaterThan(0.1);
    });
  });

  describe("distribution: twist distributed across spine chain", () => {
    it("spine2 gets largest share, neck gets smallest", () => {
      // Weights: spine1=25%, spine2=35%, neck=15%, head=25%
      const result = twister.computeSpineTwist(
        new Vector3(0.4, 1.2, 0),
        new Vector3(0.3, 1.2, 0),
        bodyCenter
      );
      const spine1Angle = angleDegrees(result.spine1);
      const spine2Angle = angleDegrees(result.spine2);
      const neckAngle = angleDegrees(result.neck);
      const headAngle = angleDegrees(result.head);

      // spine2 (35%) is the largest share
      expect(spine2Angle).toBeGreaterThan(spine1Angle);
      expect(spine2Angle).toBeGreaterThan(neckAngle);
      // neck (15%) is the smallest share
      expect(neckAngle).toBeLessThan(headAngle);
      expect(neckAngle).toBeLessThan(spine1Angle);
    });
  });

  describe("maximum twist capped", () => {
    it("extreme position doesn't exceed 60 degrees total yaw", () => {
      // Hands at waist height (below tilt threshold), so only yaw applies.
      // Max yaw is 60°, distributed across all bones (weights sum to 1.0).
      const result = twister.computeSpineTwist(
        new Vector3(2, 1.2, 0),   // way far left
        new Vector3(2, 1.2, 0),   // both hands way far left
        bodyCenter
      );
      const totalAngle = angleDegrees(result.spine1) +
        angleDegrees(result.spine2) +
        angleDegrees(result.neck) +
        angleDegrees(result.head);
      expect(totalAngle).toBeLessThanOrEqual(61); // 60° + float tolerance
    });
  });

  describe("all results are unit quaternions", () => {
    it("balanced position", () => {
      const result = twister.computeSpineTwist(
        new Vector3(0.3, 1.2, 0),
        new Vector3(-0.3, 1.2, 0),
        bodyCenter
      );
      expectUnitQuaternion(result.spine1);
      expectUnitQuaternion(result.spine2);
      expectUnitQuaternion(result.neck);
      expectUnitQuaternion(result.head);
    });

    it("extreme offset", () => {
      const result = twister.computeSpineTwist(
        new Vector3(2, 1.2, 0),
        new Vector3(2, 1.2, 0),
        bodyCenter
      );
      expectUnitQuaternion(result.spine1);
      expectUnitQuaternion(result.spine2);
      expectUnitQuaternion(result.neck);
      expectUnitQuaternion(result.head);
    });
  });
});
