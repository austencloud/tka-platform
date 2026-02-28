/**
 * IOverlayRenderer - Phase-specific visualization on a canvas overlay
 *
 * Each phase implements this to draw its detection results on top of
 * the source video frame. The overlay canvas is positioned identically
 * to the video element so markers appear at the correct positions.
 */

import type { DetectionFrame } from "$lib/features/train/domain/models/DetectionFrame";
import type { DetectedBeat } from "../../domain/models";

/** Context passed to the renderer for each frame */
export interface OverlayRenderContext {
  /** The canvas 2D context to draw on */
  ctx: CanvasRenderingContext2D;

  /** Canvas width in pixels */
  width: number;

  /** Canvas height in pixels */
  height: number;

  /** The detection data for this specific frame */
  frame: DetectionFrame | null;

  /** The current frame index in the timeline */
  frameIndex: number;

  /** Detected beats (for beat boundary visualization) */
  beats: DetectedBeat[];

  /** Current timestamp in seconds */
  timestamp: number;
}

export interface IOverlayRenderer {
  /** Human-readable name for this renderer (e.g., "Phase 1: Hand Positions") */
  readonly name: string;

  /** Which phase this renderer is for */
  readonly phase: number;

  /**
   * Render detection data onto the overlay canvas for a single frame.
   *
   * Called each time the user scrubs to a new frame or during playback.
   * Must clear and redraw the full overlay each call.
   */
  render(context: OverlayRenderContext): void;
}
