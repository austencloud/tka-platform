/**
 * Video Exporter Contract
 *
 * Defines interface for hardware-accelerated video export using WebCodecs API.
 * Uses explicit frame timestamps for correct BPM timing.
 * Falls back to WASM encoder for browsers without WebCodecs support.
 */

export type VideoFormat = "webm" | "mp4";

export interface VideoExportOptions {
  /** Video format - mp4 (H.264) is recommended. Default: mp4 */
  format?: VideoFormat;
  /** Target bitrate in bits per second. Default: 5_000_000 (5 Mbps) */
  bitrate?: number;
  /** Frames per second. Default: 50 */
  fps?: number;
  /** Output filename. Default: animation.{format} */
  filename?: string;
  /** Auto-download when complete. Default: true */
  autoDownload?: boolean;
}

export interface VideoExportProgress {
  /** Progress from 0 to 1 */
  progress: number;
  /** Current stage */
  stage: "capturing" | "encoding" | "complete" | "error";
  /** Current frame being captured */
  currentFrame?: number;
  /** Total frames to capture */
  totalFrames?: number;
  /** Error message if stage is 'error' */
  error?: string;
}

export interface IVideoExporter {
  /**
   * Check if a video format is supported by the browser
   */
  isFormatSupported(format: VideoFormat): boolean;

  /**
   * Get the best available video format (always MP4 with our encoders)
   */
  getBestFormat(): VideoFormat;

  /**
   * Create a manual video exporter for frame-by-frame capture
   */
  createManualExporter(
    width: number,
    height: number,
    options?: VideoExportOptions
  ): Promise<{
    addFrame: (canvas: HTMLCanvasElement) => Promise<void>;
    finish: () => Promise<Blob>;
    cancel: () => void;
  }>;

  /**
   * Cancel any in-progress export
   */
  cancelExport(): void;

  /**
   * Check if export is in progress
   */
  isExporting(): boolean;
}
