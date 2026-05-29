import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

export type VideoExportFormat = "webm" | "mp4";

export interface VideoExportProgress {
  progress: number;
  stage: "capturing" | "encoding" | "complete" | "error";
  currentFrame?: number;
  totalFrames?: number;
  error?: string;
}

export type VideoResolution = 720 | 1080 | 2160 | 4320;

export interface VideoEffectOverrides {
  fire?: boolean;
  led?: boolean;
  trails?: boolean;
  charcoal?: boolean;
}

export interface VideoExportOrchestratorOptions {
  filename?: string;
  fps?: number;
  resolution?: VideoResolution;
  loopCount?: number;
  format?: VideoExportFormat;
  effectOverrides?: VideoEffectOverrides;
  compositeMode?: "none" | "horizontal" | "vertical";
  gridStepSize?: number;
  showStepNumbers?: boolean;
  includeStartPosition?: boolean;
  includeAnimationStartPosition?: boolean;
  includeEndHold?: boolean;
  onCleanup?: () => void;
}

/**
 * Interface for the VideoExportOrchestrator, exposed in shared/ so that
 * shared-layer consumers can reference the orchestrator without importing
 * the concrete class from features/.
 */
export interface IVideoExportOrchestrator {
  executeExport(
    canvas: HTMLCanvasElement,
    playbackController: AnimationPlaybackController,
    panelState: AnimationPanelState,
    onProgress: (progress: VideoExportProgress) => void,
    options?: VideoExportOrchestratorOptions
  ): Promise<Blob>;
  cancelExport(): void;
  isExporting(): boolean;
}
