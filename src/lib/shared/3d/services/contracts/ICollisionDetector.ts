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
  | "arm-through-face"
  | "arms-through-each-other";

/** How bad the violation is */
export type CollisionSeverity = "graze" | "clip" | "penetrate";

/** A single detected collision event */
export interface CollisionEvent {
  zone: CollisionZone;
  severity: CollisionSeverity;
  /** Which beat index this occurred on */
  beatIndex: number;
  /** 0-1 progress within the beat */
  beatProgress: number;
  /** Distance between the two colliding elements (meters). Positive = penetrating. */
  penetrationDepth: number;
  /** Description for the console log */
  description: string;
}

/** Bone positions snapshot needed for collision checks */
export interface BodySnapshot {
  head: Vector3;
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

export interface ICollisionDetector {
  /**
   * Run all collision checks for the current frame.
   * Call after IK has been applied (bones are at final positions).
   */
  detect(
    body: BodySnapshot,
    bluePropPos: Vector3 | null,
    redPropPos: Vector3 | null,
    beatIndex: number,
    beatProgress: number
  ): CollisionEvent[];

  /** Whether detection is enabled (toggle via console for perf) */
  enabled: boolean;
}
