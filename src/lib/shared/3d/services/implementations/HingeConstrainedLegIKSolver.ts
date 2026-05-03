// src/lib/shared/3d/services/implementations/HingeConstrainedLegIKSolver.ts

import { Vector3, Quaternion, Matrix4 } from "three";
import type { LegIKInput } from "../contracts/types";

/**
 * HingeConstrainedLegIKSolver
 *
 * Two-bone analytic IK where the knee is constrained to rotate only
 * around a single hinge axis (the sagittal axis of the UpLeg). This is
 * what prevents knee splay - the classic failure mode of generic
 * FABRIK / CCD solvers when applied to humanoid legs.
 *
 * Algorithm (inspired by Unity's TwoBoneIKConstraint and Unreal's
 * AnimNode_TwoBoneIK):
 *   1. Clamp target distance to [|L1-L2|, L1+L2] to avoid degenerate cases.
 *   2. Compute knee bend angle from law of cosines and apply it as a
 *      local-space rotation around the hinge axis.
 *   3. Verify the knee bent toward poleDirection - if the hinge axis
 *      sign is inverted, the knee could silently bend backward while
 *      the foot still reaches the target. Flip the bend if needed.
 *   4. Aim the UpLeg so that after the knee bend, the foot lands on
 *      the target.
 *   5. Optional slerp blend against original rotations for weight<1.
 */
export class HingeConstrainedLegIKSolver {
  private readonly tempHipWorld = new Vector3();
  private readonly tempCurrentFootDir = new Vector3();
  private readonly tempTargetDir = new Vector3();
  private readonly tempAimRot = new Quaternion();
  private readonly tempParentWorldQuat = new Quaternion();
  private readonly tempLocalAimRot = new Quaternion();
  private readonly tempOrigHipQuat = new Quaternion();
  private readonly tempOrigKneeQuat = new Quaternion();
  private readonly tempOrigFootQuat = new Quaternion();
  private readonly tempSolvedHip = new Quaternion();
  private readonly tempSolvedKnee = new Quaternion();
  private readonly tempSolvedFoot = new Quaternion();
  private readonly tempBendQuat = new Quaternion();
  private readonly tempFlipQuat = new Quaternion();
  private readonly tempCurrentFootWorld = new Vector3();
  private readonly tempChordMidpoint = new Vector3();
  private readonly tempKneeOffset = new Vector3();
  private readonly tempForwardOnPlane = new Vector3();
  private readonly tempRight = new Vector3();
  private readonly tempBasisMatrix = new Matrix4();
  private readonly tempDesiredWorldQuat = new Quaternion();
  private readonly tempFootParentWorldQuat = new Quaternion();

  solve(input: LegIKInput): void {
    const { chain, footTarget, kneeHingeAxis, weight } = input;
    if (weight <= 0) return;

    const hip = chain.root;
    const knee = chain.middle;
    const foot = chain.effector;
    const L1 = chain.upperLength;
    const L2 = chain.lowerLength;

    this.tempOrigHipQuat.copy(hip.quaternion);
    this.tempOrigKneeQuat.copy(knee.quaternion);
    this.tempOrigFootQuat.copy(foot.quaternion);

    hip.getWorldPosition(this.tempHipWorld);
    const hipWorld = this.tempHipWorld;

    // Clamp distance to a reachable range. The 1.01 / 0.99 epsilons keep
    // acos away from ±1 where its derivative blows up.
    const rawD = hipWorld.distanceTo(footTarget);
    const minReach = Math.abs(L1 - L2) * 1.01;
    const maxReach = (L1 + L2) * 0.99;
    const D = Math.max(minReach, Math.min(rawD, maxReach));

    // Law of cosines: angle at the knee between UpLeg and Leg vectors.
    const cosInterior = (L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2);
    const interiorKnee = Math.acos(Math.max(-1, Math.min(1, cosInterior)));
    const bendAngle = Math.PI - interiorKnee;

    this.tempBendQuat.setFromAxisAngle(kneeHingeAxis, bendAngle);
    knee.quaternion.copy(this.tempBendQuat);

    hip.updateMatrixWorld(true);
    knee.updateMatrixWorld(true);

    // After the knee bend, the foot is somewhere in world space - not at
    // target. Aim the UpLeg so the hip→foot direction matches hip→target
    // direction.
    foot.getWorldPosition(this.tempCurrentFootWorld);

    // Pole direction check - ensure the knee will end up bent toward
    // poleDirection after the aim step. Without this, hinge axis sign
    // differences between left/right legs (from the cross-product
    // calibration in Task 4) can produce backward-bending knees that
    // still reach the target via the aim rotation - visually wrong but
    // numerically undetectable from foot position alone.
    //
    // Geometric reasoning: the aim step is a rigid rotation of the
    // hip-knee-foot triangle around the hip. The knee ends up on the
    // OPPOSITE side of the hip-target chord from where the foot
    // currently is (because aim "seesaws" foot to target while knee
    // swings the other way). So the test is: if the current foot is
    // on the SAME side as poleDirection, the knee will end up on the
    // wrong side - flip.
    this.tempChordMidpoint
      .addVectors(hipWorld, footTarget)
      .multiplyScalar(0.5);
    this.tempKneeOffset.subVectors(
      this.tempCurrentFootWorld,
      this.tempChordMidpoint,
    );
    if (this.tempKneeOffset.dot(input.poleDirection) > 0) {
      // Foot is on the pole side → knee will land on the wrong side.
      // Flip the hinge rotation and recompute the foot position.
      this.tempFlipQuat.setFromAxisAngle(kneeHingeAxis, -bendAngle);
      knee.quaternion.copy(this.tempFlipQuat);
      hip.updateMatrixWorld(true);
      knee.updateMatrixWorld(true);
      foot.getWorldPosition(this.tempCurrentFootWorld);
    }

    this.tempCurrentFootDir
      .subVectors(this.tempCurrentFootWorld, hipWorld)
      .normalize();
    this.tempTargetDir.subVectors(footTarget, hipWorld).normalize();

    this.tempAimRot.setFromUnitVectors(
      this.tempCurrentFootDir,
      this.tempTargetDir,
    );

    if (hip.parent) {
      // Convert world-space aim rotation to UpLeg's local space:
      // local = parent_world^-1 * world_aim * parent_world
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

    // Foot rotation alignment: set the foot's world rotation such that
    // the foot's local +Y axis points along groundNormal and the foot's
    // local +Z axis points along footForward (with Gram-Schmidt to
    // guarantee orthogonality when footForward isn't exactly perpendicular
    // to groundNormal).
    {
      const up = input.groundNormal; // assumed unit-length or normalized internally
      // Project footForward onto the plane perpendicular to up
      this.tempForwardOnPlane
        .copy(input.footForward)
        .addScaledVector(up, -input.footForward.dot(up));

      if (this.tempForwardOnPlane.lengthSq() >= 1e-6) {
        this.tempForwardOnPlane.normalize();
        this.tempRight
          .crossVectors(up, this.tempForwardOnPlane)
          .normalize();

        // Build a basis matrix: right = X, up = Y, forwardOnPlane = Z
        this.tempBasisMatrix.makeBasis(
          this.tempRight,
          up,
          this.tempForwardOnPlane,
        );
        this.tempDesiredWorldQuat.setFromRotationMatrix(this.tempBasisMatrix);

        // Convert desired world quat to foot's local quat:
        // local = parent_world^-1 * desired_world
        if (foot.parent) {
          foot.parent.getWorldQuaternion(this.tempFootParentWorldQuat);
          foot.quaternion
            .copy(this.tempFootParentWorldQuat)
            .invert()
            .multiply(this.tempDesiredWorldQuat);
        } else {
          foot.quaternion.copy(this.tempDesiredWorldQuat);
        }
        foot.updateMatrixWorld(true);
      }
      // Degenerate case: footForward parallel to groundNormal - skip alignment
    }

    if (weight < 1) {
      // Weight blending: slerp from original rotation toward the solved
      // rotation. Save the solved rotations first - otherwise restoring
      // origHipQuat into hip.quaternion and then slerping toward
      // hip.quaternion would self-slerp and silently discard the solve.
      //
      // The foot must be blended alongside hip and knee. Otherwise during
      // FootPlanter contact blend ramps (weight < 1), the foot would snap
      // to fully-aligned while the rest of the leg is partially blended -
      // producing a visible kink at the ankle.
      this.tempSolvedHip.copy(hip.quaternion);
      this.tempSolvedKnee.copy(knee.quaternion);
      this.tempSolvedFoot.copy(foot.quaternion);
      hip.quaternion.copy(this.tempOrigHipQuat).slerp(this.tempSolvedHip, weight);
      knee.quaternion
        .copy(this.tempOrigKneeQuat)
        .slerp(this.tempSolvedKnee, weight);
      foot.quaternion
        .copy(this.tempOrigFootQuat)
        .slerp(this.tempSolvedFoot, weight);
      hip.updateMatrixWorld(true);
      knee.updateMatrixWorld(true);
      foot.updateMatrixWorld(true);
    }
  }
}
