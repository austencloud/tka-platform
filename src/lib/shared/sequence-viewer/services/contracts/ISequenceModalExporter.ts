import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";

export interface VideoExportOptions {
  fps: number;
  loopCount: number;
}

export interface ImageExportOptions {
  includeStartPosition: boolean;
  showStepNumbers: boolean;
  showWord: boolean;
  showDifficulty: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  darkMode: boolean;
}

/**
 * Export state for UI binding
 */
export interface ExportState {
  isExporting: boolean;
  progress: VideoExportProgress | null;
  error: string | null;
}

/**
 * Callbacks for export lifecycle events
 */
export interface ExportCallbacks {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onHaptic: (type: "success" | "error" | "selection") => void;
}

/**
 * Dependencies required for video exports
 */
export interface VideoExportDependencies {
  canvas: HTMLCanvasElement;
  playbackController: IAnimationPlaybackController;
  panelState: AnimationPanelState;
}

/**
 * Dependencies required for image exports
 */
export interface ImageExportDependencies {
  sequence: SequenceData;
  userName: string;
}

/**
 * Orchestrates sequence exports (image, video).
 * Combined exports (animation + choreo card) are handled by Compose module.
 */
export interface ISequenceModalExporter {
  /**
   * Current export state for UI binding
   */
  readonly state: ExportState;

  /**
   * Export as animation-only video
   */
  exportAnimation(
    options: VideoExportOptions,
    deps: VideoExportDependencies,
    callbacks: ExportCallbacks
  ): Promise<void>;

  /**
   * Export as static image (choreo card PNG)
   */
  exportImage(
    options: ImageExportOptions,
    deps: ImageExportDependencies,
    callbacks: ExportCallbacks
  ): Promise<void>;

  /**
   * Cancel an in-progress export
   */
  cancel(): void;

  /**
   * Clear error state
   */
  clearError(): void;

  /**
   * Dispose and cleanup
   */
  dispose(): void;
}
