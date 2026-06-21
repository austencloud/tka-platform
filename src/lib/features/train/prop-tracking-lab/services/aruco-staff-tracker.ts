import { Vector3 } from 'three';
import { createDetector, createPosit } from '../vendor/js-aruco2/index';
import type { ArucoDetector, PositSolver } from '../vendor/js-aruco2/index';
import type { DetectedMarker, MarkerAssignment } from '../domain/notation-3d';

/**
 * Per-frame ArUco detection + POSIT 6-DOF pose. Pure per-frame; no TKA knowledge.
 * Output markers carry a ROW-MAJOR rotation (rotCam) + camera translation (posCam),
 * exactly what GridFrameSolver consumes.
 */
export class ArucoStaffTracker {
  private detector: ArucoDetector;
  private posit: PositSolver;

  constructor(assignment: MarkerAssignment, focalLengthPx: number) {
    this.detector = createDetector();
    this.posit = createPosit(assignment.markerSizeMm, focalLengthPx);
  }

  detect(frame: ImageData): DetectedMarker[] {
    const markers = this.detector.detect(frame);
    const out: DetectedMarker[] = [];
    const cx = frame.width / 2;
    const cy = frame.height / 2;
    for (const m of markers) {
      // POSIT expects corners centered on the principal point with a flipped Y.
      const centered = m.corners.map((c) => ({ x: c.x - cx, y: cy - c.y }));
      const pose = this.posit.pose(centered);
      const r = pose.bestRotation;
      out.push({
        id: m.id,
        posCam: new Vector3(
          pose.bestTranslation[0]!,
          pose.bestTranslation[1]!,
          pose.bestTranslation[2]!,
        ),
        rotCam: [
          r[0]![0]!, r[0]![1]!, r[0]![2]!,
          r[1]![0]!, r[1]![1]!, r[1]![2]!,
          r[2]![0]!, r[2]![1]!, r[2]![2]!,
        ],
        corners: m.corners,
      });
    }
    return out;
  }
}
