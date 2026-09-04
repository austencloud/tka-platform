/**
 * Sample a performer's props across a whole sequence and hand the trace to the
 * continuity audit.
 *
 * The pose sampled here is the one the renderer composes, not the raw grid
 * path: `PerformerRig` places each hand at `modeConfig.<side>LateralOffset` /
 * `gridOffset + <side>HandDepthOffset` and hangs the prop anchor off that at
 * `propState.worldPosition` (PerformerRig.svelte:383-391, :513-522). The depth
 * offset is the hand corridor from the stance planner, so a corridor that
 * changes fast moves the prop even while the authored grid path is smooth.
 * Sampling the grid path alone would miss exactly the class of defect this
 * audit exists to find.
 *
 * The score-time seam, the stance track and the corridor all stay with their
 * existing owners. This module only samples them:
 *   - poses: `CharacterInstanceState.propStatesAtScoreTime`
 *   - stance: `buildStanceYawTrackForSource` + `resolveTrackedUpperBodyStance`
 *
 * What it does NOT model, and cannot from Node: the contact-lock correction
 * group that `Avatar3D` writes inside each prop anchor every frame with the
 * clamped anchor-to-palm residual, and the measured reach geometry that
 * narrows the corridor lane. Neither moves an event in phase - the lane is
 * `min(SAME_SIDE_DEPTH_LANE_M, measured)` - so the phase windows below are
 * exact and the magnitudes are an upper bound.
 */

import {
  GRID_OFFSETS,
  PLANE_MODE_CONFIGS,
  PlaneMode,
  type PropState3D,
} from "@austencloud/scene-3d";
import {
  buildStanceYawTrackForSource,
  resolveTrackedUpperBodyStance,
  type StanceScoreSource,
} from "../collision/stance-yaw-track";
import {
  planUpperBodyStanceYawTarget,
  stanceTargetsForPropStates,
} from "../collision/upper-body-stance-planner";
import {
  auditPropContinuity,
  type ContinuityAuditOptions,
  type ContinuityFinding,
  type ContinuityPose,
  type ContinuityPropId,
  type ContinuityTrace,
} from "./prop-continuity-audit";

/**
 * The pose half of a score source. `CharacterInstanceState` satisfies this and
 * `StanceScoreSource` at once, so the audit reads the live owner rather than a
 * second copy of the seam.
 */
export interface PropPoseScoreSource extends StanceScoreSource {
  propStatesAtScoreTime(scoreTime: number): {
    left: PropState3D | null;
    right: PropState3D | null;
  };
}

export interface PropContinuitySweepOptions {
  /** Phase resolution, in steps. The lab scrubs in hundredths of a step. */
  readonly phaseStep?: number;
  /** Which plane mode the host renders in. The staff-grip lab is WALL. */
  readonly planeMode?: PlaneMode;
  /** Forwarded to the detector. */
  readonly audit?: ContinuityAuditOptions;
}

/** One frame of the sampled trace, kept so findings can be explained. */
export interface PropContinuitySample {
  readonly phase: number;
  readonly blue: ContinuityPose | null;
  readonly red: ContinuityPose | null;
  /** Chest yaw the stance track delivers this frame, degrees. */
  readonly chestYawDeg: number;
  /** Memoryless yaw the props are asking for this frame, degrees. */
  readonly propDesireYawDeg: number;
  /** Hand corridor depth offsets, metres. */
  readonly leftDepthOffsetM: number;
  readonly rightDepthOffsetM: number;
}

export interface PropContinuitySweepResult {
  readonly sequenceId: string;
  readonly sequenceWord: string;
  readonly motionStepCount: number;
  readonly phaseStep: number;
  readonly samples: readonly PropContinuitySample[];
  readonly findings: readonly ContinuityFinding[];
}

const DEFAULT_PHASE_STEP = 0.002;

function toPose(
  state: PropState3D | null,
  lateralOffset: number,
  depthOffset: number,
  gridOffset: number
): ContinuityPose | null {
  if (!state) return null;
  return {
    position: {
      x: lateralOffset + state.worldPosition.x,
      y: state.worldPosition.y,
      z: gridOffset + depthOffset + state.worldPosition.z,
    },
    rotation: {
      x: state.worldRotation.x,
      y: state.worldRotation.y,
      z: state.worldRotation.z,
      w: state.worldRotation.w,
    },
  };
}

const DEG = 180 / Math.PI;

/**
 * Walk one loaded performer across its whole score and return every frame plus
 * the discontinuities in it.
 */
export function sweepPropContinuity(
  sequenceId: string,
  sequenceWord: string,
  source: PropPoseScoreSource,
  options: PropContinuitySweepOptions = {}
): PropContinuitySweepResult {
  const phaseStep = options.phaseStep ?? DEFAULT_PHASE_STEP;
  const planeMode = options.planeMode ?? PlaneMode.WALL;
  const modeConfig = PLANE_MODE_CONFIGS[planeMode];
  const gridOffset = GRID_OFFSETS[planeMode];
  const motionStepCount = source.motionStepCount;

  const track = buildStanceYawTrackForSource(source, planeMode);

  const samples: PropContinuitySample[] = [];
  const frameCount = Math.max(1, Math.round(motionStepCount / phaseStep));
  for (let frame = 0; frame < frameCount; frame++) {
    const phase = frame * phaseStep;
    const { left, right } = source.propStatesAtScoreTime(phase);
    const targets = stanceTargetsForPropStates(planeMode, left, right);
    const desireRad = planUpperBodyStanceYawTarget(targets);
    const stance = resolveTrackedUpperBodyStance(
      track,
      phase,
      planeMode,
      left,
      right,
      null
    );
    samples.push({
      phase,
      blue: toPose(
        left,
        modeConfig.blueLateralOffset,
        stance.leftDepthOffsetM,
        gridOffset
      ),
      red: toPose(
        right,
        modeConfig.redLateralOffset,
        stance.rightDepthOffsetM,
        gridOffset
      ),
      chestYawDeg: stance.segments.chestRad * DEG,
      propDesireYawDeg: desireRad * DEG,
      leftDepthOffsetM: stance.leftDepthOffsetM,
      rightDepthOffsetM: stance.rightDepthOffsetM,
    });
  }

  const phases = samples.map((s) => s.phase);
  const contextAt = (index: number, prop: ContinuityPropId) => {
    const sample = samples[index];
    if (!sample) return undefined;
    return {
      chestYawDeg: Number(sample.chestYawDeg.toFixed(2)),
      propDesireYawDeg: Number(sample.propDesireYawDeg.toFixed(2)),
      depthOffsetM: Number(
        (prop === "blue"
          ? sample.leftDepthOffsetM
          : sample.rightDepthOffsetM
        ).toFixed(4)
      ),
    };
  };

  const traces: ContinuityTrace[] = [
    { prop: "blue", phases, poses: samples.map((s) => s.blue) },
    { prop: "red", phases, poses: samples.map((s) => s.red) },
  ];

  const findings = traces
    .flatMap((trace) =>
      auditPropContinuity(sequenceId, trace, { contextAt, ...options.audit })
    )
    .sort((a, b) => a.phaseStart - b.phaseStart || a.prop.localeCompare(b.prop));

  return {
    sequenceId,
    sequenceWord,
    motionStepCount,
    phaseStep,
    samples,
    findings,
  };
}
