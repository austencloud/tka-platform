/**
 * Prop state interpolator — calculates PropState3D from MotionConfig3D and
 * progress [0-1]. Handles all motion types and plane transformations.
 */

import type { Vector3 } from "three";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { LOCATION_ANGLES } from "$lib/shared/foundation/domain/math-constants";
import type { PropState3D } from "@austencloud/scene-3d";
import type { MotionConfig3D } from "../domain/models/MotionData3D";
import {
  planeAngleToWorldPosition,
  calculatePropQuaternion,
  GRID_RADIUS_3D,
} from "../domain/constants/plane-transforms";
import {
  normalizeAngle,
  lerpAngle,
  lerp,
} from "./angle-math-calculator";
import { mapOrientationToAngle } from "./orientation-mapper";
import { calculateTargetStaffAngle } from "./motion-calculator";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

/**
 * Interpolate center path angle (position on grid).
 * Center path ALWAYS uses shortest-path interpolation.
 */
function interpolateCenterPath(
  startAngle: number,
  endAngle: number,
  progress: number
): number {
  return lerpAngle(startAngle, endAngle, progress);
}

/**
 * Interpolate DASH motion in Cartesian space (straight line through center).
 */
function interpolateDashPosition(
  config: MotionConfig3D,
  startAngle: number,
  endAngle: number,
  progress: number
): { worldPosition: Vector3; centerPathAngle: number } {
  const startX = Math.cos(startAngle);
  const startY = Math.sin(startAngle);
  const endX = Math.cos(endAngle);
  const endY = Math.sin(endAngle);

  const currentX = lerp(startX, endX, progress);
  const currentY = lerp(startY, endY, progress);

  const radius = Math.sqrt(currentX * currentX + currentY * currentY);
  const centerPathAngle = Math.atan2(currentY, currentX);

  const worldPosition = planeAngleToWorldPosition(
    config.plane,
    centerPathAngle,
    radius * GRID_RADIUS_3D
  );

  return { worldPosition, centerPathAngle };
}

function resolvePathType(motionType: MotionType, motionPathShape?: "arc" | "linear" | "concave"): "arc" | "linear" | "concave" {
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

function interpolateConcavePosition(
  config: MotionConfig3D,
  startAngle: number,
  endAngle: number,
  progress: number
): { worldPosition: Vector3; centerPathAngle: number } {
  const arcAngle = lerpAngle(startAngle, endAngle, progress);
  const circleX = Math.cos(arcAngle);
  const circleY = Math.sin(arcAngle);

  const startX = Math.cos(startAngle);
  const startY = Math.sin(startAngle);
  const endX = Math.cos(endAngle);
  const endY = Math.sin(endAngle);
  const straightX = lerp(startX, endX, progress);
  const straightY = lerp(startY, endY, progress);

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
 * Calculate PropState3D from config and progress.
 */
export function calculatePropState(
  config: MotionConfig3D,
  progress: number
): PropState3D {
  const startCenterAngle = LOCATION_ANGLES[config.startLocation] ?? 0;
  const endCenterAngle = LOCATION_ANGLES[config.endLocation] ?? 0;

  const startStaffAngle = mapOrientationToAngle(
    config.startOrientation,
    startCenterAngle
  );

  const targetStaffAngle = calculateTargetStaffAngle(
    config,
    startStaffAngle,
    startCenterAngle,
    endCenterAngle
  );

  const hasTurns = config.turns > 0;
  const staffRotationAngle = hasTurns
    ? normalizeAngle(
        startStaffAngle + (targetStaffAngle - startStaffAngle) * progress
      )
    : lerpAngle(startStaffAngle, targetStaffAngle, progress);

  const worldRotation = calculatePropQuaternion(
    config.rotationPlane ?? config.plane,
    staffRotationAngle
  );

  const pathType = resolvePathType(config.motionType, config.pathShape);

  if (pathType === "linear") {
    const { worldPosition, centerPathAngle } = interpolateDashPosition(
      config,
      startCenterAngle,
      endCenterAngle,
      progress
    );

    return {
      plane: config.plane,
      centerPathAngle,
      staffRotationAngle,
      worldPosition,
      worldRotation,
    };
  }

  if (pathType === "concave") {
    const { worldPosition, centerPathAngle } = interpolateConcavePosition(
      config,
      startCenterAngle,
      endCenterAngle,
      progress
    );

    return {
      plane: config.plane,
      centerPathAngle,
      staffRotationAngle,
      worldPosition,
      worldRotation,
    };
  }

  const centerPathAngle = interpolateCenterPath(
    startCenterAngle,
    endCenterAngle,
    progress
  );

  const worldPosition = planeAngleToWorldPosition(
    config.plane,
    centerPathAngle,
    GRID_RADIUS_3D
  );

  return {
    plane: config.plane,
    centerPathAngle,
    staffRotationAngle,
    worldPosition,
    worldRotation,
  };
}

/**
 * Compute the start-position PropState3D (progress = 0).
 */
export function getStartPropState(config: MotionConfig3D): PropState3D {
  return calculatePropState(config, 0);
}
