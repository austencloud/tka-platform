
import { Vector3, Quaternion, Matrix4 } from "three";
import type { LegIKInput } from "@austencloud/scene-3d";

/**
 * Two-bone analytic IK where the knee is constrained to rotate only
 * around a single hinge axis (the sagittal axis of the UpLeg).
 */

// Pooled temporaries — module-level to avoid per-call allocation
const _tempHipWorld = new Vector3();
const _tempCurrentFootDir = new Vector3();
const _tempTargetDir = new Vector3();
const _tempAimRot = new Quaternion();
const _tempParentWorldQuat = new Quaternion();
const _tempLocalAimRot = new Quaternion();
const _tempOrigHipQuat = new Quaternion();
const _tempOrigKneeQuat = new Quaternion();
const _tempOrigFootQuat = new Quaternion();
const _tempSolvedHip = new Quaternion();
const _tempSolvedKnee = new Quaternion();
const _tempSolvedFoot = new Quaternion();
const _tempBendQuat = new Quaternion();
const _tempFlipQuat = new Quaternion();
const _tempCurrentFootWorld = new Vector3();
const _tempChordMidpoint = new Vector3();
const _tempKneeOffset = new Vector3();
const _tempForwardOnPlane = new Vector3();
const _tempRight = new Vector3();
const _tempBasisMatrix = new Matrix4();
const _tempDesiredWorldQuat = new Quaternion();
const _tempFootParentWorldQuat = new Quaternion();

export function solveLegIK(input: LegIKInput): void {
  const { chain, footTarget, kneeHingeAxis, weight } = input;
  if (weight <= 0) return;

  const hip = chain.root;
  const knee = chain.middle;
  const foot = chain.effector;
  const L1 = chain.upperLength;
  const L2 = chain.lowerLength;

  _tempOrigHipQuat.copy(hip.quaternion);
  _tempOrigKneeQuat.copy(knee.quaternion);
  _tempOrigFootQuat.copy(foot.quaternion);

  hip.getWorldPosition(_tempHipWorld);
  const hipWorld = _tempHipWorld;

  const rawD = hipWorld.distanceTo(footTarget);
  const minReach = Math.abs(L1 - L2) * 1.01;
  const maxReach = (L1 + L2) * 0.99;
  const D = Math.max(minReach, Math.min(rawD, maxReach));

  const cosInterior = (L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2);
  const interiorKnee = Math.acos(Math.max(-1, Math.min(1, cosInterior)));
  const bendAngle = Math.PI - interiorKnee;

  _tempBendQuat.setFromAxisAngle(kneeHingeAxis, bendAngle);
  knee.quaternion.copy(_tempBendQuat);

  hip.updateMatrixWorld(true);
  knee.updateMatrixWorld(true);

  foot.getWorldPosition(_tempCurrentFootWorld);

  _tempChordMidpoint.addVectors(hipWorld, footTarget).multiplyScalar(0.5);
  _tempKneeOffset.subVectors(_tempCurrentFootWorld, _tempChordMidpoint);
  if (_tempKneeOffset.dot(input.poleDirection) > 0) {
    _tempFlipQuat.setFromAxisAngle(kneeHingeAxis, -bendAngle);
    knee.quaternion.copy(_tempFlipQuat);
    hip.updateMatrixWorld(true);
    knee.updateMatrixWorld(true);
    foot.getWorldPosition(_tempCurrentFootWorld);
  }

  _tempCurrentFootDir.subVectors(_tempCurrentFootWorld, hipWorld).normalize();
  _tempTargetDir.subVectors(footTarget, hipWorld).normalize();

  _tempAimRot.setFromUnitVectors(_tempCurrentFootDir, _tempTargetDir);

  if (hip.parent) {
    hip.parent.getWorldQuaternion(_tempParentWorldQuat);
    _tempLocalAimRot
      .copy(_tempParentWorldQuat)
      .invert()
      .multiply(_tempAimRot)
      .multiply(_tempParentWorldQuat);
    hip.quaternion.premultiply(_tempLocalAimRot);
  } else {
    hip.quaternion.premultiply(_tempAimRot);
  }

  hip.updateMatrixWorld(true);
  knee.updateMatrixWorld(true);
  foot.updateMatrixWorld(true);

  if (input.groundNormal && input.footForward) {
    const up = input.groundNormal;
    const footForward = input.footForward;
    _tempForwardOnPlane.copy(footForward).addScaledVector(up, -footForward.dot(up));

    if (_tempForwardOnPlane.lengthSq() >= 1e-6) {
      _tempForwardOnPlane.normalize();
      _tempRight.crossVectors(up, _tempForwardOnPlane).normalize();

      _tempBasisMatrix.makeBasis(_tempRight, up, _tempForwardOnPlane);
      _tempDesiredWorldQuat.setFromRotationMatrix(_tempBasisMatrix);

      if (foot.parent) {
        foot.parent.getWorldQuaternion(_tempFootParentWorldQuat);
        foot.quaternion
          .copy(_tempFootParentWorldQuat)
          .invert()
          .multiply(_tempDesiredWorldQuat);
      } else {
        foot.quaternion.copy(_tempDesiredWorldQuat);
      }
      foot.updateMatrixWorld(true);
    }
  }

  if (weight < 1) {
    _tempSolvedHip.copy(hip.quaternion);
    _tempSolvedKnee.copy(knee.quaternion);
    _tempSolvedFoot.copy(foot.quaternion);
    hip.quaternion.copy(_tempOrigHipQuat).slerp(_tempSolvedHip, weight);
    knee.quaternion.copy(_tempOrigKneeQuat).slerp(_tempSolvedKnee, weight);
    foot.quaternion.copy(_tempOrigFootQuat).slerp(_tempSolvedFoot, weight);
    hip.updateMatrixWorld(true);
    knee.updateMatrixWorld(true);
    foot.updateMatrixWorld(true);
  }
}
