/**
 * IIKSolver
 *
 * Inverse Kinematics solver for positioning end effectors.
 * Supports multiple IK algorithms and constraint systems.
 */

import type { Vector3, Quaternion } from "three";
import type { BoneChain } from "./IAvatarSkeletonBuilder";

/**
 * IK solving algorithm
 */
export type IKAlgorithm =
  /** Simple 2-bone analytic solver (fast, exact for 2 bones) */
  | "analytic"
  /** Cyclic Coordinate Descent (iterative, any chain length) */
  | "ccd"
  /** Forward And Backward Reaching IK (smooth, natural motion) */
  | "fabrik";

/**
 * Joint constraints for limiting rotation
 */
export interface JointConstraints {
  /** Minimum rotation around local X axis (radians) */
  minX?: number;
  /** Maximum rotation around local X axis (radians) */
  maxX?: number;
  /** Minimum rotation around local Y axis (radians) */
  minY?: number;
  /** Maximum rotation around local Y axis (radians) */
  maxY?: number;
  /** Minimum rotation around local Z axis (radians) */
  minZ?: number;
  /** Maximum rotation around local Z axis (radians) */
  maxZ?: number;
  /** Preferred bend direction (for elbows/knees) */
  poleVector?: Vector3;
}

/**
 * IK target specification
 */
export interface IKTarget {
  /** Target position in world space */
  position: Vector3;
  /** Optional target rotation for the end effector */
  rotation?: Quaternion;
  /** Blend weight (0-1) for this target */
  weight?: number;
  /** Preferred elbow bend direction. If absent, defaults to (0, 0, -1). */
  poleHint?: Vector3;
}

/**
 * Result of an IK solve
 */
export interface IKSolution {
  /** Whether a valid solution was found */
  success: boolean;
  /** Number of iterations used (for iterative solvers) */
  iterations: number;
  /** Final distance from target */
  error: number;
  /** Computed rotations for each bone in the chain */
  rotations: Quaternion[];
}

/**
 * Pre-defined constraint sets for common joints
 */
export interface HumanoidConstraints {
  leftElbow: JointConstraints;
  rightElbow: JointConstraints;
  leftShoulder: JointConstraints;
  rightShoulder: JointConstraints;
  leftKnee: JointConstraints;
  rightKnee: JointConstraints;
}

export interface IIKSolver {
  /**
   * Solve IK for a bone chain to reach a target
   * @param chain The bone chain to solve
   * @param target The target to reach
   * @param algorithm Which IK algorithm to use
   * @param constraints Optional joint constraints
   * @returns The IK solution
   */
  solve(
    chain: BoneChain,
    target: IKTarget,
    algorithm?: IKAlgorithm,
    constraints?: JointConstraints[]
  ): IKSolution;

  /**
   * Solve and apply IK to the bones immediately
   * @param chain The bone chain
   * @param target The target position
   * @param constraints Optional constraints
   */
  solveAndApply(
    chain: BoneChain,
    target: IKTarget,
    constraints?: JointConstraints[]
  ): void;

  /**
   * Two-bone analytic solver (for arms/legs)
   * Fastest option when you have exactly 2 bones.
   */
  solveTwoBone(
    chain: BoneChain,
    target: Vector3,
    poleHint: Vector3
  ): IKSolution;

  /**
   * Get default humanoid constraints
   */
  getHumanoidConstraints(): HumanoidConstraints;

  /**
   * Set the maximum iterations for iterative solvers
   */
  setMaxIterations(count: number): void;

  /**
   * Set the convergence threshold for iterative solvers
   */
  setConvergenceThreshold(threshold: number): void;
}
