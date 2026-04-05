import { Plane } from "../enums/Plane";
import { PlaneMode } from "../enums/PlaneMode";

/**
 * How far each hand's wheel plane is offset from body center.
 * Should be wide enough to clear the torso and let arms extend
 * naturally without clipping.
 */
const LATERAL_OFFSET = 0.40;

/**
 * Forward offset from body center to grid/prop circle center.
 * Wall mode: grid is in front of the performer (standard offset).
 * Dual wheel: grid is at the performer's solar plexus (zero offset)
 * because the arms extend sideways, not forward.
 */
export const GRID_OFFSETS: Record<PlaneMode, number> = {
  [PlaneMode.WALL]: 0.3,
  [PlaneMode.DUAL_WHEEL]: 0,
  [PlaneMode.CUSTOM]: 0.3,
};

export interface PlaneModeConfig {
  /** Avatar's Y-axis rotation in radians */
  facingAngle: number;
  /** Which plane the blue (left) hand operates on (for positions) */
  bluePlane: Plane;
  /** Which plane the red (right) hand operates on (for positions) */
  redPlane: Plane;
  /**
   * Which plane to use for prop ROTATION quaternion calculation.
   * When omitted, each hand uses its own position plane for rotation.
   * Only needed for modes like dual-wheel where rotation and position
   * planes intentionally differ.
   */
  rotationPlane?: Plane;
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
    rotationPlane: Plane.WALL,
    blueLateralOffset: 0,
    redLateralOffset: 0,
  },
  [PlaneMode.CUSTOM]: {
    facingAngle: 0,
    bluePlane: Plane.WALL,
    redPlane: Plane.WALL,
    // No rotationPlane — each hand uses its own plane for rotation
    blueLateralOffset: 0,
    redLateralOffset: 0,
  },
  [PlaneMode.DUAL_WHEEL]: {
    // Avatar stays facing forward. Prop states are swapped in
    // Viewer3DScene so left hand grabs left prop, right grabs right.
    facingAngle: 0,
    bluePlane: Plane.WHEEL,
    redPlane: Plane.WHEEL,
    blueLateralOffset: LATERAL_OFFSET,
    redLateralOffset: -LATERAL_OFFSET,
  },
};
