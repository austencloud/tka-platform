import type { StaffPose3D } from '../domain/notation-3d';

export interface SegmentConfig {
  /** Per-frame grip displacement (grid units) below which the staff is "held". */
  motionThreshold: number;
  /** Minimum consecutive held frames to count as a beat. */
  minHeldFrames: number;
}

export const DEFAULT_SEGMENT_CONFIG: SegmentConfig = {
  motionThreshold: 0.05,
  minHeldFrames: 3,
};

/** Held-span beat poses: the middle frame of each low-motion run. */
export function segmentBeats3D(
  frames: StaffPose3D[],
  config: SegmentConfig = DEFAULT_SEGMENT_CONFIG,
): StaffPose3D[] {
  const beats: StaffPose3D[] = [];
  let runStart = 0;

  const flush = (endExclusive: number) => {
    const len = endExclusive - runStart;
    if (len >= config.minHeldFrames) {
      beats.push(frames[runStart + Math.floor(len / 2)]!);
    }
  };

  for (let i = 1; i <= frames.length; i++) {
    const moved =
      i < frames.length &&
      frames[i]!.gripPos.distanceTo(frames[i - 1]!.gripPos) > config.motionThreshold;
    if (moved || i === frames.length) {
      flush(i);
      runStart = i;
    }
  }
  return beats;
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
