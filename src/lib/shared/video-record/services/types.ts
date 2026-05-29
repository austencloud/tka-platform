

// --- From IVideoRecorder ---
/**
 * IVideoRecorder
 *
 * Records video from user's camera for sequence performance submissions.
 * Designed for low-stakes "proof of completion" videos.
 */

export interface RecordingProgress {
  /** Current recording duration in seconds */
  currentDuration: number;
  /** Recording state: 'recording' | 'paused' | 'stopped' */
  state: "recording" | "paused" | "stopped";
}

export interface RecordingResult {
  /** Whether recording succeeded */
  success: boolean;
  /** Video blob (if successful) */
  videoBlob?: Blob;
  /** Blob URL for playback (if successful) */
  blobUrl?: string;
  /** Recording duration in seconds */
  duration?: number;
  /** Error message (if failed) */
  error?: string;
  /** Recording ID for caching */
  recordingId: string;
}

export interface RecordingOptions {
  /** Video format: 'webm' or 'mp4' (default: 'webm') */
  format?: "webm" | "mp4";
  /** Video quality (0-1, default: 0.9) */
  quality?: number;
  /** Maximum recording duration in seconds (default: 60) */
  maxDuration?: number;
}
