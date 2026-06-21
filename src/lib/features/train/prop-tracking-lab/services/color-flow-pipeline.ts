import { ColorEndTracker } from './color-end-tracker';
import type { ColorTarget, EndpointPair } from './color-end-tracker';
import { ScreenToGrid } from './screen-to-grid';
import type { StaffPose3D } from '../domain/notation-3d';
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
 * On a blob dropout, holds the last good pose (the segmenter interpolates) and
 * records confidence 0 for that frame.
 */
export function trackStaffPoses(
  frames: ImageData[],
  color: ColorTarget,
  cal: ScreenToGrid,
): { poses: StaffPose3D[]; confidence: number[] } {
  const tracker = new ColorEndTracker();
  const poses: StaffPose3D[] = [];
  const confidence: number[] = [];
  let last: StaffPose3D | null = null;

  for (const frame of frames) {
    const pair = tracker.track(frame, color);
    if (pair) {
      last = endpointPairToPose(pair, cal);
      confidence.push(pair.confidence);
    } else {
      confidence.push(0);
    }
    // Hold last good pose so the two staff streams stay frame-aligned.
    if (last) poses.push(last);
  }
  return { poses, confidence };
}

/** Full color-flow notation: track both staves, then run the TKA brain. */
export function notateColorFlow(
  frames: ImageData[],
  blueColor: ColorTarget,
  redColor: ColorTarget,
  cal: ScreenToGrid,
): BeatNotation[] {
  const blue = trackStaffPoses(frames, blueColor, cal);
  const red = trackStaffPoses(frames, redColor, cal);
  return framesToNotation(blue.poses, red.poses, blue.confidence, red.confidence);
}
