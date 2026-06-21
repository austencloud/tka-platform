import { Matrix4, Vector3 } from 'three';
import type { DetectedMarker, StaffPose3D } from '../domain/notation-3d';

/**
 * Turns ArUco camera-frame marker poses into grid-frame staff poses.
 *
 * The center reference marker defines the grid origin + axes; every staff pose
 * is read relative to it (gridFromStaff = inverse(camFromCenter) * camFromStaff),
 * so no metric/world calibration is needed. Grid frame: X=East, Y=North, Z=toward camera.
 *
 * Marker convention: the staff shaft runs along the marker's local +Y; the
 * marked tip is the +Y end. Roll is measured about that shaft axis.
 */
export class GridFrameSolver {
  /** camera->grid Matrix4 from the center reference marker. */
  static gridFromCamera(centerRef: DetectedMarker): Matrix4 {
    return markerMatrix(centerRef).invert();
  }

  static solve(staff: DetectedMarker, gridFromCam: Matrix4): StaffPose3D {
    const gridFromStaff = gridFromCam.clone().multiply(markerMatrix(staff));
    const e = gridFromStaff.elements; // column-major

    const gripPos = new Vector3(e[12], e[13], e[14]);
    const xAxis = new Vector3(e[0], e[1], e[2]).normalize(); // marker local +X
    const axisDir = new Vector3(e[4], e[5], e[6]).normalize(); // marker local +Y = shaft

    return { gripPos, axisDir, rollRad: computeRoll(axisDir, xAxis) };
  }
}

/** Row-major 3x3 rotCam + camera translation -> Three.js Matrix4 (camFromMarker). */
function markerMatrix(m: DetectedMarker): Matrix4 {
  // rotCam is contractually a row-major length-9 rotation matrix.
  const r = m.rotCam as [number, number, number, number, number, number, number, number, number];
  return new Matrix4().set(
    r[0], r[1], r[2], m.posCam.x,
    r[3], r[4], r[5], m.posCam.y,
    r[6], r[7], r[8], m.posCam.z,
    0, 0, 0, 1,
  );
}

/**
 * Roll = signed angle of the marker's local +X about the shaft axis, relative to
 * a reference perpendicular built from grid-up (Y). Range (-PI, PI].
 */
function computeRoll(axisDir: Vector3, localX: Vector3): number {
  const up = new Vector3(0, 1, 0);
  let ref = up.clone().addScaledVector(axisDir, -up.dot(axisDir));
  if (ref.lengthSq() < 1e-8) {
    const east = new Vector3(1, 0, 0);
    ref = east.clone().addScaledVector(axisDir, -east.dot(axisDir));
  }
  ref.normalize();
  const refPerp = new Vector3().crossVectors(axisDir, ref).normalize();
  return Math.atan2(localX.dot(refPerp), localX.dot(ref));
}
