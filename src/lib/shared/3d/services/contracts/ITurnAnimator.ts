/**
 * ITurnAnimator
 *
 * Sample-based turn animation interface. Given a heading change and a
 * phase (0→1), returns the bone rotations and contact state for that
 * instant. Stateless: same input always produces the same output.
 *
 * Consumers own the phase clock (beat duration, wall-clock time, or
 * scrub position). This interface has no concept of "time" or "playback".
 *
 * The implementation can be swapped without touching consumers:
 * - ClipBasedTurnAnimator (Phase 2 — Mixamo + mocap clips)
 * - NeuralTurnAnimator (future — motion diffusion models)
 * - MotionMatchingTurnAnimator (future — database search)
 */

import type { Quaternion, Vector3 } from "three";

/**
 * Input to a turn sample. The consumer computes this from its own clock.
 */
export interface TurnRequest {
  /** Heading at phase 0, in radians (0 = +Z toward audience). */
  fromHeading: number;
  /** Heading at phase 1, in radians. */
  toHeading: number;
  /** Phase 0→1 within the turn. 0 = start pose, 1 = end pose.
   *  Can go backward (scrubbing). Values outside [0,1] are clamped. */
  phase: number;
}

/**
 * Output of a turn sample — everything Avatar3D needs to pose the skeleton.
 */
export interface TurnSample {
  /** Accumulated yaw delta from phase=0 to this phase, in radians.
   *  Positive = counterclockwise (left turn) when viewed from above. */
  yawDelta: number;
  /** Per-bone local rotations to apply to the skeleton.
   *  Keys are canonical bone names without prefix (e.g. "Hips", "LeftUpLeg").
   *  Only lower-body + spine bones are included. */
  boneRotations: Map<string, Quaternion>;
  /** Hips local position at this phase (for root motion extraction).
   *  Null when using linear fallback (no clip data). */
  hipsPosition: Vector3 | null;
  /** Per-foot contact state: 0 = airborne, 1 = fully planted. */
  leftFootContact: number;
  rightFootContact: number;
  /** Name of the clip being sampled (for ContactCurveCache lookup).
   *  Empty string when using linear fallback. */
  clipName: string;
}

export interface ITurnAnimator {
  /**
   * Sample the turn pose at a given phase. Pure function: same input
   * always returns same output. Consumers own the phase clock.
   */
  sample(request: TurnRequest): TurnSample;

  /**
   * Compute the shortest-path heading change in radians, normalized
   * to [-π, π]. Consumers use this to check if a turn is large enough
   * to schedule (e.g. skip changes below some epsilon).
   */
  computeShortestAngle(fromHeading: number, toHeading: number): number;

  /** Whether all turn clips are loaded and baked. */
  isReady(): boolean;

  /** Dispose loaded clip data. */
  dispose(): void;
}
