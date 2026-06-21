import type { Vector3 } from 'three';
import type {
  GridLocation,
  MotionType,
  RotationDirection,
  Orientation,
} from './tka-enums';

/**
 * 3D notation domain types for the ArUco real-flow pipeline.
 *
 * Grid frame convention: X = East (right), Y = North (top), Z = toward camera.
 * The 2D grid plane is XY; location angle = atan2(x, y) clockwise from North.
 */

/** One ArUco marker detected in a single video frame, in CAMERA space. */
export interface DetectedMarker {
  /** Marker dictionary id. */
  id: number;
  /** Marker-center translation in camera frame (POSIT model-size units = mm). */
  posCam: Vector3;
  /** Camera-frame orientation as a 3x3 ROW-MAJOR rotation matrix (length 9). */
  rotCam: number[];
  /** Detection corner pixels (debug / confidence only). */
  corners: { x: number; y: number }[];
}

export type StaffColor = 'blue' | 'red';

/** Which marker id is which role + the physical marker edge length for POSIT. */
export interface MarkerAssignment {
  centerRefId: number;
  blueId: number;
  redId: number;
  /** Physical marker edge length (mm). POSIT model size; same unit for all markers. */
  markerSizeMm: number;
}

export const DEFAULT_MARKER_ASSIGNMENT: MarkerAssignment = {
  centerRefId: 0,
  blueId: 1,
  redId: 2,
  markerSizeMm: 80,
};

export function createMarkerAssignment(
  over: Partial<MarkerAssignment> = {},
): MarkerAssignment {
  return { ...DEFAULT_MARKER_ASSIGNMENT, ...over };
}

/**
 * A staff's pose in the TKA grid frame. A staff is rotationally symmetric about
 * its long axis, so it has no roll-about-axis DOF — `axisDir` (where the long
 * axis points) fully captures its orientation.
 */
export interface StaffPose3D {
  /** Grip position in grid frame. */
  gripPos: Vector3;
  /** Unit vector along the shaft, from grip toward the thumb-reference end. */
  axisDir: Vector3;
}

/** A classified beat for one staff. */
export interface BeatPose3D {
  staff: StaffColor;
  frameIndex: number;
  pose: StaffPose3D;
  location: GridLocation;
  orientation: Orientation;
}

/** The full TKA notation for one staff across a start->end beat pair. */
export interface StaffMotionNotation {
  staff: StaffColor;
  startLocation: GridLocation;
  endLocation: GridLocation;
  /** Hand-path family before prop-rotation refinement. */
  handMotion: 'static' | 'shift' | 'dash';
  /** Renderer-level motion type (shift resolves to pro/anti/float). */
  motionType: MotionType;
  rotationDirection: RotationDirection;
  /** Additional turns beyond base rotation, rounded to the configured increment. */
  turns: number;
  startOrientation: Orientation;
  endOrientation: Orientation;
  /** 0-1; lowest per-frame ArUco confidence over the beat span. */
  confidence: number;
}
