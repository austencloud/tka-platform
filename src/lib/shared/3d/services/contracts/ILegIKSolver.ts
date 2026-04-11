// src/lib/shared/3d/services/contracts/ILegIKSolver.ts

/**
 * ILegIKSolver
 *
 * Hinge-constrained two-bone IK specialized for humanoid legs.
 * Unlike the generic IIKSolver (which treats every joint as freely
 * rotating, suitable for arms), this solver constrains the knee to
 * rotate only around a single axis — the sagittal axis of the UpLeg.
 * This is what prevents the knee splay artifacts that caused
 * FootPlanter to be disabled.
 *
 * After the position solve, an optional foot rotation alignment
 * pass rotates the ankle so the sole plane matches the ground
 * normal and the toe forward vector aligns with footForward.
 *
 * The solver is stateless: same input always returns same result.
 */

import { Vector3 } from "three";
import type { BoneChain } from "./IAvatarSkeletonBuilder";

export interface LegIKInput {
  /** The leg chain: UpLeg -> Leg -> Foot */
  chain: BoneChain;
  /** World-space target position for the foot bone */
  footTarget: Vector3;
  /** Ground normal at the target (for foot rotation alignment).
   *  Usually (0, 1, 0). */
  groundNormal: Vector3;
  /** Forward direction the foot should face (for toe alignment).
   *  Usually the avatar's facing direction. */
  footForward: Vector3;
  /** Sagittal hinge axis in UpLeg local space.
   *  Derived at skeleton-build time from the cross product of the
   *  rest-pose UpLeg direction and the rest-pose Leg direction —
   *  that gives the axis perpendicular to the natural bend plane. */
  kneeHingeAxis: Vector3;
  /** Forward vector biasing the knee bend direction. Prevents the
   *  knee from flipping backward when the target is directly below. */
  poleDirection: Vector3;
  /** Blend weight 0-1 (0 = leave bones untouched, 1 = fully IK pose) */
  weight: number;
}

export interface ILegIKSolver {
  /**
   * Solve leg IK in place — modifies the bones in `input.chain`
   * to satisfy the target within the hinge constraint.
   *
   * Stateless: same input produces same output, no internal memory.
   */
  solve(input: LegIKInput): void;
}
