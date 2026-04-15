/**
 * Video Upload Service Interface
 *
 * Defines the contract for uploading user videos, animations, and thumbnails
 * to cloud storage (R2).
 *
 * Key differences from the old interface:
 * - Returns `key` (R2 object key) instead of `storagePath` (Firebase path)
 * - Progress callback is inside an `options` object alongside AbortSignal
 * - `getPublicUrl` is synchronous (just concatenates base URL + key)
 */

export interface VideoUploadResult {
  /** Public CDN URL for the uploaded file */
  url: string;
  /** R2 object key (for deletion) */
  key: string;
}

export interface UploadOptions {
  /** Progress callback, 0-100 */
  onProgress?: (percent: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface MultipartUploadState {
  uploadId: string;
  key: string;
  completedParts: Array<{ ETag: string; PartNumber: number }>;
  totalParts: number;
  partSize: number;
}

export interface IVideoUploader {
  uploadPerformanceVideo(
    sequenceId: string,
    videoFile: File | Blob,
    options?: UploadOptions
  ): Promise<VideoUploadResult>;

  uploadAnimatedSequence(
    sequenceId: string,
    animationBlob: Blob,
    format: "webp" | "gif",
    options?: UploadOptions
  ): Promise<VideoUploadResult>;

  deleteSequenceAssets(sequenceId: string): Promise<void>;

  getPublicUrl(key: string): string;

  uploadVideoThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    videoTimestamp: number,
    options?: UploadOptions
  ): Promise<VideoUploadResult>;

  uploadSequenceThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    format?: "png" | "jpeg" | "webp",
    options?: UploadOptions
  ): Promise<VideoUploadResult>;
}
