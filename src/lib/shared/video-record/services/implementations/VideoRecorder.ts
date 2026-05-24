/**
 * VideoRecorder
 *
 * Records video from user's camera for sequence performance submissions.
 * Uses MediaRecorder API and caches recordings to IndexedDB for instant replay.
 */

import type {
  RecordingProgress,
  RecordingResult,
  RecordingOptions,
} from "../contracts/types";

// IndexedDB configuration
const DB_NAME = "tka-video-recordings";
const STORE_NAME = "recordings";
const DB_VERSION = 1;

interface RecordingState {
  recordingId: string;
  mediaRecorder: MediaRecorder;
  chunks: Blob[];
  startTime: number;
  pausedDuration: number;
  lastPauseTime: number | null;
  options: Required<RecordingOptions>;
  onProgress?: (progress: RecordingProgress) => void;
  progressInterval?: number;
}

export class VideoRecorder {
  private db: IDBDatabase | null = null;
  private activeRecordings = new Map<string, RecordingState>();
  private cachedBlobUrls = new Map<string, string>();

  /**
   * Initialize IndexedDB for recording caching
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "recordingId" });
        }
      };
    });
  }

  /**
   * Generate unique recording ID
   */
  private generateRecordingId(): string {
    return `rec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Start recording from camera stream
   */
  async startRecording(
    stream: MediaStream,
    options: RecordingOptions = {},
    onProgress?: (progress: RecordingProgress) => void
  ): Promise<string> {
    const recordingId = this.generateRecordingId();

    const { format = "webm", quality = 0.9, maxDuration = 60 } = options;

    // Determine best MIME type
    const preferredMimeType =
      format === "webm" ? "video/webm;codecs=vp9" : "video/mp4";

    const mimeType = MediaRecorder.isTypeSupported(preferredMimeType)
      ? preferredMimeType
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

    // Create MediaRecorder
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: quality * 5_000_000, // 5 Mbps at max quality
    });

    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    // Start recording with 100ms chunks for smooth capture
    mediaRecorder.start(100);

    const startTime = Date.now();

    // Store recording state
    const recordingState: RecordingState = {
      recordingId,
      mediaRecorder,
      chunks,
      startTime,
      pausedDuration: 0,
      lastPauseTime: null,
      options: { format, quality, maxDuration },
      onProgress,
    };

    this.activeRecordings.set(recordingId, recordingState);

    // Start progress reporting
    if (onProgress) {
      const progressInterval = window.setInterval(() => {
        const state = this.activeRecordings.get(recordingId);
        if (!state) {
          clearInterval(progressInterval);
          return;
        }

        const currentDuration = this.getCurrentDuration(recordingId);

        onProgress({
          currentDuration,
          state: this.getRecordingStateInternal(state),
        });

        // Auto-stop if max duration reached
        if (currentDuration >= maxDuration) {
          this.stopRecording(recordingId);
        }
      }, 100);

      recordingState.progressInterval = progressInterval;
    }

    return recordingId;
  }

  /**
   * Pause ongoing recording
   */
  pauseRecording(recordingId: string): void {
    const state = this.activeRecordings.get(recordingId);
    if (!state) {
      console.warn(`No recording found with ID ${recordingId}`);
      return;
    }

    if (state.mediaRecorder.state === "recording") {
      state.mediaRecorder.pause();
      state.lastPauseTime = Date.now();
    }
  }

  /**
   * Resume paused recording
   */
  resumeRecording(recordingId: string): void {
    const state = this.activeRecordings.get(recordingId);
    if (!state) {
      console.warn(`No recording found with ID ${recordingId}`);
      return;
    }

    if (state.mediaRecorder.state === "paused" && state.lastPauseTime) {
      const pauseDuration = Date.now() - state.lastPauseTime;
      state.pausedDuration += pauseDuration;
      state.lastPauseTime = null;
      state.mediaRecorder.resume();
    }
  }

  /**
   * Stop recording and finalize video
   */
  async stopRecording(recordingId: string): Promise<RecordingResult> {
    const state = this.activeRecordings.get(recordingId);
    if (!state) {
      return {
        success: false,
        error: "Recording not found",
        recordingId,
      };
    }

    // Clear progress interval
    if (state.progressInterval) {
      clearInterval(state.progressInterval);
    }

    // Stop MediaRecorder
    const videoBlob = await new Promise<Blob>((resolve, reject) => {
      state.mediaRecorder.onstop = () => {
        const blob = new Blob(state.chunks, {
          type: state.mediaRecorder.mimeType,
        });
        resolve(blob);
      };

      state.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        reject(new Error("Recording failed"));
      };

      // Request stop if still recording
      if (state.mediaRecorder.state !== "inactive") {
        state.mediaRecorder.stop();
      } else {
        // Already stopped, create blob immediately
        const blob = new Blob(state.chunks, {
          type: state.mediaRecorder.mimeType,
        });
        resolve(blob);
      }
    });

    const duration = this.getCurrentDuration(recordingId);

    // Clean up recording state
    this.activeRecordings.delete(recordingId);

    // Create blob URL
    const blobUrl = URL.createObjectURL(videoBlob);

    // Cache the recording
    await this.cacheRecording(recordingId, videoBlob, duration);

    return {
      success: true,
      videoBlob,
      blobUrl,
      duration,
      recordingId,
    };
  }

  /**
   * Cancel ongoing recording
   */
  cancelRecording(recordingId: string): void {
    const state = this.activeRecordings.get(recordingId);
    if (!state) {
      console.warn(`No recording found with ID ${recordingId}`);
      return;
    }

    // Clear progress interval
    if (state.progressInterval) {
      clearInterval(state.progressInterval);
    }

    // Stop MediaRecorder without saving
    if (state.mediaRecorder.state !== "inactive") {
      state.mediaRecorder.stop();
    }

    // Clean up
    this.activeRecordings.delete(recordingId);
  }

  /**
   * Get cached recording by ID
   */
  async getCachedRecording(
    recordingId: string
  ): Promise<RecordingResult | null> {
    try {
      const db = await this.initDB();

      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(recordingId);

        request.onsuccess = () => {
          const result = request.result;
          if (result?.videoBlob) {
            const prev = this.cachedBlobUrls.get(recordingId);
            if (prev) URL.revokeObjectURL(prev);
            const blobUrl = URL.createObjectURL(result.videoBlob);
            this.cachedBlobUrls.set(recordingId, blobUrl);
            resolve({
              success: true,
              videoBlob: result.videoBlob,
              blobUrl,
              duration: result.duration,
              recordingId,
            });
          } else {
            resolve(null);
          }
        };

        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Cache a recording to IndexedDB
   */
  async cacheRecording(
    recordingId: string,
    videoBlob: Blob,
    duration: number
  ): Promise<void> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        const request = store.put({
          recordingId,
          videoBlob,
          duration,
          createdAt: Date.now(),
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to cache recording:", error);
    }
  }

  /**
   * Clear cached recording
   */
  async clearCachedRecording(recordingId: string): Promise<void> {
    try {
      const db = await this.initDB();

      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        store.delete(recordingId);
        resolve();
      });
    } catch {
      // Ignore errors
    }
  }

  /**
   * Clear all cached recordings
   */
  async clearAllCachedRecordings(): Promise<void> {
    try {
      const db = await this.initDB();

      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        resolve();
      });
    } catch {
      // Ignore errors
    }
  }

  /**
   * Check if currently recording
   */
  isRecording(recordingId: string): boolean {
    const state = this.activeRecordings.get(recordingId);
    return state?.mediaRecorder.state === "recording";
  }

  /**
   * Get current recording state
   */
  getRecordingState(
    recordingId: string
  ): "idle" | "recording" | "paused" | "stopped" {
    const state = this.activeRecordings.get(recordingId);
    if (!state) return "idle";
    return this.getRecordingStateInternal(state);
  }

  /**
   * Internal helper to get recording state
   */
  private getRecordingStateInternal(
    state: RecordingState
  ): "recording" | "paused" | "stopped" {
    if (state.mediaRecorder.state === "recording") return "recording";
    if (state.mediaRecorder.state === "paused") return "paused";
    return "stopped";
  }

  /**
   * Get current recording duration in seconds
   */
  private getCurrentDuration(recordingId: string): number {
    const state = this.activeRecordings.get(recordingId);
    if (!state) return 0;

    const elapsed = Date.now() - state.startTime;
    const activeDuration = elapsed - state.pausedDuration;
    return activeDuration / 1000;
  }
}

// Singleton instance
let serviceInstance: VideoRecorder | null = null;

export function getVideoRecorder(): VideoRecorder {
  if (!serviceInstance) {
    serviceInstance = new VideoRecorder();
  }
  return serviceInstance;
}
