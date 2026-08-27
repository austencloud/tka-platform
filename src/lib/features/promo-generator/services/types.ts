/**
 * Promo Video Exporter Contract
 *
 * Handles rendering the 3D scene animation to video format.
 * Uses h264-mp4-encoder/mediabunny for high-quality MP4 output.
 */

export type ExportProgressCallback = (
  progress: number,
  stage: ExportStage
) => void;

/**
 * Export stages for progress reporting
 */
export type ExportStage =
  | "preparing"
  | "rendering"
  | "encoding"
  | "finalizing"
  | "complete";

export interface ExportResult {
  /** Whether the export succeeded */
  success: boolean;
  /** The exported video blob (if successful) */
  blob?: Blob;
  /** Download URL for the video */
  url?: string;
  /** Error message (if failed) */
  error?: string;
  /** Export duration in milliseconds */
  duration?: number;
  /** File size in bytes */
  fileSize?: number;
}

/**
 * Promo Animation Controller Contract
 *
 * Controls device and camera animations using GSAP timelines.
 * Manages animation presets and provides playback control.
 */

/**
 * Animation playback state
 */
export interface AnimationPlaybackState {
  /** Whether the animation is currently playing */
  isPlaying: boolean;
  /** Whether the animation is paused */
  isPaused: boolean;
  /** Current time position (0-1 normalized) */
  progress: number;
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
}

/**
 * Callback for animation progress updates
 */
export type AnimationProgressCallback = (
  progress: number,
  currentTime: number
) => void;
