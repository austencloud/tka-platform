import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";

export interface VideoExportEffectOverrides {
  fire?: boolean;
  led?: boolean;
  trails?: boolean;
  charcoal?: boolean;
}

export interface VideoExportOptions {
  fps: number;
  loopCount: number;
  resolution: 720 | 1080 | 2160 | 4320;
  effectOverrides?: VideoExportEffectOverrides;
  includeStartPosition?: boolean;
  includeEndHold?: boolean;
}

export interface ImageExportOptions {
  includeStartPosition: boolean;
  showStepNumbers: boolean;
  showWord: boolean;
  showDifficulty: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  darkMode: boolean;
  columnCount: number | null;
}

/**
 * Export state for UI binding
 */
export interface ExportState {
  isExporting: boolean;
  progress: VideoExportProgress | null;
  error: string | null;
  /** Object URL of the exported video blob, available after successful video export */
  previewBlobUrl: string | null;
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
 * Dependencies required for 3D video exports (offline two-pass pipeline).
 * The caller gathers these from the live 3D scene; SequenceModalExporter
 * forwards them into Offline3DExportDependencies.
 */
export interface Video3DExportDependencies {
  webglCanvas: HTMLCanvasElement;
  /** Three.js PerspectiveCamera (from useThrelte().camera) */
  camera: {
    position: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
    quaternion: { x: number; y: number; z: number; w: number; set(x: number, y: number, z: number, w: number): void };
    fov: number;
    updateProjectionMatrix(): void;
  };
  /** All performer instances to drive animation */
  performers: Array<{
    goToStep(index: number): void;
    setProgress(value: number): void;
    totalSteps: number;
  }>;
  /** Beats per second for converting animation time to currentStep */
  beatsPerSecond: number;
  /** Total animation duration in seconds (single loop, no start/end hold) */
  totalDurationSeconds: number;
  /** Camera keyframe buffer from pass 1 (or static capture) */
  cameraKeyframes: import("$lib/shared/video-export/domain/CameraKeyframe").CameraKeyframeBuffer;
  /** Threlte advance() — runs full pipeline + render for one frame */
  advance(): void;
  /** Switch between 'always' (live) and 'manual' (offline) render modes */
  setRenderMode(mode: "always" | "manual"): void;
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
   * Export as 3D animation video from a WebGL canvas
   */
  export3DAnimation(
    options: VideoExportOptions,
    deps: Video3DExportDependencies,
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
   * Dismiss the post-export preview, revoking the blob URL
   */
  dismissPreview(): void;

  /**
   * Clear error state
   */
  clearError(): void;

  /**
   * Dispose and cleanup
   */
  dispose(): void;
}
