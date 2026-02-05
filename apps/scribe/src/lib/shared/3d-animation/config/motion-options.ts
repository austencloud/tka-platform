/**
 * Motion Options Configuration
 *
 * Reusable option arrays for motion configuration controls.
 */

import { Plane } from "../domain/enums/Plane";
import {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export const PLANE_OPTIONS = [
  { value: Plane.WALL, label: "Wall" },
  { value: Plane.WHEEL, label: "Wheel" },
  { value: Plane.FLOOR, label: "Floor" },
];

export const MOTION_TYPE_OPTIONS = [
  { value: MotionType.PRO, label: "PRO" },
  { value: MotionType.ANTI, label: "ANTI" },
  { value: MotionType.STATIC, label: "STATIC" },
  { value: MotionType.DASH, label: "DASH" },
];

export const DIRECTION_OPTIONS = [
  { value: RotationDirection.CLOCKWISE, label: "CW", icon: "fas fa-redo" },
  {
    value: RotationDirection.COUNTER_CLOCKWISE,
    label: "CCW",
    icon: "fas fa-undo",
  },
  { value: RotationDirection.NO_ROTATION, label: "—" },
];

export const ORIENTATION_OPTIONS = [
  { value: Orientation.IN, label: "IN" },
  { value: Orientation.OUT, label: "OUT" },
  { value: Orientation.CLOCK, label: "CK" },
  { value: Orientation.COUNTER, label: "CC" },
];
