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
}

const MAX_STANCE_YAW_RAD = (75 * Math.PI) / 180;
const LATERAL_DEAD_ZONE_M = 0.1;
const FULL_ASSIST_LATERAL_M = 0.28;

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
  if (active.length < 2) return { yawRad: 0, pitchRad: 0 };

  const meanX =
    active.reduce((sum, target) => sum + target.x, 0) / active.length;
  const meanAbsX =
    active.reduce((sum, target) => sum + Math.abs(target.x), 0) / active.length;
  if (meanAbsX < 1e-6) return { yawRad: 0, pitchRad: 0 };

  const coherence = clamp(Math.abs(meanX) / meanAbsX, 0, 1);
  const lateralWeight = smoothstep01(
    (Math.abs(meanX) - LATERAL_DEAD_ZONE_M) /
      (FULL_ASSIST_LATERAL_M - LATERAL_DEAD_ZONE_M)
  );
  if (coherence < 0.35 || lateralWeight === 0) {
    return { yawRad: 0, pitchRad: 0 };
  }

  // Every wall-grid point carries the same forward plane offset. Folding that
  // depth into atan2 made a true E/W two-hand hold look merely diagonal and
  // left the far shoulder reaching through the neck. Lateral placement owns
  // the stance direction; coherence and lateralWeight still soften entrances.
  const desiredYaw = Math.sign(meanX) * MAX_STANCE_YAW_RAD;
  const assistance = smoothstep01(coherence) * lateralWeight;
  return {
    yawRad:
      clamp(desiredYaw, -MAX_STANCE_YAW_RAD, MAX_STANCE_YAW_RAD) * assistance,
    // Same-side reaches need shoulder facing, not a permanent bow. Cross-body
    // pitch and reach-deficit lean remain owned by the animator and engage only
    // when their geometry actually calls for them.
    pitchRad: 0,
  };
}

export function planUpperBodyStanceYaw(
  targets: UpperBodyStanceTargets
): number {
  return planUpperBodyStance(targets).yawRad;
}
