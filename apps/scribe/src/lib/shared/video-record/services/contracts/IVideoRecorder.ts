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

export interface IVideoRecorder {
  /**
   * Start recording from camera stream
   *
   * @param stream - MediaStream from camera
   * @param options - Recording options
   * @param onProgress - Progress callback
   * @returns Promise resolving to recording ID
   */
  startRecording(
    stream: MediaStream,
    options?: RecordingOptions,
    onProgress?: (progress: RecordingProgress) => void
  ): Promise<string>;

  /**
   * Pause ongoing recording
   *
   * @param recordingId - Recording identifier
   */
  pauseRecording(recordingId: string): void;

  /**
   * Resume paused recording
   *
   * @param recordingId - Recording identifier
   */
  resumeRecording(recordingId: string): void;

  /**
   * Stop recording and finalize video
   *
   * @param recordingId - Recording identifier
   * @returns Promise resolving to recording result
   */
  stopRecording(recordingId: string): Promise<RecordingResult>;

  /**
   * Cancel ongoing recording
   *
   * @param recordingId - Recording identifier
   */
  cancelRecording(recordingId: string): void;

  /**
   * Get cached recording by ID
   *
   * @param recordingId - Recording identifier
   * @returns Promise resolving to cached recording or null
   */
  getCachedRecording(recordingId: string): Promise<RecordingResult | null>;

  /**
   * Cache a recording to IndexedDB
   *
   * @param recordingId - Recording identifier
   * @param videoBlob - Video blob to cache
   * @param duration - Recording duration in seconds
   */
  cacheRecording(
    recordingId: string,
    videoBlob: Blob,
    duration: number
  ): Promise<void>;

  /**
   * Clear cached recording
   *
   * @param recordingId - Recording identifier
   */
  clearCachedRecording(recordingId: string): Promise<void>;

  /**
   * Clear all cached recordings
   */
  clearAllCachedRecordings(): Promise<void>;

  /**
   * Check if currently recording
   *
   * @param recordingId - Recording identifier
   */
  isRecording(recordingId: string): boolean;

  /**
   * Get current recording state
   *
   * @param recordingId - Recording identifier
   */
  getRecordingState(
    recordingId: string
  ): "idle" | "recording" | "paused" | "stopped";
}
