/**
 * Video Export Orchestrator Service Interface
 *
 * Orchestrates the frame-by-frame video export process by coordinating
 * the animation playback controller and video export service.
 */

import type { IAnimationPlaybackController } from "./IAnimationPlaybackController";
import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";

export type VideoExportFormat = "webm" | "mp4";

export interface VideoExportProgress {
  progress: number;
  stage: "capturing" | "encoding" | "complete" | "error";
  currentFrame?: number;
  totalFrames?: number;
  error?: string;
}

export type VideoResolution = 720 | 1080;

export interface VideoExportOrchestratorOptions {
  /** Custom filename for the export (defaults to sequence word) */
  filename?: string;
  /** Frame rate in FPS (default: 60) */
  fps?: number;
  /** Output resolution height in pixels (default: 1080) */
  resolution?: VideoResolution;
  /** Number of times to loop the sequence (default: 1, only used for loopable sequences) */
  loopCount?: number;
  /** Desired output format (mp4 or webm) */
  format?: VideoExportFormat;
  /** Composite mode: renders animation + grid side-by-side with beat highlighting */
  compositeMode?: "none" | "horizontal" | "vertical";
  /** Size of each beat cell in composite grid (default: 120) */
  gridStepSize?: number;
  /** Show beat numbers in composite grid (default: true) */
  showStepNumbers?: boolean;
  /** Include start position in composite grid (default: false) */
  includeStartPosition?: boolean;
}

export interface IVideoExportOrchestrator {
  /**
   * Execute a full video export by capturing frames and encoding
   * @param canvas The canvas element to capture frames from
   * @param playbackController The animation playback controller
   * @param panelState The current animation panel state
   * @param onProgress Callback for progress updates
   * @param options Export options
   * @returns Promise that resolves when export is complete
   */
  executeExport(
    canvas: HTMLCanvasElement,
    playbackController: IAnimationPlaybackController,
    panelState: AnimationPanelState,
    onProgress: (progress: VideoExportProgress) => void,
    options?: VideoExportOrchestratorOptions
  ): Promise<void>;

  /**
   * Cancel an ongoing export
   */
  cancelExport(): void;

  /**
   * Check if an export is currently in progress
   */
  isExporting(): boolean;
}
