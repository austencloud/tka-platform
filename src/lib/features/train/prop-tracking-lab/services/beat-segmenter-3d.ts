import type { StaffPose3D } from '../domain/notation-3d';

export interface SegmentConfig {
  /** Per-frame grip displacement (grid units) below which the staff is "held". */
  motionThreshold: number;
  /** Minimum consecutive held frames to count as a beat. */
  minHeldFrames: number;
  /**
   * Hysteresis: once held, displacement must exceed motionThreshold * this
   * ratio to count as moving again. Prevents jitter around the threshold from
   * chattering a real hold into several short runs. 1 = no hysteresis.
   */
  exitThresholdRatio?: number;
  /**
   * Frames with tracking confidence below this are "unknown": they neither
   * break a held run nor count toward minHeldFrames. A dropout holds the last
   * good pose upstream, which looks exactly like a hold — without this gate a
   * mid-swing dropout fabricates a beat.
   */
  minConfidence?: number;
}

export const DEFAULT_SEGMENT_CONFIG: SegmentConfig = {
  motionThreshold: 0.05,
  minHeldFrames: 3,
  exitThresholdRatio: 1.5,
  minConfidence: 0.05,
};

/**
 * Held-span beat detection returning FRAME INDICES (middle frame of each
 * low-motion run). Index-based so callers can accumulate between beats without
 * re-finding poses by value (held-pose duplicates make value lookup ambiguous).
 *
 * Per-frame state machine with hysteresis:
 * - moving -> held when displacement <= motionThreshold
 * - held -> moving when displacement > motionThreshold * exitThresholdRatio
 * - frames below minConfidence are unknown: transparent to the run (don't
 *   break it, don't count toward its length). A run must contain at least
 *   minHeldFrames CONFIDENT frames to produce a beat, and the beat pose is
 *   the middle confident frame.
 */
export function segmentBeatIndices3D(
  frames: StaffPose3D[],
  config: SegmentConfig = DEFAULT_SEGMENT_CONFIG,
  confidence?: number[],
): number[] {
  // Fall back to the shipped defaults when the caller passes a partial config
  // (legacy call sites pass only motionThreshold + minHeldFrames).
  const exitRatio = config.exitThresholdRatio ?? DEFAULT_SEGMENT_CONFIG.exitThresholdRatio ?? 1;
  const minConf = config.minConfidence ?? DEFAULT_SEGMENT_CONFIG.minConfidence ?? 0;
  const enterTh = config.motionThreshold;
  const exitTh = config.motionThreshold * Math.max(1, exitRatio);

  const beats: number[] = [];
  /** Confident frame indices of the current held run. */
  let run: number[] = [];
  let held = false;
  /** Last confident frame index (displacement is measured between confident frames). */
  let lastConfident = -1;

  const flush = () => {
    if (run.length >= config.minHeldFrames) {
      beats.push(run[Math.floor(run.length / 2)]!);
    }
    run = [];
  };

  for (let i = 0; i < frames.length; i++) {
    const confident = (confidence?.[i] ?? 1) >= minConf;
    if (!confident) continue; // unknown: transparent to the run

    if (lastConfident < 0) {
      // First confident frame starts a held run (matches the legacy behavior
      // where frame 0 implicitly began a run).
      held = true;
      run.push(i);
      lastConfident = i;
      continue;
    }

    // Displacement per frame, averaged across any unknown gap so a slow drift
    // hidden by a dropout still reads as motion.
    const gap = i - lastConfident;
    const prevIdx = lastConfident;
    const disp = frames[i]!.gripPos.distanceTo(frames[prevIdx]!.gripPos) / gap;
    lastConfident = i;

    const threshold = held ? exitTh : enterTh;
    const moving = disp > threshold;
    if (held && moving) {
      flush();
      held = false;
    } else if (!held && !moving) {
      // The low displacement was measured FROM prevIdx — that frame already
      // sits at the hold position, so it belongs to the run (legacy counted
      // it too; without it a minimal 3-frame hold after motion loses a frame).
      held = true;
      run.push(prevIdx);
    }
    if (held) run.push(i);
  }
  flush();
  return beats;
}

/** Held-span beat poses: the middle frame of each low-motion run. */
export function segmentBeats3D(
  frames: StaffPose3D[],
  config: SegmentConfig = DEFAULT_SEGMENT_CONFIG,
): StaffPose3D[] {
  return segmentBeatIndices3D(frames, config).map((i) => frames[i]!);
}

/** Shortest signed delta from a to b in (-PI, PI]. */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Signed grip-arc angle about center (CCW+) and unwrapped net roll over [from,to]. */
export function accumulateBetween(
  frames: StaffPose3D[],
  from: number,
  to: number,
): { arcAngle: number; propNetRotation: number } {
  let arcAngle = 0;
  let propNetRotation = 0;
  for (let i = from + 1; i <= to; i++) {
    const prev = frames[i - 1]!;
    const cur = frames[i]!;
    // Hand arc: how much the grip vector sweeps about center.
    arcAngle += angleDelta(
      Math.atan2(prev.gripPos.y, prev.gripPos.x),
      Math.atan2(cur.gripPos.y, cur.gripPos.x),
    );
    // Prop rotation: how much the staff's facing vector (axisDir) sweeps in the
    // world plane. A staff has no roll-about-its-own-axis DOF — its rotation IS
    // the rotation of the long axis. (PRO base = +arc, ANTI base = -arc, spin in
    // place = pure turns, all consistent with TkaPoseClassifier.baseRotation.)
    propNetRotation += angleDelta(
      Math.atan2(prev.axisDir.y, prev.axisDir.x),
      Math.atan2(cur.axisDir.y, cur.axisDir.x),
    );
  }
  return { arcAngle, propNetRotation };
}
