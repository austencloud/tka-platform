import { HORIZONS_SEC } from "./feature-types";

export interface LocomotionPose {
  position: { x: number; z: number };
  facing: number;
}

export interface TrajectoryQuery {
  /** 3 horizons x (x,z) in CURRENT root-local space — columns [15..20]. */
  posXZ: number[];
  /** 3 horizons x facing-delta (radians) — columns [21..23]. */
  facing: number[];
}

function angleDelta(a: number, b: number): number {
  let d = ((a - b + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Linear approach: assume the target is reached in `reachSec`. At each horizon h,
 * the expected pose is lerp(current, target, min(1, h/reachSec)). Position is
 * expressed in current root-local space; facing as a shortest-arc delta.
 */
export function buildTrajectoryQuery(
  current: LocomotionPose,
  target: LocomotionPose,
  reachSec: number,
): TrajectoryQuery {
  const cosF = Math.cos(-current.facing);
  const sinF = Math.sin(-current.facing);
  const fullFacingDelta = angleDelta(target.facing, current.facing);

  const posXZ: number[] = [];
  const facing: number[] = [];

  for (let h = 0; h < HORIZONS_SEC.length; h++) {
    const t = reachSec > 0 ? Math.min(1, HORIZONS_SEC[h]! / reachSec) : 1;
    const wx = current.position.x + (target.position.x - current.position.x) * t;
    const wz = current.position.z + (target.position.z - current.position.z) * t;
    const dxw = wx - current.position.x;
    const dzw = wz - current.position.z;
    posXZ.push(dxw * cosF - dzw * sinF, dxw * sinF + dzw * cosF);
    facing.push(fullFacingDelta * t);
  }

  return { posXZ, facing };
}
