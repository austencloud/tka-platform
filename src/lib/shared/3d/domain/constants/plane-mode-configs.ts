import { Plane } from "../enums/Plane";
import { PlaneMode } from "../enums/PlaneMode";

/**
 * How far each hand's wheel plane is offset from body center.
 * Should be wide enough to clear the torso and let arms extend
 * naturally without clipping.
 */
const LATERAL_OFFSET = 0.25;

/**
 * Forward offset from body center to grid/prop circle center.
 * Wall mode: grid is in front of the performer (standard offset).
 * Dual wheel: grid is at the performer's solar plexus (zero offset)
 * because the arms extend sideways, not forward.
 */
export const GRID_OFFSETS: Record<PlaneMode, number> = {
  [PlaneMode.WALL]: 0.3,
  [PlaneMode.DUAL_WHEEL]: 0,
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
   * In dual wheel mode this is WALL because the facing angle already
   * rotates the avatar 90 degrees — using WHEEL for rotation too would
   * double-rotate the props onto the wrong axis.
   */
  rotationPlane: Plane;
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
  [PlaneMode.DUAL_WHEEL]: {
    facingAngle: Math.PI / 2,
    bluePlane: Plane.WHEEL,
    redPlane: Plane.WHEEL,
    // Props spin on the wheel plane (cartwheels). The planeQuat (π/2 Y)
    // + facingQuat (π/2 Y) compound to π Y, which preserves the correct
    // wheel-plane spin axis from the audience's perspective.
    rotationPlane: Plane.WHEEL,
    blueLateralOffset: LATERAL_OFFSET,
    redLateralOffset: -LATERAL_OFFSET,
  },
};
