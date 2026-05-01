/**
 * Arrow rotation calculations
 *
 * Calculates arrow rotation angle based on motion type, location,
 * and rotation direction.
 */

import type { GridLocation, MotionType } from "../types.js";
import {
  PRO_CLOCKWISE_MAP,
  PRO_COUNTER_CLOCKWISE_MAP,
  ANTI_CLOCKWISE_MAP,
  ANTI_COUNTER_CLOCKWISE_MAP,
  STATIC_RADIAL_CLOCKWISE_MAP,
  STATIC_RADIAL_COUNTER_CLOCKWISE_MAP,
  STATIC_NON_RADIAL_CLOCKWISE_MAP,
  STATIC_NON_RADIAL_COUNTER_CLOCKWISE_MAP,
  DASH_CLOCKWISE_MAP,
  DASH_COUNTER_CLOCKWISE_MAP,
  DASH_NO_ROTATION_MAP,
  FLOAT_CLOCKWISE_MAP,
  FLOAT_COUNTER_CLOCKWISE_MAP,
} from "../constants/rotation-maps.js";

function selectRotationMap(
  motionType: MotionType,
  rotationDirection: string,
  isRadialOrientation?: boolean
): Record<GridLocation, number> {
  const normalizedDir = rotationDirection.toLowerCase();
  const isCW = normalizedDir === "cw" || normalizedDir === "clockwise";

  switch (motionType) {
    case "pro":
      return isCW ? PRO_CLOCKWISE_MAP : PRO_COUNTER_CLOCKWISE_MAP;

    case "anti":
      return isCW ? ANTI_CLOCKWISE_MAP : ANTI_COUNTER_CLOCKWISE_MAP;

    case "static":
      if (isRadialOrientation) {
        return isCW ? STATIC_RADIAL_CLOCKWISE_MAP : STATIC_RADIAL_COUNTER_CLOCKWISE_MAP;
      }
      return isCW ? STATIC_NON_RADIAL_CLOCKWISE_MAP : STATIC_NON_RADIAL_COUNTER_CLOCKWISE_MAP;

    case "dash":
      return isCW ? DASH_CLOCKWISE_MAP : DASH_COUNTER_CLOCKWISE_MAP;

    case "float":
      return isCW ? FLOAT_CLOCKWISE_MAP : FLOAT_COUNTER_CLOCKWISE_MAP;

    default:
      return PRO_CLOCKWISE_MAP;
  }
}

export function calculateArrowRotation(
  motionType: MotionType | string,
  location: GridLocation | string,
  rotationDirection: string,
  startLocation?: GridLocation | string,
  endLocation?: GridLocation | string,
  isRadialOrientation?: boolean,
  turns?: number | string
): number {
  const normalizedMotionType = (
    typeof motionType === "string" ? motionType.toLowerCase() : motionType
  ) as MotionType;

  const normalizedLocation = (
    typeof location === "string" ? location.toLowerCase() : location
  ) as GridLocation;

  // Handle DASH with no rotation (straight dashes)
  // For 0-turn dashes, always use start/end pair map — rotation direction
  // is meaningless at 0 turns and may be incorrectly set to cw/ccw
  if (normalizedMotionType === "dash") {
    const normalizedDir = rotationDirection.toLowerCase();
    const isNoRotation =
      normalizedDir === "no_rot" ||
      normalizedDir === "no_rotation" ||
      normalizedDir === "norotation" ||
      normalizedDir === "none";

    if (isNoRotation || turns === 0) {
      if (startLocation && endLocation) {
        const startLoc = typeof startLocation === "string" ? startLocation.toLowerCase() : startLocation;
        const endLoc = typeof endLocation === "string" ? endLocation.toLowerCase() : endLocation;
        const key = `${startLoc},${endLoc}`;
        return DASH_NO_ROTATION_MAP[key] ?? 0;
      }
    }
  }

  const rotationMap = selectRotationMap(normalizedMotionType, rotationDirection, isRadialOrientation);
  return rotationMap[normalizedLocation] ?? 0;
}
