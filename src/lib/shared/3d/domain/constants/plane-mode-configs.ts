import { Plane } from "../enums/Plane";
import { PlaneMode } from "../enums/PlaneMode";

/**
 * How far each hand's wheel plane is offset from body center.
 * Roughly half shoulder width — enough to clear the torso.
 */
const LATERAL_OFFSET = 0.18;

export interface PlaneModeConfig {
  /** Avatar's Y-axis rotation in radians */
  facingAngle: number;
  /** Which plane the blue (left) hand operates on */
  bluePlane: Plane;
  /** Which plane the red (right) hand operates on */
  redPlane: Plane;
  /** X-axis offset for blue hand's plane center (in avatar-local space) */
  blueLateralOffset: number;
  /** X-axis offset for red hand's plane center (in avatar-local space) */
  redLateralOffset: number;
}

export const PLANE_MODE_CONFIGS: Record<PlaneMode, PlaneModeConfig> = {
  [PlaneMode.WALL]: {
    facingAngle: 0,
    bluePlane: Plane.WALL,
    redPlane: Plane.WALL,
    blueLateralOffset: 0,
    redLateralOffset: 0,
  },
  [PlaneMode.DUAL_WHEEL]: {
    facingAngle: Math.PI / 2,
    bluePlane: Plane.WHEEL,
    redPlane: Plane.WHEEL,
    blueLateralOffset: LATERAL_OFFSET,
    redLateralOffset: -LATERAL_OFFSET,
  },
};
