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
  /** The Three.js WebGLRenderer (from useThrelte().renderer) */
  renderer: { render(scene: any, camera: any): void };
  /** The Three.js Scene (from useThrelte().scene) */
  scene: any;
  /** The Three.js PerspectiveCamera (from useThrelte().camera) */
  camera: {
    position: { set(x: number, y: number, z: number): void };
    quaternion: { set(x: number, y: number, z: number, w: number): void };
    fov: number;
    updateProjectionMatrix(): void;
  };
  /** All performer instances to drive animation */
  performers: Array<{
    goToStep(index: number): void;
    setProgress(value: number): void;
    totalSteps: number;
  }>;
  /** Formation transition updater */
  updateFormationTransition(timestamp: number): void;
  /** Effect orchestrator update (receives dt in seconds) */
  updateEffects(dt: number): void;
  /** Beats per second for converting animation time to currentStep */
  beatsPerSecond: number;
  /** Total animation duration in seconds (single loop, no start/end hold) */
  totalDurationSeconds: number;
  /** Camera keyframe buffer from pass 1 (or static capture) */
  cameraKeyframes: CameraKeyframeBuffer;
  /** Callback to pause Threlte's auto-render loop */
  pauseAutoRender(): void;
  /** Callback to resume Threlte's auto-render loop */
  resumeAutoRender(): void;
}

export interface IOffline3DExporter {
  exportOffline(
    deps: Offline3DExportDependencies,
    onProgress: (progress: VideoExportProgress) => void,
    options: Offline3DExportOptions
  ): Promise<Blob>;

  cancel(): void;
}
