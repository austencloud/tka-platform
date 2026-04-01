/**
 * ElbowPoleComputer
 *
 * Computes where the elbow should point based on which plane the prop
 * is moving on and where the hand is relative to the body. This prevents
 * the avatar's arms from clipping through the torso.
 *
 * Think of it like this: when you spin a staff on the wall plane (in front
 * of you), your elbows naturally point forward. When spinning on the wheel
 * plane (beside you, like a cartwheel), your elbows point outward to the
 * sides. This service encodes that natural body awareness.
 */

import { Vector3 } from "three";
import type { IElbowPoleComputer } from "../contracts/IElbowPoleComputer";
import { Plane } from "../../domain/enums/Plane";

/**
 * Half the shoulder span in meters. Used to normalize cross-body
 * distances to a 0-1 range so the correction scales proportionally
 * to the body's actual width.
 */
const SHOULDER_HALF_WIDTH = 0.2;

export class ElbowPoleComputer implements IElbowPoleComputer {
  computePoleVector(
    handTarget: Vector3,
    plane: Plane,
    side: "left" | "right",
    bodyCenter: Vector3
  ): Vector3 {
    switch (plane) {
      case Plane.WALL:
        return this.computeWallPole(handTarget, side, bodyCenter);
      case Plane.WHEEL:
        return this.computeWheelPole(handTarget, side, bodyCenter);
      case Plane.FLOOR:
        return this.computeFloorPole(handTarget, side, bodyCenter);
      default:
        // Exhaustiveness safety net — all Plane enum values are handled above
        return new Vector3(0, 0, 1);
    }
  }

  /**
   * Wall plane (XY): props move on the vertical plane facing the audience.
   * Base direction: forward (+Z, toward the viewer).
   *
   * When the hand crosses the body's centerline, we push the elbow
   * forward more aggressively so the arm goes in front of the chest
   * instead of through it. When the hand is low (south positions),
   * we add a slight outward bias so the elbows don't pinch inward.
   */
  private computeWallPole(
    handTarget: Vector3,
    side: "left" | "right",
    bodyCenter: Vector3
  ): Vector3 {
    const pole = new Vector3(0, 0, 1); // Base: forward

    const localX = handTarget.x - bodyCenter.x;
    const localY = handTarget.y - bodyCenter.y;

    // sideSign: +1 for left arm (skeleton left = +X), -1 for right arm
    const sideSign = side === "left" ? 1 : -1;

    // Cross-body factor: high when hand is on the wrong side
    // Left arm's "wrong side" is -X, right arm's is +X
    const crossBody = Math.max(0, Math.min(1,
      (-localX * sideSign) / SHOULDER_HALF_WIDTH
    ));
    pole.z += crossBody * 0.8;

    // Low position: add outward X bias to prevent elbow pinch
    const lowFactor = Math.max(0, Math.min(1, -localY * 2));
    pole.x += sideSign * lowFactor * 0.3;

    // Overhead: slight downward bias for natural raised-arm pose
    const highFactor = Math.max(0, Math.min(1, (localY - 0.5) * 2));
    pole.y -= highFactor * 0.2;

    return pole.normalize();
  }

  /**
   * Wheel plane (YZ): props move on the vertical plane perpendicular
   * to the audience (like a cartwheel beside the body).
   * Base direction: outward laterally (away from the body center).
   *
   * When the hand is in front of or behind the body, we add a vertical
   * bias so the elbow doesn't collide with the torso's side.
   */
  private computeWheelPole(
    handTarget: Vector3,
    side: "left" | "right",
    bodyCenter: Vector3
  ): Vector3 {
    // Left arm outward = +X, right arm outward = -X
    const outwardSign = side === "left" ? 1 : -1;
    const pole = new Vector3(outwardSign, 0, 0); // Base: lateral outward

    const localZ = handTarget.z - bodyCenter.z;
    const localY = handTarget.y - bodyCenter.y;

    // Forward/back adjustment: add upward bias when hand is in front/behind
    const depthFactor = Math.min(1, Math.abs(localZ) / SHOULDER_HALF_WIDTH);
    pole.y += depthFactor * 0.3;

    // Low position: increase outward bias
    const lowFactor = Math.max(0, Math.min(1, -localY * 2));
    pole.x += outwardSign * lowFactor * 0.2;

    return pole.normalize();
  }

  /**
   * Floor plane (XZ): props move on the horizontal plane at roughly
   * waist/chest height (like spinning a plate on a table).
   * Base direction: upward (+Y, elbows point to the ceiling).
   *
   * When the hand is near the body center on the horizontal plane,
   * we add outward X bias so the elbow doesn't drop into the torso.
   */
  private computeFloorPole(
    handTarget: Vector3,
    side: "left" | "right",
    bodyCenter: Vector3
  ): Vector3 {
    const pole = new Vector3(0, 1, 0); // Base: upward

    const localX = handTarget.x - bodyCenter.x;
    const localZ = handTarget.z - bodyCenter.z;

    // How close is the hand to body center on the horizontal plane?
    const horizontalDist = Math.sqrt(localX * localX + localZ * localZ);
    const centerProximity = Math.max(0, Math.min(1,
      1 - horizontalDist / SHOULDER_HALF_WIDTH
    ));

    // Near center: push elbow outward
    const outwardSign = side === "left" ? 1 : -1;
    pole.x += outwardSign * centerProximity * 0.5;

    // Also add a slight forward bias to avoid degenerate cases
    // when hand is directly above (pole parallel to target direction)
    pole.z += 0.15;

    return pole.normalize();
  }
}
