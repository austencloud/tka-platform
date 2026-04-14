import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
import type { CameraKeyframeBuffer } from "$lib/shared/video-export/domain/CameraKeyframe";

export interface Offline3DExportOptions {
  fps: number;
  /** Target vertical resolution: 720, 1080, 2160, or 4320 */
  resolution: number;
  loopCount: number;
  includeStartPosition: boolean;
  includeEndHold: boolean;
}

/**
 * Dependencies the caller must supply from the live 3D scene.
 * The offline exporter uses these to drive the scene deterministically.
 */
export interface Offline3DExportDependencies {
  /** The WebGL canvas to capture frames from */
  webglCanvas: HTMLCanvasElement;
  /** The Three.js PerspectiveCamera (from useThrelte().camera) */
  camera: {
    position: { set(x: number, y: number, z: number): void };
    quaternion: { set(x: number, y: number, z: number, w: number): void };
    fov: number;
    updateProjectionMatrix(): void;
  };
  /** Beats per second for converting animation time to currentStep */
  beatsPerSecond: number;
  /** Total animation duration in seconds (single loop, no start/end hold) */
  totalDurationSeconds: number;
  /** Camera keyframe buffer from pass 1 (or static capture) */
  cameraKeyframes: CameraKeyframeBuffer;
  /**
   * Threlte's advance() — runs all useTask callbacks (puppet loop, IK solve,
   * effects) then renders one frame. This is the key to deterministic export:
   * we set performer state + camera, then call advance() to get one complete
   * rendered frame through the full pipeline.
   */
  advance(delta?: number): void;
  /**
   * Switch Threlte between 'always' (live) and 'manual' (offline) render modes.
   * In manual mode, only advance() triggers rendering.
   */
  setRenderMode(mode: "always" | "manual"): void;
  /**
   * Signal that offline export is active. The puppet loop reads
   * exportCurrentStep instead of the live component prop.
   */
  setExporting(value: boolean): void;
  /**
   * Set the current animation step for the puppet loop to distribute.
   * The puppet loop reads this value during advance() and calls
   * goToStep/setProgress on performers — same code path as live playback.
   */
  setExportCurrentStep(step: number | null): void;
}

export interface IOffline3DExporter {
  exportOffline(
    deps: Offline3DExportDependencies,
    onProgress: (progress: VideoExportProgress) => void,
    options: Offline3DExportOptions
  ): Promise<Blob>;

  cancel(): void;
}
