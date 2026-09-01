import { ColorEndTracker } from './color-end-tracker';
import type { ColorTarget, EndpointPair } from './color-end-tracker';
import { ScreenToGrid } from './screen-to-grid';
import type { StaffPose3D, TrackConfidence } from '../domain/notation-3d';
import { zeroTrackConfidence } from '../domain/notation-3d';
import { framesToNotation } from './notation-pipeline';
import type { BeatNotation } from './notation-pipeline';

/** One endpoint pair (screen px) -> StaffPose3D (grid frame). */
export function endpointPairToPose(pair: EndpointPair, cal: ScreenToGrid): StaffPose3D {
  const thumb = cal.toGrid(pair.thumb);
  const pinky = cal.toGrid(pair.pinky);
  const gripPos = thumb.clone().add(pinky).multiplyScalar(0.5);
  const axisDir = thumb.clone().sub(pinky);
  if (axisDir.lengthSq() > 1e-12) axisDir.normalize();
  return { gripPos, axisDir };
}

/**
 * Track one staff's color across frames -> grid-frame pose stream + confidence.
 * On a blob dropout, holds the last good pose (so the two staff streams stay
 * frame-aligned) and records zero confidence for that frame — the beat
 * segmenter treats those frames as unknown, not as evidence of a hold.
 */
export function trackStaffPoses(
  frames: ImageData[],
  color: ColorTarget,
  cal: ScreenToGrid,
): { poses: StaffPose3D[]; confidence: number[]; detail: TrackConfidence[] } {
  const tracker = new ColorEndTracker();
  const poses: StaffPose3D[] = [];
  const confidence: number[] = [];
  const detail: TrackConfidence[] = [];
  let last: StaffPose3D | null = null;

  for (const frame of frames) {
    const pair = tracker.track(frame, color);
    if (pair) {
      last = endpointPairToPose(pair, cal);
      confidence.push(pair.confidence);
      detail.push(pair.detail);
    } else {
      confidence.push(0);
      detail.push(zeroTrackConfidence());
    }
    // Hold last good pose so the two staff streams stay frame-aligned.
    if (last) poses.push(last);
  }
  return { poses, confidence, detail };
}

/** Full color-flow notation: track both staves, then run the TKA brain. */
export function notateColorFlow(
  frames: ImageData[],
  leftColor: ColorTarget,
  rightColor: ColorTarget,
  cal: ScreenToGrid,
): BeatNotation[] {
  const left = trackStaffPoses(frames, leftColor, cal);
  const right = trackStaffPoses(frames, rightColor, cal);
  return framesToNotation(
    left.poses,
    right.poses,
    left.confidence,
    right.confidence,
    undefined,
    undefined,
    left.detail,
    right.detail,
  );
}
