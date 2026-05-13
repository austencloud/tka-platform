/**
 * PropStateInterpolator Implementation
 *
 * Calculates PropState3D from MotionConfig3D and progress (0-1).
 * Handles all motion types and plane transformations.
 */

import type { Vector3 } from "three";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { LOCATION_ANGLES } from "$lib/shared/foundation/domain/math-constants";
import type { PropState3D } from "@austencloud/scene-3d";
import type { MotionConfig3D } from "../../domain/models/MotionData3D";
import {
  planeAngleToWorldPosition,
  calculatePropQuaternion,
  GRID_RADIUS_3D,
} from "../../domain/constants/plane-transforms";
import type { AngleMathCalculatorAPI } from "../angle-math-calculator";
import type { OrientationMapperAPI } from "../orientation-mapper";
import type { MotionCalculator } from "./MotionCalculator";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

export class PropStateInterpolator {
  constructor(
    private angleMath: AngleMathCalculatorAPI,
    private orientationService: OrientationMapperAPI,
    private motionCalculator: MotionCalculator
  ) {}

  /**
   * Interpolate center path angle (position on grid)
   *
   * IMPORTANT: Center path ALWAYS uses shortest path interpolation!
   * The rotation direction only affects STAFF rotation, not position.
   */
  private interpolateCenterPath(
    startAngle: number,
    endAngle: number,
    progress: number
  ): number {
    return this.angleMath.lerpAngle(startAngle, endAngle, progress);
  }

  /**
   * Interpolate DASH motion in Cartesian space
   *
   * DASH motions move in a straight line through the center.
   * The radius varies - at midpoint of N→S dash, prop passes through center.
   */
  private interpolateDashPosition(
    config: MotionConfig3D,
    startAngle: number,
    endAngle: number,
    progress: number
  ): { worldPosition: Vector3; centerPathAngle: number } {
    // Convert to Cartesian coordinates (unit circle)
    const startX = Math.cos(startAngle);
    const startY = Math.sin(startAngle);
    const endX = Math.cos(endAngle);
    const endY = Math.sin(endAngle);

    // Linear interpolation in Cartesian space (straight line through center)
    const currentX = this.angleMath.lerp(startX, endX, progress);
    const currentY = this.angleMath.lerp(startY, endY, progress);

    // Calculate distance from center (varies during dash!)
    const radius = Math.sqrt(currentX * currentX + currentY * currentY);

    // Calculate angle (for state tracking)
    const centerPathAngle = Math.atan2(currentY, currentX);

    // Convert to world position with interpolated radius
    const worldPosition = planeAngleToWorldPosition(
      config.plane,
      centerPathAngle,
      radius * GRID_RADIUS_3D
    );

    return { worldPosition, centerPathAngle };
  }

  private resolvePathType(motionType: MotionType, motionPathShape?: "arc" | "linear" | "concave"): "arc" | "linear" | "concave" {
    if (motionPathShape) return motionPathShape;
    if (motionType === MotionType.DASH) return "linear";
    if (motionType === MotionType.STATIC) return "arc";

    const vm = getAnimationVisibilityManager();
    if (vm.getMotionAwarePaths()) {
      if (motionType === MotionType.PRO) return "arc";
      if (motionType === MotionType.ANTI) return "concave";
    }
    return vm.getPathShape();
  }

  /**
   * Concave path: reflection of the arc path across the straight line.
   */
  private interpolateConcavePosition(
    config: MotionConfig3D,
    startAngle: number,
    endAngle: number,
    progress: number
  ): { worldPosition: Vector3; centerPathAngle: number } {
    // Circle point (arc path)
    const arcAngle = this.angleMath.lerpAngle(startAngle, endAngle, progress);
    const circleX = Math.cos(arcAngle);
    const circleY = Math.sin(arcAngle);

    // Straight line point
    const startX = Math.cos(startAngle);
    const startY = Math.sin(startAngle);
    const endX = Math.cos(endAngle);
    const endY = Math.sin(endAngle);
    const straightX = this.angleMath.lerp(startX, endX, progress);
    const straightY = this.angleMath.lerp(startY, endY, progress);

    // Reflect circle across straight line
    const concaveX = 2 * straightX - circleX;
    const concaveY = 2 * straightY - circleY;

    const radius = Math.sqrt(concaveX * concaveX + concaveY * concaveY);
    const centerPathAngle = Math.atan2(concaveY, concaveX);

    const worldPosition = planeAngleToWorldPosition(
      config.plane,
      centerPathAngle,
      radius * GRID_RADIUS_3D
    );

    return { worldPosition, centerPathAngle };
  }

  /**
   * Calculate PropState3D from config and progress
   */
  calculatePropState(config: MotionConfig3D, progress: number): PropState3D {
    // Get start/end center angles from grid locations
    const startCenterAngle = LOCATION_ANGLES[config.startLocation] ?? 0;
    const endCenterAngle = LOCATION_ANGLES[config.endLocation] ?? 0;

    // Calculate start staff angle from orientation
    const startStaffAngle = this.orientationService.mapOrientationToAngle(
      config.startOrientation,
      startCenterAngle
    );

    // Calculate target staff angle based on motion type
    const targetStaffAngle = this.motionCalculator.calculateTargetStaffAngle(
      config,
      startStaffAngle,
      startCenterAngle,
      endCenterAngle
    );

    // Interpolate staff rotation:
    // - For motions WITH turns (pro/anti/etc), use raw delta to preserve full rotation count
    // - For motions WITHOUT turns (dash t=0, static, float), use shortest-path to avoid
    //   phantom full rotations from equivalent angles (e.g., 2π vs 0)
    const hasTurns = config.turns > 0;
    const staffRotationAngle = hasTurns
      ? this.angleMath.normalizeAngle(
          startStaffAngle + (targetStaffAngle - startStaffAngle) * progress
        )
      : this.angleMath.lerpAngle(startStaffAngle, targetStaffAngle, progress);

    // Calculate 3D rotation. Use rotationPlane when specified (dual-wheel mode
    // uses WALL rotation to avoid double-rotating with the facing angle).
    const worldRotation = calculatePropQuaternion(
      config.rotationPlane ?? config.plane,
      staffRotationAngle
    );

    const pathType = this.resolvePathType(config.motionType, config.pathShape);

    let result: PropState3D;

    if (pathType === "linear") {
      const { worldPosition, centerPathAngle } = this.interpolateDashPosition(
        config,
        startCenterAngle,
        endCenterAngle,
        progress
      );

      result = {
        plane: config.plane,
        centerPathAngle,
        staffRotationAngle,
        worldPosition,
        worldRotation,
      };
    } else if (pathType === "concave") {
      const { worldPosition, centerPathAngle } = this.interpolateConcavePosition(
        config,
        startCenterAngle,
        endCenterAngle,
        progress
      );

      result = {
        plane: config.plane,
        centerPathAngle,
        staffRotationAngle,
        worldPosition,
        worldRotation,
      };
    } else {
      const centerPathAngle = this.interpolateCenterPath(
        startCenterAngle,
        endCenterAngle,
        progress
      );

      const worldPosition = planeAngleToWorldPosition(
        config.plane,
        centerPathAngle,
        GRID_RADIUS_3D
      );

      result = {
        plane: config.plane,
        centerPathAngle,
        staffRotationAngle,
        worldPosition,
        worldRotation,
      };
    }

    return result;
  }
}
