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

export interface IAudioStorageManager {
  /**
   * Upload audio file to Firebase Storage
   * @param trackId Unique track identifier
   * @param audioBlob Audio file blob
   * @param onProgress Optional progress callback
   * @returns Cloud storage URL
   */
  uploadAudioFile(
    trackId: string,
    audioBlob: Blob,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string>;

  /**
   * Download audio file from Firebase Storage
   * @param cloudUrl Cloud storage URL
   * @returns Audio blob
   */
  downloadAudioFile(cloudUrl: string): Promise<Blob>;

  /**
   * Delete audio file from Firebase Storage
   * @param cloudUrl Cloud storage URL
   */
  deleteAudioFile(cloudUrl: string): Promise<void>;

  /**
   * Check if audio file exists in cloud storage
   * @param trackId Track identifier
   */
  hasAudioFile(trackId: string): Promise<boolean>;
}
