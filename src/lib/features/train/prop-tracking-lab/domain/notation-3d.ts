import type { Vector3 } from "three";
import type {
  GridLocation,
  MotionType,
  RotationDirection,
  Orientation,
} from "./tka-enums";

/**
 * Domain types for turning tracked staff endpoints into notation.
 *
 * Grid frame convention: X = East (right), Y = North (top), Z = toward camera.
 * The 2D grid plane is XY; location angle = atan2(x, y) clockwise from North.
 */

export type StaffHand = "left" | "right";

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
  hand: StaffHand;
  frameIndex: number;
  pose: StaffPose3D;
  location: GridLocation;
  orientation: Orientation;
}

/**
 * Per-frame tracking confidence, broken down by the failure mode it guards.
 * Each component is 0-1; `overall` is the min of the components. The breakdown
 * exists so the review UI can say WHY a beat is suspect, not just that it is.
 */
export interface TrackConfidence {
  /** min of the components below. */
  overall: number;
  /**
   * Blob quality: pixel-mass fullness, penalized when a second same-color
   * component (reflection, background clutter) competes with the winner.
   */
  blob: number;
  /**
   * Thumb/pinky correspondence certainty. 1 = the assignment was unambiguous;
   * near 0 = the two label hypotheses cost about the same (a coin flip —
   * fast spin between frames, or reacquisition after a long dropout).
   */
  correspondence: number;
  /**
   * Orientation observability. In a single camera view a staff tilting toward
   * the lens foreshortens: the projected axis shrinks and in/out/clock/counter
   * become unreadable. 1 = full projected length; 0 = staff points at camera.
   */
  orientation: number;
}

/** A fully-collapsed zero-confidence sample (dropout frames). */
export function zeroTrackConfidence(): TrackConfidence {
  return { overall: 0, blob: 0, correspondence: 0, orientation: 0 };
}

/** The full TKA notation for one staff across a start->end beat pair. */
export interface StaffMotionNotation {
  hand: StaffHand;
  startLocation: GridLocation;
  endLocation: GridLocation;
  /** Hand-path family before prop-rotation refinement. */
  handMotion: "static" | "shift" | "dash";
  /** Renderer-level motion type (shift resolves to pro/anti/float). */
  motionType: MotionType;
  rotationDirection: RotationDirection;
  /** Additional turns beyond base rotation, rounded to the configured increment. */
  turns: number;
  startOrientation: Orientation;
  endOrientation: Orientation;
  /** 0-1; lowest per-frame tracking confidence over the beat span. */
  confidence: number;
  /**
   * Component-wise minimum of per-frame confidence over the beat span, when
   * the tracker supplied a breakdown (the color-end path does; hand-built
   * synthetic streams may not).
   */
  confidenceDetail?: TrackConfidence;
}
