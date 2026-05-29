

// --- From IAudioStorageManager ---
/**
 * Audio Storage Service Contract
 *
 * Handles uploading and downloading audio files to/from Firebase Storage.
 */

export interface UploadProgress {
  /** Upload progress 0-100 */
  progress: number;
  /** Current stage of upload */
  stage: "uploading" | "complete" | "error";
  /** Optional message */
  message?: string;
}

// === From IAudioStorageManager ===

export interface UploadProgress {
  /** Upload progress 0-100 */
  progress: number;
  /** Current stage of upload */
  stage: "uploading" | "complete" | "error";
  /** Optional message */
  message?: string;
}
