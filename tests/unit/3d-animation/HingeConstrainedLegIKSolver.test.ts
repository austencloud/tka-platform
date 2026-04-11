import { describe, it, expect } from "vitest";
import { Bone, Vector3, Quaternion, Object3D } from "three";
import { HingeConstrainedLegIKSolver } from "$lib/shared/3d/services/implementations/HingeConstrainedLegIKSolver";
import type { BoneChain } from "$lib/shared/3d/services/contracts/IAvatarSkeletonBuilder";
import type { LegIKInput } from "$lib/shared/3d/services/contracts/ILegIKSolver";

/**
 * Coordinate convention (TKA / Mixamo scene space):
 *   right = +X, left = -X, forward = +Z, up = +Y
 *
 * We build a synthetic leg chain with known lengths and rest poses so
 * the tests are deterministic. For the tests, we treat the bone local
 * axes as aligned with the world — this makes the hinge-axis math
 * transparent (hinge = world X = sagittal axis).
 */

function buildSyntheticLeg(): BoneChain {
  const rootGroup = new Object3D();

  const hip = new Bone();
  hip.name = "LeftUpLeg";
  hip.position.set(0, 1, 0);
  rootGroup.add(hip);

  const knee = new Bone();
  knee.name = "LeftLeg";
  knee.position.set(0, -0.5, 0);
  hip.add(knee);

  const foot = new Bone();
  foot.name = "LeftFoot";
  foot.position.set(0, -0.5, 0);
  knee.add(foot);

  rootGroup.updateMatrixWorld(true);

  return {
    root: hip,
    middle: knee,
    effector: foot,
    totalLength: 1.0,
    upperLength: 0.5,
    lowerLength: 0.5,
    rootRestDir: new Vector3(0, -1, 0),
    middleRestDir: new Vector3(0, -1, 0),
  };
}

function getWorldPos(bone: Bone): Vector3 {
  const v = new Vector3();
  bone.getWorldPosition(v);
  return v;
}

describe("HingeConstrainedLegIKSolver", () => {
  const solver = new HingeConstrainedLegIKSolver();

  describe("position solve", () => {
    it("reaches a target directly below the hip with slight offset", () => {
      const chain = buildSyntheticLeg();
      const target = new Vector3(0, 0.2, 0.3);

      const input: LegIKInput = {
        chain,
        footTarget: target,
        groundNormal: new Vector3(0, 1, 0),
        footForward: new Vector3(0, 0, 1),
        kneeHingeAxis: new Vector3(1, 0, 0),
        poleDirection: new Vector3(0, 0, 1),
        weight: 1,
      };

      solver.solve(input);

      const footWorld = getWorldPos(chain.effector);
      expect(footWorld.distanceTo(target)).toBeLessThan(1e-3);
    });

    it("handles unreachable target by stretching to max reach", () => {
      const chain = buildSyntheticLeg();
      const target = new Vector3(0, -1, 0);

      solver.solve({
        chain,
        footTarget: target,
        groundNormal: new Vector3(0, 1, 0),
        footForward: new Vector3(0, 0, 1),
        kneeHingeAxis: new Vector3(1, 0, 0),
        poleDirection: new Vector3(0, 0, 1),
        weight: 1,
      });

      const footWorld = getWorldPos(chain.effector);
      const hipWorld = getWorldPos(chain.root);
      expect(footWorld.distanceTo(hipWorld)).toBeLessThanOrEqual(0.99 + 1e-3);
      const dirToFoot = new Vector3().subVectors(footWorld, hipWorld).normalize();
      const dirToTarget = new Vector3().subVectors(target, hipWorld).normalize();
      expect(dirToFoot.dot(dirToTarget)).toBeGreaterThan(0.95);
    });

    it("handles too-close target by expanding to min reach", () => {
      const chain = buildSyntheticLeg();
      const target = new Vector3(0, 1, 0);

      expect(() => {
        solver.solve({
          chain,
          footTarget: target,
          groundNormal: new Vector3(0, 1, 0),
          footForward: new Vector3(0, 0, 1),
          kneeHingeAxis: new Vector3(1, 0, 0),
          poleDirection: new Vector3(0, 0, 1),
          weight: 1,
        });
      }).not.toThrow();

      const footWorld = getWorldPos(chain.effector);
      expect(Number.isFinite(footWorld.x)).toBe(true);
      expect(Number.isFinite(footWorld.y)).toBe(true);
      expect(Number.isFinite(footWorld.z)).toBe(true);
    });

    it("weight=0 leaves bones untouched", () => {
      const chain = buildSyntheticLeg();
      const origKneeQuat = chain.middle.quaternion.clone();
      const origHipQuat = chain.root.quaternion.clone();

      solver.solve({
        chain,
        footTarget: new Vector3(0, 0.2, 0.3),
        groundNormal: new Vector3(0, 1, 0),
        footForward: new Vector3(0, 0, 1),
        kneeHingeAxis: new Vector3(1, 0, 0),
        poleDirection: new Vector3(0, 0, 1),
        weight: 0,
      });

      expect(chain.middle.quaternion.equals(origKneeQuat)).toBe(true);
      expect(chain.root.quaternion.equals(origHipQuat)).toBe(true);
    });

    it("knee bends toward poleDirection, not away", () => {
      const chain = buildSyntheticLeg();
      const target = new Vector3(0, 0.2, 0.3);

      solver.solve({
        chain,
        footTarget: target,
        groundNormal: new Vector3(0, 1, 0),
        footForward: new Vector3(0, 0, 1),
        kneeHingeAxis: new Vector3(1, 0, 0),
        poleDirection: new Vector3(0, 0, 1), // knee should bend forward (+Z)
        weight: 1,
      });

      const hipWorld = getWorldPos(chain.root);
      const kneeWorld = getWorldPos(chain.middle);
      const footWorld = getWorldPos(chain.effector);

      // Knee should displace in +Z (forward) relative to the hip-foot chord
      const chord = new Vector3().addVectors(hipWorld, footWorld).multiplyScalar(0.5);
      const kneeOffset = new Vector3().subVectors(kneeWorld, chord);
      expect(kneeOffset.z).toBeGreaterThan(0);
    });

    it("knee flips to correct side when hinge axis is backwards", () => {
      const chain = buildSyntheticLeg();
      const target = new Vector3(0, 0.2, 0.3);

      solver.solve({
        chain,
        footTarget: target,
        groundNormal: new Vector3(0, 1, 0),
        footForward: new Vector3(0, 0, 1),
        kneeHingeAxis: new Vector3(-1, 0, 0), // flipped — would normally bend backward
        poleDirection: new Vector3(0, 0, 1),  // but we asked for forward
        weight: 1,
      });

      const hipWorld = getWorldPos(chain.root);
      const kneeWorld = getWorldPos(chain.middle);
      const footWorld = getWorldPos(chain.effector);

      // Even with a flipped hinge axis, the knee should bend forward
      const chord = new Vector3().addVectors(hipWorld, footWorld).multiplyScalar(0.5);
      const kneeOffset = new Vector3().subVectors(kneeWorld, chord);
      expect(kneeOffset.z).toBeGreaterThan(0);

      // Foot still reaches target
      expect(footWorld.distanceTo(target)).toBeLessThan(1e-3);
    });

    it("weight=0.5 produces an intermediate pose", () => {
      const chain = buildSyntheticLeg();

      // Capture foot position BEFORE any solve (original pose — leg straight down)
      const origFootWorld = getWorldPos(chain.effector);

      const target = new Vector3(0, 0.2, 0.3);

      solver.solve({
        chain,
        footTarget: target,
        groundNormal: new Vector3(0, 1, 0),
        footForward: new Vector3(0, 0, 1),
        kneeHingeAxis: new Vector3(1, 0, 0),
        poleDirection: new Vector3(0, 0, 1),
        weight: 0.5,
      });

      const blendedFootWorld = getWorldPos(chain.effector);

      // At weight=0.5, foot should be between original and target
      expect(blendedFootWorld.distanceTo(origFootWorld)).toBeGreaterThan(0.01);
      expect(blendedFootWorld.distanceTo(target)).toBeGreaterThan(0.01);
    });
  });

  describe("foot rotation alignment", () => {
    it("aligns foot forward vector with footForward input", () => {
      const chain = buildSyntheticLeg();
      const target = new Vector3(0, 0.2, 0.3);
      const desiredForward = new Vector3(0, 0, 1);

      solver.solve({
        chain,
        footTarget: target,
        groundNormal: new Vector3(0, 1, 0),
        footForward: desiredForward,
        kneeHingeAxis: new Vector3(1, 0, 0),
        poleDirection: new Vector3(0, 0, 1),
        weight: 1,
      });

      // Foot's world-space +Z axis should align with desiredForward
      const footWorldForward = new Vector3(0, 0, 1).applyQuaternion(
        chain.effector.getWorldQuaternion(new Quaternion())
      );
      expect(footWorldForward.dot(desiredForward)).toBeGreaterThan(0.7);
    });

    it("aligns foot sole with ground normal", () => {
      const chain = buildSyntheticLeg();
      const target = new Vector3(0, 0.2, 0.3);
      const groundNormal = new Vector3(0, 1, 0);

      solver.solve({
        chain,
        footTarget: target,
        groundNormal,
        footForward: new Vector3(0, 0, 1),
        kneeHingeAxis: new Vector3(1, 0, 0),
        poleDirection: new Vector3(0, 0, 1),
        weight: 1,
      });

      // Foot's world-space +Y (local up) should align with ground normal
      const footWorldUp = new Vector3(0, 1, 0).applyQuaternion(
        chain.effector.getWorldQuaternion(new Quaternion())
      );
      expect(footWorldUp.dot(groundNormal)).toBeGreaterThan(0.9);
    });
  });
});
