/**
 * IStepBoundaryDetector - Find beat transitions in a hand timeline
 *
 * Groups consecutive frames with stable (same) blue/red grid locations
 * into beats. A new beat starts when either hand changes grid location.
 */

import type { HandTimeline, DetectedBeat } from "../../domain/models";

export interface StepDetectionOptions {
  /**
   * Minimum number of frames for a segment to count as a beat.
   * Segments shorter than this are merged into the previous beat.
   * Default: 3
   */
  minFramesPerBeat?: number;

  /**
   * Minimum confidence threshold for a hand detection to be considered valid.
   * Frames where both hands are below this threshold are skipped.
   * Default: 0.5
   */
  minConfidence?: number;
}

export interface IStepBoundaryDetector {
  /**
   * Detect beat boundaries in a hand timeline.
   *
   * Walks through frames sequentially, grouping consecutive frames
   * that share the same blue + red grid locations into beats.
   * Short segments below minFramesPerBeat are merged into neighbors.
   *
   * @param timeline - The hand detection timeline
   * @param options - Detection configuration
   * @returns Array of detected beats with position labels
   */
  detectBeats(timeline: HandTimeline, options?: StepDetectionOptions): DetectedBeat[];
}
