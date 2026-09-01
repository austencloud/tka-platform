/**
 * StanceOptimizer
 *
 * Given a pose (which says where the hands need to go) and access to a
 * simulator, find the stance parameters (foot offset, root yaw, spine
 * pitch) that minimize a loss function combining reachability, collision
 * depth, balance, and joint comfort.
 *
 * The optimizer is gradient-free - it uses coordinate descent with an
 * adaptive step size, which works well for the 4-dimensional search
 * space and doesn't need differentiable physics.
 *
 * Domain: Collision Lab - automated stance search
 */

import type { Vector3 } from "three";
import type { StancePose } from "../domain/types";

/**
 * The pose targets the optimizer is trying to satisfy. This is a subset
 * of the full PoseDefinition - the optimizer only needs to know where the
 * hands must land, not which enum values represent them.
 */
export interface OptimizerInput {
  left: SimPropTarget;
  right: SimPropTarget;
}

/** Sweep variant of OptimizerInput: each hand is a sequence of staff instants. */
export interface OptimizerSweepInput {
  left: SimPropTarget[];
  right: SimPropTarget[];
}

/** Hard bounds on each stance parameter. */
export interface OptimizerBounds {
  footOffsetX: { min: number; max: number };
  footOffsetZ: { min: number; max: number };
  rootYawRad: { min: number; max: number };
  spinePitchRad: { min: number; max: number };
  torsoTwistRad: { min: number; max: number };
}

/** Result of a full optimization run. */
export interface OptimizerResult {
  /** The best stance found. */
  stance: StancePose;
  /** Scalar loss of that stance (lower is better). */
  loss: number;
  /** The raw sim result for the best stance - lets the UI show
   *  reachability / collision details without re-running the sim. */
  simResult: SimResult;
  /** Number of evaluations actually performed. Useful for perf tuning. */
  evaluations: number;
  /** Whether the best stance is considered feasible by the simulator
   *  (reachable + clear + balanced + comfortable). */
  feasible: boolean;
}

/**
 * StanceSimulator
 *
 * Pure-JS kinematic model of an upper body + two arms. Given a stance
 * (foot offset, root yaw, spine pitch) and two prop grip targets in world
 * space, it figures out where every relevant joint lands, whether the
 * hands can physically reach the props, whether the resulting configuration
 * clips through itself, whether the center of mass stays over the feet,
 * and how comfortable the joint angles are.
 *
 * This exists because the StanceOptimizer needs to evaluate many candidate
 * stances per pose (dozens to hundreds). Mutating the live Three.js rig for
 * each candidate is expensive and clobbers the scene graph for rendering.
 * A pure math model is order-of-magnitude faster and has zero side effects,
 * so we can run it hundreds of times per frame without dropping frames.
 *
 * The simulator is a deliberate approximation of the live CollisionDetector.
 * It uses the same sphere + line-segment primitives with the same radii so
 * its "clear" answer agrees with what the reviewer will see in the 3D viewport.
 *
 * Domain: Collision Lab - automated stance search
 */

/**
 * The physical dimensions of the avatar's upper body in rest pose. All
 * positions are in the avatar's LOCAL frame where:
 *   - Hips sit at the origin
 *   - +Y is up (head direction)
 *   - +Z is forward (facing direction)
 *   - +X is the character's left (matches Mixamo rest pose convention)
 *
 * The simulator takes these at construction, snapshotted from a loaded
 * Mixamo skeleton or supplied as anthropometric constants.
 */
export interface RestPoseGeometry {
  /** Local Y of the hips bone - usually 0 since we anchor here. */
  hipsY: number;
  /** Local position of Spine1 relative to hips. The spine pitch rotates
   *  everything above this joint forward. */
  spine1: Vector3;
  /** Local position of Spine2 relative to hips. */
  spine2: Vector3;
  /** Local position of the Neck joint relative to hips. */
  neck: Vector3;
  /** Local position of the Head bone (base of skull) relative to hips. */
  head: Vector3;
  /** Local position of the left shoulder relative to hips. */
  leftShoulder: Vector3;
  /** Local position of the right shoulder relative to hips. */
  rightShoulder: Vector3;
  /** Upper arm length in meters (shoulder to elbow). */
  upperArmLength: number;
  /** Forearm length in meters (elbow to hand). */
  forearmLength: number;
  /** Lateral foot half-offset in rest stance - half the distance between
   *  feet along the X axis in local frame. Used for the balance check. */
  footHalfWidth: number;
  /** Radius of the head bounding sphere. */
  headRadius: number;
  /** Radius of the torso bounding sphere (one per spine point). Legacy
   *  isotropic radius; used as the default for the oriented-slab half-axes
   *  below when those are not supplied. */
  torsoRadius: number;
  /**
   * Oriented-slab torso half-axes (meters). The torso is modeled as an
   * ellipsoid per spine point, oriented by the shoulder basis:
   *   - torsoHalfWidth  along the shoulder (right) axis — the WIDE dimension
   *   - torsoHalfDepth  along the body forward axis — the THIN dimension
   *   - torsoHalfHeight along up — sized so consecutive spine points tile
   * Turning the torso edge-on presents torsoHalfDepth to the prop, so a staff
   * that a face-on torso would clip slips past. Optional: when absent the
   * simulator falls back to the isotropic `torsoRadius` (old behavior).
   */
  torsoHalfWidth?: number;
  torsoHalfDepth?: number;
  torsoHalfHeight?: number;
  /** Radius of the arm (upper/forearm) collision cylinders. */
  armRadius: number;
}

/**
 * The target the simulator is asked to reach. Each prop is represented as
 * both a grip point (where the hand needs to be) and a shaft line (for
 * prop-through-body collision checks).
 */
export interface SimPropTarget {
  /** World position of the prop's grip center (the hand target). */
  gripWorld: Vector3;
  /** World position of one end of the staff shaft. */
  tipAWorld: Vector3;
  /** World position of the other end of the staff shaft. */
  tipBWorld: Vector3;
  /** Collision radius of the staff (half its thickness). */
  radius: number;
}

/** A single collision reported by the simulator. */
export interface SimCollision {
  /** Human-readable zone name - same vocabulary as CollisionDetector. */
  zone:
    | "prop-through-head"
    | "prop-through-torso"
    | "prop-through-arm"
    | "prop-through-prop"
    | "arm-through-face"
    | "arm-through-neck"
    | "arm-through-torso"
    | "arms-through-each-other";
  /** Penetration depth in meters (positive = overlapping). */
  depth: number;
  /** Short description for logging. */
  description: string;
}

/**
 * Complete outcome of one simulation. The optimizer uses every field to
 * compute a scalar loss, but exposing them individually means the UI can
 * show the reviewer WHY a stance scored the way it did.
 */
export interface SimResult {
  /** Signed reach shortfall in meters for each hand. Positive = hand
   *  cannot reach the prop, zero = exactly on target, negative = target
   *  is inside the arm's reach envelope (always 0 in practice because
   *  the hand will just be placed at the target). */
  reachShortfall: { left: number; right: number };
  /** Distance the shoulder travels from its rest position just to reach
   *  the target. High values mean the arm is maxed out and the pose is
   *  uncomfortable even if reachable. */
  reachStretch: { left: number; right: number };
  /** All detected self-collisions under this stance. */
  collisions: SimCollision[];
  /** Distance from the center-of-mass projection to the edge of the
   *  base of support. Negative = CoM is outside the feet and the pose
   *  is not balanceable; positive = how much margin there is. */
  balanceMargin: number;
  /** Sum of any joint limit violations in radians (elbow hyperextension,
   *  shoulder past its flexion range, etc.). Zero = all joints comfortable. */
  jointViolationRad: number;
  /** Convenience: has any fatal issue (unreachable, unbalanced, or
   *  hyperextended)? The optimizer uses this to disqualify candidates
   *  even if their numeric loss happens to be low. */
  feasible: boolean;
  /** Convenience: sum of all penetration depths. */
  totalCollisionDepth: number;
}

/**
 * The top-level contract. Consumers call `evaluate` with a stance and two
 * prop targets and get back a SimResult they can use to decide if the
 * stance is acceptable.
 */
