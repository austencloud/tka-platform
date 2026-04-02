/**
 * IClavicleRaiser
 *
 * Computes how much to elevate the clavicle (shoulder) bone based on
 * how high the hand is reaching. When you raise your arm above your
 * shoulder, your collarbone tilts upward to give your arm more reach.
 * Without this, the avatar looks stiff during overhead positions.
 *
 * Based on scapulohumeral rhythm: the clavicle contributes ~15° of
 * elevation during full arm abduction, activating after the arm passes
 * about 30° above horizontal (the "setting phase" where the shoulder
 * barely moves).
 *
 * Pure function. No state. Each call is independent.
 */

import type { Vector3, Quaternion } from "three";

export interface IClavicleRaiser {
  computeClavicleRotation(
    handTarget: Vector3,
    side: "left" | "right",
    shoulderRestY: number,
    armLength: number
  ): Quaternion;
}
