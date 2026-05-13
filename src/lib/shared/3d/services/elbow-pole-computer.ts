/**
 * ElbowPoleComputer
 *
 * Computes where the elbow should point based on which plane the prop
 * is moving on and where the hand is relative to the body.
 */

import { Vector3 } from "three";
import { Plane } from "@austencloud/scene-3d";

const SHOULDER_HALF_WIDTH = 0.2;

function computeWallPole(
  handTarget: Vector3,
  side: "left" | "right",
  bodyCenter: Vector3,
): Vector3 {
  const pole = new Vector3(0, 0, 1);

  const localX = handTarget.x - bodyCenter.x;
  const localY = handTarget.y - bodyCenter.y;

  const sideSign = side === "left" ? -1 : 1;

  const crossBody = Math.max(0, Math.min(1, (-localX * sideSign) / SHOULDER_HALF_WIDTH));
  pole.z += crossBody * 0.8;

  const lowFactor = Math.max(0, Math.min(1, -localY * 2));
  pole.x += sideSign * lowFactor * 0.3;

  const highFactor = Math.max(0, Math.min(1, (localY - 0.5) * 2));
  pole.y -= highFactor * 0.2;

  return pole.normalize();
}

function computeWheelPole(
  handTarget: Vector3,
  side: "left" | "right",
  bodyCenter: Vector3,
): Vector3 {
  const outwardSign = side === "left" ? -1 : 1;
  const pole = new Vector3(outwardSign, 0, 0);

  const localZ = handTarget.z - bodyCenter.z;
  const localY = handTarget.y - bodyCenter.y;

  const depthFactor = Math.min(1, Math.abs(localZ) / SHOULDER_HALF_WIDTH);
  pole.y += depthFactor * 0.3;

  const lowFactor = Math.max(0, Math.min(1, -localY * 2));
  pole.x += outwardSign * lowFactor * 0.2;

  return pole.normalize();
}

function computeFloorPole(
  handTarget: Vector3,
  side: "left" | "right",
  bodyCenter: Vector3,
): Vector3 {
  const pole = new Vector3(0, 1, 0);

  const localX = handTarget.x - bodyCenter.x;
  const localZ = handTarget.z - bodyCenter.z;

  const horizontalDist = Math.sqrt(localX * localX + localZ * localZ);
  const centerProximity = Math.max(0, Math.min(1, 1 - horizontalDist / SHOULDER_HALF_WIDTH));

  const outwardSign = side === "left" ? -1 : 1;
  pole.x += outwardSign * centerProximity * 0.5;

  pole.z += 0.15;

  return pole.normalize();
}

export function computePoleVector(
  handTarget: Vector3,
  plane: Plane,
  side: "left" | "right",
  bodyCenter: Vector3,
): Vector3 {
  switch (plane) {
    case Plane.WALL:
      return computeWallPole(handTarget, side, bodyCenter);
    case Plane.WHEEL:
      return computeWheelPole(handTarget, side, bodyCenter);
    case Plane.FLOOR:
      return computeFloorPole(handTarget, side, bodyCenter);
    default:
      return new Vector3(0, 0, 1);
  }
}
