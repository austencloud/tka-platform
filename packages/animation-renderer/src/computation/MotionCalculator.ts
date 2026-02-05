import { Orientation, RotationDirection } from "@tka/types";
import { PI } from "../domain/math-constants";
import type { IMotionCalculator } from "../contracts/IMotionCalculator";
import {
  mapOrientationToAngle,
  normalizeAnglePositive,
  normalizeAngleSigned,
} from "./AngleCalculator";

export function calculateProIsolationStaffAngle(
  centerPathAngle: number,
  _propRotDir: RotationDirection
): number {
  return normalizeAnglePositive(centerPathAngle + PI);
}

export function calculateProTargetAngle(
  startCenterAngle: number,
  targetCenterAngle: number,
  startStaffAngle: number,
  turns: number,
  rotationDirection: RotationDirection
): number {
  const centerMovement = normalizeAngleSigned(
    targetCenterAngle - startCenterAngle
  );
  const dir =
    rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
  const propRotation = dir * turns * PI;
  const staffMovement = centerMovement;
  const targetStaffAngle = startStaffAngle + staffMovement + propRotation;
  return normalizeAnglePositive(targetStaffAngle);
}

export function calculateAntispinTargetAngle(
  startCenterAngle: number,
  targetCenterAngle: number,
  startStaffAngle: number,
  turns: number,
  rotationDirection: RotationDirection
): number {
  const centerMovement = normalizeAngleSigned(
    targetCenterAngle - startCenterAngle
  );
  const dir =
    rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
  const propRotation = dir * turns * PI;
  const staffMovement = -centerMovement;
  const targetStaffAngle = startStaffAngle + staffMovement + propRotation;
  return normalizeAnglePositive(targetStaffAngle);
}

export function calculateStaticStaffAngle(
  startStaffAngle: number,
  endOrientation: Orientation,
  targetCenterAngle: number
): number {
  const endOriAngle = mapOrientationToAngle(endOrientation, targetCenterAngle);
  const angleDiff = normalizeAngleSigned(endOriAngle - startStaffAngle);
  return Math.abs(angleDiff) > 0.1 ? endOriAngle : startStaffAngle;
}

export function calculateDashTargetAngle(
  startStaffAngle: number,
  endOrientation: Orientation,
  targetCenterAngle: number,
  turns: number,
  rotationDirection: RotationDirection
): number {
  let baseAngle: number;
  if (endOrientation === Orientation.IN) {
    baseAngle = targetCenterAngle + PI;
  } else if (endOrientation === Orientation.OUT) {
    baseAngle = targetCenterAngle;
  } else {
    baseAngle = startStaffAngle;
  }

  const dir =
    rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
  const propRotation = dir * turns * PI;
  const targetStaffAngle = baseAngle + propRotation;

  return normalizeAnglePositive(targetStaffAngle);
}

export function calculateFloatStaffAngle(startStaffAngle: number): number {
  return startStaffAngle;
}

export class MotionCalculator implements IMotionCalculator {
  calculateProIsolationStaffAngle(
    centerPathAngle: number,
    propRotDir: RotationDirection
  ): number {
    return calculateProIsolationStaffAngle(centerPathAngle, propRotDir);
  }

  calculateProTargetAngle(
    startCenterAngle: number,
    targetCenterAngle: number,
    startStaffAngle: number,
    turns: number,
    rotationDirection: RotationDirection
  ): number {
    return calculateProTargetAngle(
      startCenterAngle,
      targetCenterAngle,
      startStaffAngle,
      turns,
      rotationDirection
    );
  }

  calculateAntispinTargetAngle(
    startCenterAngle: number,
    targetCenterAngle: number,
    startStaffAngle: number,
    turns: number,
    rotationDirection: RotationDirection
  ): number {
    return calculateAntispinTargetAngle(
      startCenterAngle,
      targetCenterAngle,
      startStaffAngle,
      turns,
      rotationDirection
    );
  }

  calculateStaticStaffAngle(
    startStaffAngle: number,
    endOrientation: Orientation,
    targetCenterAngle: number
  ): number {
    return calculateStaticStaffAngle(
      startStaffAngle,
      endOrientation,
      targetCenterAngle
    );
  }

  calculateDashTargetAngle(
    startStaffAngle: number,
    endOrientation: Orientation,
    targetCenterAngle: number,
    turns: number,
    rotationDirection: RotationDirection
  ): number {
    return calculateDashTargetAngle(
      startStaffAngle,
      endOrientation,
      targetCenterAngle,
      turns,
      rotationDirection
    );
  }

  calculateFloatStaffAngle(startStaffAngle: number): number {
    return calculateFloatStaffAngle(startStaffAngle);
  }
}
