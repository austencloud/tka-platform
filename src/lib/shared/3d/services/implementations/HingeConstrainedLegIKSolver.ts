// src/lib/shared/3d/services/implementations/HingeConstrainedLegIKSolver.ts

import { Vector3, Quaternion } from "three";
import type { ILegIKSolver, LegIKInput } from "../contracts/ILegIKSolver";

/**
 * HingeConstrainedLegIKSolver
 *
 * Two-bone analytic IK where the knee is constrained to rotate only
 * around a single hinge axis (the sagittal axis of the UpLeg). This is
 * what prevents knee splay — the classic failure mode of generic
 * FABRIK / CCD solvers when applied to humanoid legs.
 *
 * Algorithm (inspired by Unity's TwoBoneIKConstraint and Unreal's
 * AnimNode_TwoBoneIK):
 *   1. Clamp target distance to [|L1-L2|, L1+L2] to avoid degenerate cases.
 *   2. Compute knee bend angle from law of cosines and apply it as a
 *      local-space rotation around the hinge axis.
 *   3. Aim the UpLeg so that after the knee bend, the foot lands on
 *      the target.
 *   4. Optional slerp blend against original rotations for weight<1.
 */
export class HingeConstrainedLegIKSolver implements ILegIKSolver {
  private readonly tempHipWorld = new Vector3();
  private readonly tempCurrentFootDir = new Vector3();
  private readonly tempTargetDir = new Vector3();
  private readonly tempAimRot = new Quaternion();
  private readonly tempParentWorldQuat = new Quaternion();
  private readonly tempLocalAimRot = new Quaternion();

  solve(input: LegIKInput): void {
    const { chain, footTarget, kneeHingeAxis, weight } = input;
    if (weight <= 0) return;

    const hip = chain.root;
    const knee = chain.middle;
    const foot = chain.effector;
    const L1 = chain.upperLength;
    const L2 = chain.lowerLength;

    const origHipQuat = hip.quaternion.clone();
    const origKneeQuat = knee.quaternion.clone();

    hip.getWorldPosition(this.tempHipWorld);
    const hipWorld = this.tempHipWorld;

    const rawD = hipWorld.distanceTo(footTarget);
    const minReach = Math.abs(L1 - L2) * 1.01;
    const maxReach = (L1 + L2) * 0.99;
    const D = Math.max(minReach, Math.min(rawD, maxReach));

    const cosInterior = (L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2);
    const interiorKnee = Math.acos(Math.max(-1, Math.min(1, cosInterior)));
    const bendAngle = Math.PI - interiorKnee;

    const bendQuat = new Quaternion().setFromAxisAngle(kneeHingeAxis, bendAngle);
    knee.quaternion.copy(bendQuat);

    hip.updateMatrixWorld(true);
    knee.updateMatrixWorld(true);

    const currentFootWorld = new Vector3();
    foot.getWorldPosition(currentFootWorld);

    this.tempCurrentFootDir.subVectors(currentFootWorld, hipWorld).normalize();
    this.tempTargetDir.subVectors(footTarget, hipWorld).normalize();

    this.tempAimRot.setFromUnitVectors(
      this.tempCurrentFootDir,
      this.tempTargetDir,
    );

    if (hip.parent) {
      hip.parent.getWorldQuaternion(this.tempParentWorldQuat);
      this.tempLocalAimRot
        .copy(this.tempParentWorldQuat)
        .invert()
        .multiply(this.tempAimRot)
        .multiply(this.tempParentWorldQuat);
      hip.quaternion.premultiply(this.tempLocalAimRot);
    } else {
      hip.quaternion.premultiply(this.tempAimRot);
    }

    hip.updateMatrixWorld(true);
    knee.updateMatrixWorld(true);
    foot.updateMatrixWorld(true);

    if (weight < 1) {
      hip.quaternion.copy(origHipQuat).slerp(hip.quaternion, weight);
      knee.quaternion.copy(origKneeQuat).slerp(knee.quaternion, weight);
      hip.updateMatrixWorld(true);
      knee.updateMatrixWorld(true);
      foot.updateMatrixWorld(true);
    }
  }
}
