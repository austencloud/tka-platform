import {
  GRID_OFFSETS,
  PLANE_MODE_CONFIGS,
  type PlaneMode,
  type PropState3D,
} from "@austencloud/scene-3d";

export interface GripTargetXZ {
  x: number;
  z: number;
}

export interface UpperBodyStanceTargets {
  left: GripTargetXZ | null;
  right: GripTargetXZ | null;
}

export interface UpperBodyStancePlan {
  yawRad: number;
  pitchRad: number;
  leftDepthOffsetM: number;
  rightDepthOffsetM: number;
}

const MAX_STANCE_YAW_RAD = Math.PI / 2;
const LATERAL_DEAD_ZONE_M = 0.1;
const FULL_ASSIST_LATERAL_M = 0.28;
// The widest supported torso radius (16 cm). The far
// hand moves forward by this amount during a fully side-on hold, which keeps
// the two grips overlaid from the audience while giving the rear arm and staff
// a complete corridor around the body envelope.
const SAME_SIDE_DEPTH_SEPARATION_M = 0.16;

const SQUARE_STANCE: UpperBodyStancePlan = {
  yawRad: 0,
  pitchRad: 0,
  leftDepthOffsetM: 0,
  rightDepthOffsetM: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep01(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Turn a coherent same-side pair of targets into the body's forward reach
 * corridor.
 *
 * Split targets intentionally cancel: when one hand is east and the other is
 * west, the avatar stays square. A coherent same-side pair uses the same yaw
 * sign as its lateral placement so the performer's shoulders and face turn
 * toward the props and both arms remain in front of the chest.
 */
export function planUpperBodyStance(
  targets: UpperBodyStanceTargets
): UpperBodyStancePlan {
  const active = [targets.left, targets.right].filter(
    (target): target is GripTargetXZ => target !== null
  );
  if (active.length < 2) return SQUARE_STANCE;

  const meanX =
    active.reduce((sum, target) => sum + target.x, 0) / active.length;
  const meanAbsX =
    active.reduce((sum, target) => sum + Math.abs(target.x), 0) / active.length;
  if (meanAbsX < 1e-6) return SQUARE_STANCE;

  const coherence = clamp(Math.abs(meanX) / meanAbsX, 0, 1);
  const lateralWeight = smoothstep01(
    (Math.abs(meanX) - LATERAL_DEAD_ZONE_M) /
      (FULL_ASSIST_LATERAL_M - LATERAL_DEAD_ZONE_M)
  );
  if (coherence < 0.35 || lateralWeight === 0) {
    return SQUARE_STANCE;
  }

  // Every wall-grid point carries the same forward plane offset. Folding that
  // depth into atan2 made a true E/W two-hand hold look merely diagonal and
  // left the far shoulder reaching through the neck. Lateral placement owns
  // the stance direction; coherence and lateralWeight still soften entrances.
  const desiredYaw = Math.sign(meanX) * MAX_STANCE_YAW_RAD;
  const assistance = smoothstep01(coherence) * lateralWeight;
  const yawRad =
    clamp(desiredYaw, -MAX_STANCE_YAW_RAD, MAX_STANCE_YAW_RAD) * assistance;
  const farHandDepthOffset = SAME_SIDE_DEPTH_SEPARATION_M * assistance;
  return {
    yawRad,
    // Same-side reaches need shoulder facing, not a permanent bow. Cross-body
    // pitch and reach-deficit lean remain owned by the animator and engage only
    // when their geometry actually calls for them.
    pitchRad: 0,
    // With this rig convention, negative yaw makes the right shoulder the far
    // shoulder; positive yaw mirrors the route to the left hand.
    leftDepthOffsetM: yawRad > 0 ? farHandDepthOffset : 0,
    rightDepthOffsetM: yawRad < 0 ? farHandDepthOffset : 0,
  };
}

export function planUpperBodyStanceYaw(
  targets: UpperBodyStanceTargets
): number {
  return planUpperBodyStance(targets).yawRad;
}

type GripPropState = Pick<PropState3D, "worldPosition">;

/**
 * Convert the two rendered prop targets into the shared body-facing plan.
 * Every live sequence surface uses this seam so a diagnostic route cannot
 * silently pose the arms without the shoulder turn used by the app.
 */
export function planUpperBodyStanceForPropStates(
  planeMode: PlaneMode,
  left: GripPropState | null,
  right: GripPropState | null
): UpperBodyStancePlan {
  const mode = PLANE_MODE_CONFIGS[planeMode];
  const gridOffset = GRID_OFFSETS[planeMode];
  return planUpperBodyStance({
    left: left
      ? {
          x: mode.blueLateralOffset + left.worldPosition.x,
          z: gridOffset + left.worldPosition.z,
        }
      : null,
    right: right
      ? {
          x: mode.redLateralOffset + right.worldPosition.x,
          z: gridOffset + right.worldPosition.z,
        }
      : null,
  });
}
