import {
  planHugReachGeometry,
  type PerformerReachMeasurements,
} from "$lib/shared/3d/domain/performer-reach-measurements";
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

// Just short of a full quarter turn. At exactly 90 degrees the shoulder line
// runs parallel to the rig's root forward, which is the degenerate case the
// animator's own body-frame code calls out: the disambiguating dot product
// sits at zero, and sampling the turned shoulders back into the next solve
// limit-cycles. On ch18 that showed as a periodic 8.2-degree flicker in the
// achieved shoulder yaw at a held side stance. Three degrees of margin leaves
// the singularity while staying visually side-on.
export const MAX_STANCE_YAW_RAD = (87 * Math.PI) / 180;
const LATERAL_DEAD_ZONE_M = 0.1;
const FULL_ASSIST_LATERAL_M = 0.28;
// The hidden-depth budget between the two grips during a fully side-on hold.
// The pair straddles the chest centerline, so each hand takes half of it on its
// own shoulder's side. From the audience the two staffs still overlay; between
// the arms each one gets its own corridor. 16 cm was enough while both grips
// sat a full grid offset in front of the torso; centering them on the chest
// brings each shaft back into the torso's depth band, so the budget now has to
// clear the widest supported torso rather than merely overlay the two staffs.
// At an 8 cm lane the swing frames grazed the intake chest by 5-6 mm and the
// bulkier ch18 chest by 1-2 cm; a 16 cm lane clears every sampled frame on all
// three verified rigs and still sits well inside a ~22 cm shoulder half-span,
// so both grips stay between the arms.
//
// Re-measured after the hug became a wrist rotation rather than a grip
// translation: the lane is still load-bearing and cannot be traded for wrist
// angle. Overriding the intake rig's measured 11.6 cm lane while everything
// else stayed fixed put the shaft into the torso by 15 mm at 8 cm, 28 mm at
// 4 cm, and 38 mm at 0. This lane is a torso-clearance corridor, not a
// convergence mechanism; converging further needs a shorter staff, which is
// what `fitStaffLengthForHug` is for.
const SIDE_ON_YAW_KNEE_RAD = MAX_STANCE_YAW_RAD * 0.8;
const SAME_SIDE_DEPTH_SEPARATION_M = 0.32;
const SAME_SIDE_DEPTH_LANE_M = SAME_SIDE_DEPTH_SEPARATION_M / 2;

/**
 * The hug reach. Once a rig has been measured, the pair no longer straddles
 * the chest at a fixed 16 cm: each grip converges to its body's own hug lane,
 * so the two outstretched arms close toward the chest-forward midline. The
 * shaft that used to pass beside the chest now sits inside the torso's depth
 * band, which is why the prop seam shortens the staff by the same
 * measurements — see `fitStaffLengthForHug`. Without measurements the planner
 * keeps the wider un-measured lane rather than guessing at a body.
 */
function sameSideLaneM(
  measurements: PerformerReachMeasurements | null
): number {
  if (!measurements) return SAME_SIDE_DEPTH_LANE_M;
  return Math.min(
    SAME_SIDE_DEPTH_LANE_M,
    planHugReachGeometry(measurements).laneM
  );
}

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
  targets: UpperBodyStanceTargets,
  measurements: PerformerReachMeasurements | null = null
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

  // Once the chest turns, the grid's forward offset stops being forward: it
  // becomes a sideways shift along the audience axis, which is what left both
  // arms angled toward the audience with the near staff crossing the torso.
  // Re-express the two grips in the turned chest frame instead. The chest's own
  // lateral axis is the audience depth axis at a full side hold, so cancelling
  // the target's depth puts both hands directly in front of the chest, and each
  // hand then takes its own shoulder's depth lane so neither arm crosses the
  // body. Lateral placement is never touched, so the audience silhouette and
  // the authored grid point are unchanged.
  // The re-expression engages only once the chest is genuinely side-on. A
  // linear ramp would drag the rear grip through the torso's depth band while
  // the chest is still half square, which is where the bulkier rigs took shaft
  // hits mid-transition. Below SIDE_ON_YAW_KNEE the grips keep their authored
  // depth and the pose is simply the old square-ish reach.
  const sideBlend = smoothstep01(
    (Math.abs(yawRad) - SIDE_ON_YAW_KNEE_RAD) /
      (MAX_STANCE_YAW_RAD - SIDE_ON_YAW_KNEE_RAD)
  );
  // Rig convention: the performer's left is rig-local +X, so a positive stance
  // yaw swings the left shoulder toward negative depth.
  const leftLaneM = -Math.sign(yawRad) * sameSideLaneM(measurements);
  return {
    yawRad,
    // Same-side reaches need shoulder facing, not a permanent bow. Cross-body
    // pitch and reach-deficit lean remain owned by the animator and engage only
    // when their geometry actually calls for them.
    pitchRad: 0,
    leftDepthOffsetM: sideBlend * (leftLaneM - (targets.left?.z ?? 0)),
    rightDepthOffsetM: sideBlend * (-leftLaneM - (targets.right?.z ?? 0)),
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
  right: GripPropState | null,
  measurements: PerformerReachMeasurements | null = null
): UpperBodyStancePlan {
  const mode = PLANE_MODE_CONFIGS[planeMode];
  const gridOffset = GRID_OFFSETS[planeMode];
  return planUpperBodyStance(
    {
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
    },
    measurements
  );
}
