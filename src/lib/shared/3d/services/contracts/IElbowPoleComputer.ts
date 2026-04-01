/**
 * IElbowPoleComputer
 *
 * Computes the optimal elbow bend direction (pole vector) for IK solving.
 * The pole vector tells the IK solver which way the elbow should point,
 * preventing arms from clipping through the torso.
 *
 * Pure function. No state. Each call is independent.
 */

import type { Vector3 } from "three";
import type { Plane } from "../../domain/enums/Plane";

export interface IElbowPoleComputer {
  /**
   * Compute the pole vector for one arm's IK solve.
   *
   * @param handTarget - Where the hand needs to be (world space)
   * @param plane - Which plane the prop is operating on (wall, wheel, floor)
   * @param side - Which arm ("left" or "right")
   * @param bodyCenter - Avatar's torso center position (world space)
   * @returns Normalized direction vector for elbow bend
   */
  computePoleVector(
    handTarget: Vector3,
    plane: Plane,
    side: "left" | "right",
    bodyCenter: Vector3
  ): Vector3;
}
