/**
 * MotionCalculator Implementation
 *
 * Calculates target staff angles based on motion type.
 * Matches the 2D EndpointCalculator logic for consistency.
 */

import {
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionConfig3D } from "../../domain/models/MotionData3D";
import type { IMotionCalculator } from "../contracts/IMotionCalculator";
import type { AngleMathCalculator } from "./AngleMathCalculator";
import type { OrientationMapper } from "./OrientationMapper";

const PI = Math.PI;

export class MotionCalculator implements IMotionCalculator {
  constructor(
    private angleMath: AngleMathCalculator,
    private orientationService: OrientationMapper
  ) {}

  /**
   * Calculate target staff angle based on motion type
   *
   * IMPORTANT: This must match the 2D EndpointCalculator logic:
   * - dir = CCW ? -1 : 1 (not inverted!)
   * - centerMovement uses normalizeAngleSigned for shortest path
   */
  calculateTargetStaffAngle(
    config: MotionConfig3D,
    startStaffAngle: number,
    startCenterAngle: number,
    endCenterAngle: number
  ): number {
    // Normalize center movement to signed range for shortest path (matches 2D)
    const centerMovement = this.angleMath.normalizeAngleSigned(
      endCenterAngle - startCenterAngle
    );

    // Calculate prop rotation from turns
    // CRITICAL: Sign convention matches 2D EndpointCalculator:
    // - CCW = -1 (counter-clockwise is negative in canvas coords)
    // - CW = +1 (clockwise is positive)
    const dir =
      config.rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
    const propRotation = dir * config.turns * PI;

    switch (config.motionType) {
      case MotionType.PRO:
        // PRO: staff moves WITH grid movement + prop rotation
        return startStaffAngle + centerMovement + propRotation;

      case MotionType.ANTI:
        // ANTI: staff moves OPPOSITE to grid movement + prop rotation
        return startStaffAngle - centerMovement + propRotation;

      case MotionType.STATIC:
        // STATIC with turns: rotation only from turns
        // STATIC without turns: use end orientation
        return config.turns > 0
          ? startStaffAngle + propRotation
          : this.orientationService.mapOrientationToAngle(
              config.endOrientation,
              endCenterAngle
            );

      case MotionType.DASH:
        // DASH with turns: rotation only from turns
        // DASH without turns: use end orientation
        return config.turns > 0
          ? startStaffAngle + propRotation
          : this.orientationService.mapOrientationToAngle(
              config.endOrientation,
              endCenterAngle
            );

      case MotionType.FLOAT:
        // FLOAT: no rotation change
        return startStaffAngle;

      default:
        return startStaffAngle;
    }
  }
}
