/**
 * Realtime 3D Exporter Contract
 *
 * Captures frames from a live WebGL canvas during real-time playback and
 * encodes them to MP4 via the BackgroundVideoEncoder. Unlike the 2D export
 * pipeline (which controls frame-by-frame stepping), this exporter runs the
 * animation at real speed and samples frames at the target FPS using
 * requestAnimationFrame timing.
 */

import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";

export interface Realtime3DExportOptions {
  fps: number;
  /** Target vertical resolution: 720, 1080, 2160, or 4320 */
  resolution: number;
  loopCount: number;
  includeStartPosition: boolean;
  includeEndHold: boolean;
}

export interface IRealtime3DExporter {
  /**
   * Record frames from a WebGL canvas during real-time playback and produce
   * an MP4 blob.
   *
   * @param webglCanvas - The WebGL canvas to capture from
   * @param startPlayback - Callback to begin the animation
   * @param stopPlayback - Callback to halt the animation when recording ends
   * @param getTotalDurationSeconds - Returns the total animation duration in seconds
   * @param onProgress - Progress reporting callback
   * @param options - Export configuration (fps, resolution, loops, etc.)
   * @returns The finished MP4 as a Blob
   */
  export3D(
    webglCanvas: HTMLCanvasElement,
    startPlayback: () => void,
    stopPlayback: () => void,
    getTotalDurationSeconds: () => number,
    onProgress: (progress: VideoExportProgress) => void,
    options: Realtime3DExportOptions
  ): Promise<Blob>;

  /** Cancel an in-progress export and clean up resources. */
  cancel(): void;
}
