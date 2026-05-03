/**
 * ICollisionDetector
 *
 * Detects when props or limbs clip through the avatar's body.
 * Logs collisions per frame so we can build a dataset of danger zones
 * and eventually author safe poses to avoid them.
 *
 * Domain: 3D - Collision Avoidance
 */

import type { Vector3, Bone } from "three";

/** Which body part the collision involves */
export type CollisionZone =
  | "prop-through-head"
  | "prop-through-torso"
  | "prop-through-arm"
  | "prop-through-prop"
  | "arm-through-face"
  | "arms-through-each-other";

/**
 * A prop represented as a line segment between its two endpoints.
 * For a staff, this is tip-to-tip (~1 m). Point-based detection misses
 * the common case where the grip is outside the body but the staff
 * shaft passes straight through it.
 */
export interface PropSegment {
  /** One end of the prop (world space). */
  a: Vector3;
  /** Other end of the prop (world space). */
  b: Vector3;
  /** Radius of the prop for collision purposes (staff thickness). */
  radius: number;
}

/** How bad the violation is */
export type CollisionSeverity = "graze" | "clip" | "penetrate";

/** A single detected collision event */
export interface CollisionEvent {
  zone: CollisionZone;
  severity: CollisionSeverity;
  /** Which beat index this occurred on */
  stepNumber: number;
  /** 0-1 progress within the beat */
  beatProgress: number;
  /** Distance between the two colliding elements (meters). Positive = penetrating. */
  penetrationDepth: number;
  /** Description for the console log */
  description: string;
}

/** Bone positions snapshot needed for collision checks */
export interface BodySnapshot {
  /**
   * Raw head bone (Mixamo `Head`) world position. Note this sits at the
   * base of the skull under the chin, NOT at the visual face center.
   * For head/face collision checks, use `face` instead.
   */
  head: Vector3;
  /**
   * Derived face sphere center: the head bone offset forward + up so the
   * collision sphere sits where the actual face is. Computed by the caller
   * from the avatar's shoulder line so it rotates correctly with the body.
   */
  face: Vector3;
  neck: Vector3;
  spine2: Vector3;
  spine1: Vector3;
  hips: Vector3;
  leftShoulder: Vector3;
  rightShoulder: Vector3;
  leftElbow: Vector3;
  rightElbow: Vector3;
  leftHand: Vector3;
  rightHand: Vector3;
}

// ICollisionDetector interface retired — CollisionDetector class is the contract now.
