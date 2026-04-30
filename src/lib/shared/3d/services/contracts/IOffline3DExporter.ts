import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
import type { CameraKeyframeBuffer } from "$lib/shared/video-export/domain/CameraKeyframe";

export interface Offline3DExportOptions {
  fps: number;
  /** Target vertical resolution: 720, 1080, 2160, or 4320 */
  resolution: number;
  loopCount: number;
  includeStartPosition: boolean;
  includeEndHold: boolean;
  /**
   * "standard": one render per output frame at native resolution.
   * "cinema": 2× supersampling + 4× temporal motion blur. Roughly 4-8× slower
   * than standard but produces a sharper, smoother result.
   */
  quality?: "standard" | "cinema";
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
   * The Three.js WebGLRenderer. In cinema quality mode the exporter
   * temporarily resizes the renderer to 2× target resolution for
   * supersampling antialiasing. Only `getSize`/`setSize` and pixel ratio
   * accessors are used; the renderer is restored before export completes.
   */
  renderer: {
    // Three.js WebGLRenderer.getSize expects a Vector2-shaped target
    // because it calls `target.set(w, h)` internally.
    getSize(target: { x: number; y: number; set(w: number, h: number): unknown }): unknown;
    setSize(w: number, h: number, updateStyle?: boolean): void;
    getPixelRatio(): number;
    setPixelRatio(ratio: number): void;
  };
  /**
   * Runs Threlte's full pipeline synchronously in one call: every useTask
   * callback (puppet loop, IK, effects, render) executes, then the scene
   * is drawn. `timeMs` is a monotonically increasing timestamp used for
   * delta-time calculation inside tasks. This is how the exporter renders
   * at CPU speed without rAF throttling.
   */
  runFrame: (timeMs: number) => void;
  /**
   * Pause Threlte's native rAF loop so manual runFrame calls aren't
   * racing with automatic renders. The loop is resumed after export.
   */
  pauseAutoLoop: () => void;
  /** Restore Threlte's native rAF loop after export completes. */
  resumeAutoLoop: () => void;
  /**
   * Signal that offline export is active. The puppet loop reads
   * exportCurrentStep instead of the live component prop.
   */
  setExporting: (value: boolean) => void;
  /**
   * Set the current animation step for the puppet loop to distribute.
   * The puppet loop reads this value during runFrame and calls
   * goToStep/setProgress on performers - same code path as live playback.
   */
  setExportCurrentStep: (step: number | null) => void;
}

export interface IOffline3DExporter {
  exportOffline(
    deps: Offline3DExportDependencies,
    onProgress: (progress: VideoExportProgress) => void,
    options: Offline3DExportOptions
  ): Promise<Blob>;

  cancel(): void;
}
