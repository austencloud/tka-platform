import type { GridLocation } from "@tka/types";
import { Orientation, RotationDirection } from "@tka/types";
import {
  HALF_PI,
  LOCATION_ANGLES,
  PI,
  TWO_PI,
} from "../domain/math-constants";
import type { IAngleCalculator } from "../contracts/IAngleCalculator";

export function normalizeAnglePositive(angle: number): number {
  const norm = angle % TWO_PI;
  return norm < 0 ? norm + TWO_PI : norm;
}

export function normalizeAngleSigned(angle: number): number {
  const norm = normalizeAnglePositive(angle);
  return norm > PI ? norm - TWO_PI : norm;
}

export function mapPositionToAngle(loc: GridLocation): number {
  return LOCATION_ANGLES[loc];
}

export function mapOrientationToAngle(
  ori: Orientation,
  centerPathAngle: number
): number {
  if (ori === Orientation.IN) {
    return normalizeAnglePositive(centerPathAngle + PI);
  }
  if (ori === Orientation.OUT) {
    return normalizeAnglePositive(centerPathAngle);
  }
  if (ori === Orientation.CLOCK) {
    return normalizeAnglePositive(centerPathAngle + HALF_PI);
  }
  return normalizeAnglePositive(centerPathAngle - HALF_PI);
}

export class AngleCalculator implements IAngleCalculator {
  normalizeAnglePositive(angle: number): number {
    return normalizeAnglePositive(angle);
  }

  normalizeAngleSigned(angle: number): number {
    return normalizeAngleSigned(angle);
  }

  mapPositionToAngle(loc: GridLocation): number {
    return mapPositionToAngle(loc);
  }

  mapOrientationToAngle(ori: Orientation, centerPathAngle: number): number {
    return mapOrientationToAngle(ori, centerPathAngle);
  }

  lerp(a: number, b: number, t: number): number {
    return a * (1 - t) + b * t;
  }

  lerpAngle(a: number, b: number, t: number): number {
    const d = this.normalizeAngleSigned(b - a);
    return this.normalizeAnglePositive(a + d * t);
  }

  lerpAngleDirectional(
    startAngle: number,
    endAngle: number,
    direction: RotationDirection,
    progress: number
  ): number {
    if (direction === RotationDirection.NO_ROTATION) {
      return this.lerpAngle(startAngle, endAngle, progress);
    }

    const start = this.normalizeAnglePositive(startAngle);
    const end = this.normalizeAnglePositive(endAngle);
    let delta = end - start;

    if (direction === RotationDirection.CLOCKWISE) {
      if (delta > 0) {
        delta -= TWO_PI;
      }
    } else {
      if (delta < 0) {
        delta += TWO_PI;
      }
    }

    return this.normalizeAnglePositive(start + delta * progress);
  }
}
